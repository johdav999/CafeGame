"""Offline Blender preparation of the reviewed 2026-10-26 Tripo set.
Run with Blender --background --factory-startup --python tools/prepare-cafe-models.py.
No provider calls. Preserves the source masters in assets/generated.
"""
import bpy, bmesh, hashlib, json, math, argparse, sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/generated/cafe-set-20261026'
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', type=Path, default=ROOT / 'assets/models')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.output_dir.mkdir(parents=True, exist_ok=True)
SPECS = [
    ('coffee-machine', 'clean', 9000, 1024, (1.3, .7, .8)),
    ('espresso-cup', 'clean', 1800, 512, None),
    ('counter-straight', 'modular', 2800, 512, None),
    ('counter-corner', 'modular', 2500, 512, None),
    ('table', 'clean', 2800, 512, (1.8, 1.8, 1.0)),
    ('chair', 'clean', 2800, 512, None),
]
reports = []
for name, variant, budget, resolution, dimensions in SPECS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = SOURCE / name / variant / 'model.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    before = sum(len(o.data.polygons) for o in meshes)
    topology = []
    for obj in meshes:
        obj.data.transform(Matrix.Rotation(-math.pi/2, 4, 'Z') @ obj.matrix_world)
        obj.matrix_world.identity()
        # glTF splits vertices at UV/normal seams. Collapse reduction on those
        # disconnected patches opens cracks; weld positions while retaining
        # per-corner UVs before reducing the connected surface.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        boundary_before = sum(e.is_boundary for e in bm.edges)
        boundary_length_before = sum(e.calc_length() for e in bm.edges if e.is_boundary)
        bm.to_mesh(obj.data)
        bm.free()
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new('Browser budget', 'DECIMATE')
        modifier.ratio = min(1, (budget-30)/before)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        boundary_after = sum(e.is_boundary for e in bm.edges)
        boundary_length_after = sum(e.calc_length() for e in bm.edges if e.is_boundary)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        if boundary_after > boundary_before or boundary_length_after > boundary_length_before * 1.01 + 1e-5:
            raise ValueError(f'{name}: reduction opened boundaries ({boundary_before} -> {boundary_after})')
        print('TOPOLOGY', name, boundary_before, boundary_after, flush=True)
        topology.append(dict(object=obj.name, boundary_edges_before=boundary_before,
                             boundary_edges_after=boundary_after,
                             boundary_length_before=boundary_length_before,
                             boundary_length_after=boundary_length_after))
    points = [v.co for o in meshes for v in o.data.vertices]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    origin = Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    # Chair seat stays near the existing half-metre seating height.
    scale = [dimensions[i]/(hi[i]-lo[i]) for i in range(3)] if dimensions else ([1.12]*3 if name=='chair' else [1]*3)
    for obj in meshes:
        for v in obj.data.vertices:
            v.co = Vector([(v.co[i]-origin[i])*scale[i] for i in range(3)])
        obj.data.update()
    for img in bpy.data.images:
        if img.type == 'IMAGE' and img.size[0]:
            img.scale(resolution,resolution)
            img.pack()
    out = args.output_dir / ('cafe-'+name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True,
                             export_animations=False, export_image_format='JPEG', export_jpeg_quality=85)
    triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    assert triangles <= budget, (name, triangles, budget)
    assert out.stat().st_size <= 1024*1024, (name, out.stat().st_size)
    prov = json.loads((SOURCE/name/'raw-network/model.glb.provenance.json').read_text())
    reports.append(dict(name=name,path='models/'+out.name,triangles=triangles,texture_size=resolution,
                        bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
                        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),provider='Tripo3D',
                        preparation='Position seams welded at 1e-6 m before reduction; face normals recalculated; no new boundary edges.',
                        topology=topology,
                        task_id=prov['task_id'],request=prov['request'],reference_notes=json.loads(prov['reference_notes']),
                        rights='Account entitlement not independently verified; integration requested by owner.'))
    print('PREPARED',name,triangles,out.stat().st_size,flush=True)
(args.output_dir/'cafe-provenance.json').write_text(json.dumps(reports,indent=2)+'\n')
