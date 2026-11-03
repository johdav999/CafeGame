"""Package and visually review the Tripo storage upgrade using headless Blender."""
import bpy, bmesh, json, hashlib, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/generated/storage-shelves-20261028'
raw_review='--raw-review' in sys.argv
OUT=SOURCE/('raw-review' if raw_review else 'final');OUT.mkdir(exist_ok=True)
source=SOURCE/('retry/raw/model.glb' if raw_review else 'retry/clean/model.glb')

def inspect(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    result=dict(boundary_edges=sum(e.is_boundary for e in bm.edges),non_manifold_edges=sum(not e.is_manifold for e in bm.edges))
    bm.free()
    if any(result.values()):raise ValueError((obj.name,result))
    return result

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for obj in meshes:
    if not raw_review:
        # Inspected source defects: three edge-sharing flaps, one isolated
        # sub-mm² triangle, and loose edges left by reduction. No hole filling.
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
        flaps=[f for f in bm.faces if f.calc_area()<.00025 and sum(e.is_boundary for e in f.edges)==2 and any(len(e.link_faces)==3 for e in f.edges)]
        islands=[f for f in bm.faces if f.calc_area()<1e-6 and all(e.is_boundary for e in f.edges)]
        assert len(flaps)==3 and len(islands)==1,'Source differs from reviewed defects'
        bmesh.ops.delete(bm,geom=flaps+islands,context='FACES')
        bmesh.ops.delete(bm,geom=[e for e in bm.edges if not e.link_faces],context='EDGES')
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    obj.data.transform(Matrix.Rotation(-math.pi/2,4,'Z')@obj.matrix_world)
    obj.parent=None;obj.matrix_world=Matrix.Identity(4)
points=[v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)])
hi=Vector([max(p[i] for p in points) for i in range(3)])
size=hi-lo;scale=Vector((.85/size.x,min(.75/size.y,1.6/size.z),1.6/size.z))
origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for obj in meshes:
    for v in obj.data.vertices:v.co=Vector([(v.co[i]-origin[i])*scale[i] for i in range(3)])
    obj.data.update()
if not raw_review:
    for obj in meshes:inspect(obj)
    for img in bpy.data.images:
        if img.type=='IMAGE' and img.size[0]:img.scale(1024,1024);img.pack()
    out=OUT/'cafe-storage-shelves.glb'
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=90)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(out))
    exported=[o for o in bpy.context.scene.objects if o.type=='MESH']
    topology=[inspect(o) for o in exported]
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in exported)
    assert triangles<=10000 and out.stat().st_size<=1024*1024,(triangles,out.stat().st_size)
    raw=json.loads((SOURCE/'retry/raw/model.glb.provenance.json').read_text())
    report=dict(id=23,path='models/'+out.name,triangles=triangles,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),topology=topology,provider='Tripo3D',task_id=raw['task_id'],request=raw['request'],reference_notes=json.loads((SOURCE/'references/storage-shelves.json').read_text()),cleanup=json.loads(source.with_suffix('.glb.qa.json').read_text()),preparation='Seam-welded before reduction; fitted to existing footprint, 1.6m tall; embedded 1024px JPEG textures; exact export reimported and checked.',rights='Account entitlement not independently verified; generation and integration requested by owner.')
    report['repair']='Removed three inspected edge-sharing source flaps, one isolated triangle under 1e-6 square metres, and loose edges. No hole filling.'
    (OUT/'cafe-storage-shelves-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PACKAGED',triangles,out.stat().st_size,flush=True)

scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral review');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.55,.55,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
light=bpy.data.lights.new('Softbox','AREA');light.energy=400;light.size=4
lamp=bpy.data.objects.new('Softbox',light);scene.collection.objects.link(lamp);lamp.location=(2,-3,4)
camera=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',camera);scene.collection.objects.link(cam)
camera.type='ORTHO';camera.ortho_scale=2.2;scene.camera=cam;scene.view_settings.view_transform='Standard'
views=[('front',(0,-4,2)),('rear',(0,4,2)),('left',(-4,0,2)),('right',(4,0,2)),('top',(0,-.01,5)),('underside',(0,-.01,-5))]
for label,pos in (views[:3] if raw_review else views):
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'review-{label}.png');bpy.ops.render.render(write_still=True)
print('REVIEW COMPLETE',flush=True)
