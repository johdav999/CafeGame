"""Package reviewed Tripo architecture without further geometry reduction.

Run with Blender --background --factory-startup --python this-file.
Raw and reviewed authoring masters remain untouched.
"""
import bpy
import bmesh
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/generated/architecture-20261027'
OUTPUT = ROOT / 'assets/models'


def inspect(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    report = dict(boundary_edges=sum(e.is_boundary for e in bm.edges),
                  non_manifold_edges=sum(not e.is_manifold for e in bm.edges))
    bm.free()
    assert report == dict(boundary_edges=0, non_manifold_edges=0), report
    return report


reports = []
for name, folder in [('wall', 'prepared-master'), ('floor', 'prepared')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = SOURCE / name / folder / (name + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    triangles = sum(len(o.data.polygons) for o in meshes)
    for obj in meshes:
        inspect(obj.data)
    # The approved masters already carry 1024px textures. JPEG packaging reduces
    # transfer size without collapsing triangles or changing UVs and silhouette.
    out = OUTPUT / ('cafe-' + name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True,
                             export_animations=False, export_image_format='JPEG',
                             export_jpeg_quality=90)
    assert out.stat().st_size <= 2*1024*1024, (name, out.stat().st_size)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(out))
    exported = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    topology = [inspect(o.data) for o in exported]
    assert sum(len(o.data.polygons) for o in exported) == triangles
    raw = json.loads((SOURCE/name/'raw/model.glb.provenance.json').read_text())
    reports.append(dict(name=name, path='models/'+out.name, triangles=triangles,
                        bytes=out.stat().st_size, sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
                        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                        provider='Tripo3D', task_id=raw['task_id'], request=raw['request'],
                        reference_notes=json.loads(raw['reference_notes']), topology=topology,
                        preparation='Reviewed geometry and UVs retained; JPEG quality 90, 1024px textures; reimported closed surface.',
                        rights='Account entitlement not independently verified; integration requested by owner.'))
    print(name, triangles, out.stat().st_size, flush=True)
(OUTPUT/'cafe-architecture-provenance.json').write_text(json.dumps(reports, indent=2)+'\n')
