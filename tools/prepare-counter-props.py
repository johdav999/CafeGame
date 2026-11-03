"""Package/review the requested ImageGen-referenced Tripo props; no provider calls.

Blender --background --python tools/prepare-counter-props.py -- NAME [--raw-review]
Sources and candidate exports stay in ignored assets/generated until reviewed.
"""
import bpy, bmesh, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/generated/counter-props-20261030'
SPECS = {'kettle': (25, .55), 'milk-jug': (26, .38),
         'counter-beans': (27, .40), 'stored-beans': (28, .32),
         'queue-marker': (29, .018)}
args = sys.argv[sys.argv.index('--')+1:]
name = args[0]
model_id, height = SPECS[name]
raw = '--raw-review' in args
source = BASE / name / 'network' / ('raw' if raw else 'clean') / 'model.glb'
outdir = BASE / name / ('raw-review' if raw else 'final')
outdir.mkdir(parents=True, exist_ok=True)

def inspect(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    result = dict(boundary_edges=sum(e.is_boundary for e in bm.edges),
                  non_manifold_edges=sum(not e.is_manifold for e in bm.edges))
    bm.free()
    return result

def fit(meshes):
    for obj in meshes:
        obj.data.transform(obj.matrix_world); obj.matrix_world.identity()
    points = [v.co for o in meshes for v in o.data.vertices]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    size = hi-lo
    scale = Vector((height/size.z,)*3)
    if name == 'queue-marker':
        scale = Vector((.48/size.x, .48/size.y, height/size.z))
    origin = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    for obj in meshes:
        for v in obj.data.vertices:
            v.co = Vector([(v.co[i]-origin[i])*scale[i] for i in range(3)])
        obj.data.update()

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
fit(meshes)
if not raw:
    for img in bpy.data.images:
        if img.type == 'IMAGE' and img.size[0]:
            img.scale(512,512); img.pack()
    out = outdir / f'cafe-{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True,
                              export_animations=False, export_image_format='JPEG', export_jpeg_quality=90)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(out))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    topology = [inspect(o) for o in meshes]
    assert triangles <= 3500 and out.stat().st_size <= 1024*1024, (triangles,out.stat().st_size)
    receipt = json.loads((BASE/name/'network/raw/model.glb.provenance.json').read_text())
    report = dict(id=model_id, name=name, path='models/'+out.name,
                  triangles=triangles, bytes=out.stat().st_size,
                  sha256=hashlib.sha256(out.read_bytes()).hexdigest(), topology=topology,
                  dimensions=list(meshes[0].dimensions), provider='Tripo3D',
                  task_id=receipt['task_id'], request=receipt['request'],
                  reference_notes=json.loads((BASE/'references'/f'{name}.json').read_text()),
                  cleanup=json.loads(source.with_suffix('.glb.qa.json').read_text()),
                  preparation='Welded seams before reduction; base pivot; metres; embedded 512px textures; exact export reimported.',
                  rights='Generation and integration requested by owner; account entitlement not independently verified.')
    (outdir/f'cafe-{name}-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PACKAGED',name,triangles,out.stat().st_size,topology,flush=True)

scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=8
scene.render.resolution_x=480; scene.render.resolution_y=480; scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral review'); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.55,.55,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
extent=max(max(o.dimensions) for o in meshes)
light=bpy.data.lights.new('Softbox','AREA'); light.energy=60; light.size=2
lamp=bpy.data.objects.new('Softbox',light); scene.collection.objects.link(lamp); lamp.location=(1,-2,3)
camera=bpy.data.cameras.new('Review'); cam=bpy.data.objects.new('Review',camera); scene.collection.objects.link(cam)
camera.type='ORTHO'; camera.ortho_scale=extent*1.5; scene.camera=cam; scene.view_settings.view_transform='Standard'
target=Vector((0,0,height/2))
views=[('front',(1,-3,1.6)),('rear',(-1,3,1.6)),('left',(-3,0,1)),
       ('right',(3,0,1)),('top',(0,-.01,3)),('underside',(0,-.01,-3))]
for label,pos in (views[:2]+views[4:] if raw else views):
    cam.location=target+Vector(pos)*extent
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(outdir/f'review-{label}.png'); bpy.ops.render.render(write_still=True)
print('REVIEW COMPLETE',name,flush=True)
