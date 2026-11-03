import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch, Mock
import urllib.error

spec = importlib.util.spec_from_file_location(
    'diagnostics', Path(__file__).resolve().parents[1] / 'tools/elevenlabs-diagnostics.py')
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class DiagnosticsTests(unittest.TestCase):
    def error(self, body):
        return urllib.error.HTTPError('https://example.invalid', 400, 'Bad request', {}, io.BytesIO(body))

    def test_known_reason_without_provider_message(self):
        result = diagnostics.describe_error(self.error(
            b'{"detail":{"status":"quota_exceeded","message":"SECRET"}}'))
        self.assertIn('quota_exceeded', result)
        self.assertNotIn('SECRET', result)

    def test_unknown_or_malformed_body_not_printed(self):
        for body in [b'SECRET', b'{"detail":{"status":"SECRET"}}', b'[]', b'{"detail":[]}']:
            result = diagnostics.describe_error(self.error(body))
            self.assertIn('reason unavailable', result)
            self.assertNotIn('SECRET', result)

    def test_no_retry(self):
        helper = SimpleNamespace(key=lambda: 'fake-key', BASE='https://example.invalid',
                                 NoRedirect=object, prepare=lambda args: None)
        diagnostics.install_diagnostics(helper)
        opener = Mock()
        opener.open.side_effect = self.error(b'{"detail":{"status":"invalid_request"}}')
        with patch.object(diagnostics.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaisesRegex(ValueError, 'invalid_request'):
                helper.request('/v1/sound-generation', {'text': 'chime'})
        self.assertEqual(opener.open.call_count, 1)

    def test_sound_v2_length_checked_before_network(self):
        for length in (450, 451):
            payload = {'text': 'x' * length, 'model_id': 'eleven_text_to_sound_v2'}
            result = (None, None, payload, None)
            helper = SimpleNamespace(prepare=lambda args: result)
            diagnostics.install_diagnostics(helper)
            if length == 450:
                self.assertEqual(helper.prepare(SimpleNamespace(mode='sound')), result)
            else:
                with self.assertRaisesRegex(ValueError, '450 characters'):
                    helper.prepare(SimpleNamespace(mode='sound'))

    def test_provider_length_error_is_actionable(self):
        result = diagnostics.describe_error(self.error(
            b'{"detail":{"status":"invalid_text_length","message":"SECRET"}}'))
        self.assertIn('450 characters', result)
        self.assertNotIn('SECRET', result)


if __name__ == '__main__':
    unittest.main()
