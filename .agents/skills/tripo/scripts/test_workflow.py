import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import tripo
import cleanup


class WorkflowTests(unittest.TestCase):
    def test_resume_accepts_uuid_and_legacy_ids_without_resubmission(self):
        for task_id in ('ebd5af08-b28b-426c-ada9-652ebe477d45', 'task_test'):
            with self.subTest(task_id=task_id), tempfile.TemporaryDirectory() as folder:
                root = Path(folder).resolve()
                job = root/'job.json'
                job.write_text(json.dumps(dict(task_id=task_id, output='model.glb')))
                with patch.object(tripo, 'api', return_value={'status': 'running'}) as api:
                    with self.assertRaisesRegex(ValueError, 'Polling limit'):
                        tripo.wait_download(root, job, 'fake', 0)
                    api.assert_called_once_with('/tasks/'+task_id, 'fake', opener=None)
        for task_id in ('../tasks', 'task_a?token=x', 'not-a-uuid', None):
            with self.subTest(task_id=task_id), tempfile.TemporaryDirectory() as folder:
                root = Path(folder).resolve()
                job = root/'job.json'
                job.write_text(json.dumps(dict(task_id=task_id, output='model.glb')))
                with patch.object(tripo, 'api') as api:
                    with self.assertRaisesRegex(ValueError, 'valid task ID'):
                        tripo.wait_download(root, job, 'fake', 0)
                    api.assert_not_called()

    def test_default_dry_run_no_credentials_network_or_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root/'ref.png').write_bytes(b'\x89PNG\r\n\x1a\nfixture')
            with patch.object(tripo, 'repo_root', return_value=root), patch.object(tripo, 'get_key') as key, patch.object(tripo, 'api') as api:
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(tripo.main(['generate', '--repo', folder, '--image', 'ref.png', '--output', 'new/model.glb']), 0)
                key.assert_not_called()
                api.assert_not_called()
                self.assertFalse((root/'new').exists())

    def test_bad_signature_rejected_in_dry_run(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root/'ref.png').write_bytes(b'not an image')
            with patch.object(tripo, 'repo_root', return_value=root), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(tripo.main(['generate', '--repo', folder, '--image', 'ref.png', '--output', 'new/model.glb']), 1)

    def test_ambiguous_submission_preserves_receipt_no_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root/'ref.png').write_bytes(b'\x89PNG\r\n\x1a\nfixture')
            with patch.object(tripo, 'repo_root', return_value=root), patch.object(tripo, 'get_key', return_value='fake'), patch.object(tripo, 'upload', return_value=('file_test', 'hash')), patch.object(tripo, 'api', side_effect=ValueError('Transport failed')) as api, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(tripo.main(['generate', '--repo', folder, '--image', 'ref.png', '--output', 'new/model.glb', '--execute']), 1)
                self.assertEqual(api.call_count, 1)
            job = json.loads((root/'new/job.json').read_text())
            self.assertEqual(job['status'], 'submitting_unknown_if_interrupted')
            self.assertNotIn('task_id', job)
            self.assertEqual(job['image_sha256'], 'hash')

    def test_remote_signed_url_not_in_dry_run(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(tripo, 'repo_root', return_value=Path(folder).resolve()):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(tripo.main(['generate', '--repo', folder, '--image-url', 'https://example.test/ref.png?token=private', '--output', 'new/model.glb']), 0)
            self.assertNotIn('private', output.getvalue())

    def test_cleanup_validation_before_generation(self):
        args = tripo.parser().parse_args(['clean', '--repo', '.', '--input', 'raw.glb', '--output', 'clean.glb'])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            with patch.object(cleanup.shutil, 'which', return_value='blender'):
                with self.assertRaises(ValueError):
                    cleanup.validate_cleanup(root, 'raw.glb', '../escape.glb', args)
                args.decimate_ratio = float('nan')
                with self.assertRaises(ValueError):
                    cleanup.validate_cleanup(root, 'raw.glb', 'clean.glb', args)

    def test_cleanup_failure_does_not_delete_raw(self):
        args = tripo.parser().parse_args(['clean', '--repo', '.', '--input', 'raw.glb', '--output', 'clean.glb'])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            raw = root/'raw.glb'
            raw.write_bytes(b'original')
            with patch.object(cleanup.shutil, 'which', return_value='blender'), patch.object(cleanup.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'blender')):
                with self.assertRaises(subprocess.CalledProcessError):
                    cleanup.run_cleanup(root, raw, root/'clean.glb', args)
            self.assertEqual(raw.read_bytes(), b'original')

    @unittest.skipUnless(os.environ.get('TRIPO_TEST_BLENDER'), 'Set TRIPO_TEST_BLENDER for headless integration')
    def test_blender_roundtrip_materials_scale_and_source_preserved(self):
        blender = os.environ['TRIPO_TEST_BLENDER']
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            raw = root/'raw.glb'
            fixture = root/'fixture.py'
            fixture.write_text('''import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2, location=(4, 3, 2))
obj = bpy.context.object
mat = bpy.data.materials.new('FixtureMaterial')
mat.use_nodes = True
mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.1, 0.5, 0.2, 1)
image = bpy.data.images.new('FixtureTexture', width=16, height=16)
image.generated_color = (0.1, 0.5, 0.2, 1)
node = mat.node_tree.nodes.new('ShaderNodeTexImage')
node.image = image
mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
obj.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB')
''', encoding='utf-8')
            subprocess.run([blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(fixture), '--', str(raw)], check=True, timeout=120, capture_output=True)
            original = raw.read_bytes()
            args = tripo.parser().parse_args(['clean', '--repo', folder, '--input', 'raw.glb', '--output', 'clean.glb', '--blender', blender, '--height', '0.3'])
            cleanup.run_cleanup(root, raw, 'clean.glb', args)
            self.assertEqual(raw.read_bytes(), original)
            qa = json.loads((root/'clean.glb.qa.json').read_text())
            self.assertEqual(qa['after']['triangles'], 12)
            # GLB splits vertices at hard-normal/UV seams; default cleanup preserves them.
            self.assertEqual(qa['after']['non_manifold_edges'], qa['before']['non_manifold_edges'])
            self.assertAlmostEqual(qa['dimensions_gltf_xyz'][1], 0.3, places=5)
            self.assertIn('FixtureMaterial', qa['materials'])
            self.assertTrue(any(t['width'] == 16 and t['height'] == 16 for t in qa['textures']))
            self.assertGreater(qa['topology'][0]['before_reduction']['seam_duplicates'], 0)
            self.assertEqual(qa['topology'][0]['before_reduction']['boundary_edges'], 0)
            args.decimate_ratio = 0.5
            with self.assertRaises(subprocess.CalledProcessError):
                cleanup.run_cleanup(root, raw, 'unsafe-reduction.glb', args)
            self.assertFalse((root/'unsafe-reduction.glb').exists())
            self.assertEqual(raw.read_bytes(), original)
            args.decimate_ratio = 1
            verify = root/'verify.py'
            verify.write_text('''import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
assert abs(min(p.z for p in points)) < 1e-5
assert abs(max(p.z for p in points) - 0.3) < 1e-5
assert all(o.data.materials for o in meshes)
assert any(i.size[0] == 16 and i.size[1] == 16 for i in bpy.data.images)
''', encoding='utf-8')
            subprocess.run([blender, '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(verify), '--', str(root/'clean.glb')], check=True, timeout=120, capture_output=True)
            args.merge_distance = 0.00001
            cleanup.run_cleanup(root, raw, 'welded.glb', args)
            welded = json.loads((root/'welded.glb.qa.json').read_text())
            self.assertEqual(welded['after']['vertices'], 8)
            self.assertEqual(welded['after']['non_manifold_edges'], 0)
            args.decimate_ratio = 0.5
            cleanup.run_cleanup(root, raw, 'reduced.glb', args)
            reduced = json.loads((root/'reduced.glb.qa.json').read_text())
            self.assertLess(reduced['after']['triangles'], 12)
            self.assertEqual(reduced['topology'][0]['after_reduction']['boundary_edges'], 0)
            self.assertEqual(reduced['topology'][0]['after_reduction']['boundary_length'], 0)
            self.assertEqual(raw.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
