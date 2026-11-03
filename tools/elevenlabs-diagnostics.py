"""Run the installed audio skill with bounded, allowlisted HTTP diagnostics."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request


HINTS = {
    'invalid_api_key': 'The API key was rejected.',
    'missing_permissions': 'The API key lacks permission for this operation.',
    'quota_exceeded': 'The account or API-key credit quota was exceeded.',
    'insufficient_credits': 'The account has insufficient credits.',
    'model_not_found': 'The requested model is unavailable.',
    'invalid_model_id': 'The requested model ID was rejected.',
    'invalid_request': 'The provider rejected the request parameters.',
    'invalid_parameters': 'The provider rejected the request parameters.',
    'invalid_text_length': 'Sound v2 prompts must contain at most 450 characters. Shorten the request text.',
    'unusual_activity': 'The provider restricted this request due to account activity.',
}


def describe_error(error):
    # Never print provider messages: they can echo credentials or request text.
    hint = 'Provider reason unavailable; inspect the failed request in ElevenLabs.'
    try:
        body = json.loads(error.read(16385))
        detail = body.get('detail') if isinstance(body, dict) else None
        status = detail.get('status') if isinstance(detail, dict) else None
        if isinstance(status, str) and status in HINTS:
            hint = f'{status}: {HINTS[status]}'
    except (ValueError, OSError):
        pass
    finally:
        error.close()
    return f'ElevenLabs HTTP {error.code}. {hint} No retry performed.'


def install_diagnostics(helper):
    original_prepare = helper.prepare

    def prepare(args):
        result = original_prepare(args)
        payload = result[2]
        if (args.mode == 'sound' and payload.get('model_id') == 'eleven_text_to_sound_v2'
                and len(payload['text']) > 450):
            raise ValueError('Sound v2 prompt exceeds 450 characters; shorten the request text before generation.')
        return result

    helper.prepare = prepare
    def request(endpoint, payload=None):
        headers = {'xi-api-key': helper.key(),
                   'Accept': 'audio/mpeg' if payload is not None else 'application/json'}
        data = None
        if payload is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        req = urllib.request.Request(helper.BASE + endpoint, data=data, headers=headers)
        try:
            return urllib.request.build_opener(helper.NoRedirect).open(req, timeout=180)
        except urllib.error.HTTPError as error:
            raise ValueError(describe_error(error)) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ValueError('Network failure; billing may have occurred. Check provider history before retrying.') from None
    helper.request = request


def main():
    # Windows PowerShell cannot load PowerShell 7 modules inherited by Python.
    # Let its credential-unlock subprocess build its own default module path.
    if os.name == 'nt':
        os.environ.pop('PSModulePath', None)
    path = Path.home() / '.codex/skills/elevenlabs/scripts/audio.py'
    spec = importlib.util.spec_from_file_location('elevenlabs_audio_skill', path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    install_diagnostics(helper)
    return helper.main()


if __name__ == '__main__':
    sys.exit(main())
