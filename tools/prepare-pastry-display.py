"""Package and render the Tripo pastry display with background Blender."""
import bpy, bmesh, json, hashlib, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/generated/pastry-display-20261028'
OUT=SOURCE/'final'
OUT.mkdir(exist_ok=True)

def inspect(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    result=dict(boundary_edges=sum(e.is_boundary for e in bm.edges),non_manifold_edges=sum(not e.is_manifold for e in bm.edges))
    bm.free()
    if any(result.values()):raise ValueError((obj.name,result))
    return result

bpy.ops.wm.read_factory_settings(use_empty=True)
source=SOURCE/'retry/clean/model.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    # Six inspected source flaps have two loose edges and share their third
    # edge with two legitimate faces. Remove extras without filling holes.
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    flaps=[f for f in bm.faces if f.calc_area()<.00011 and sum(e.is_boundary for e in f.edges)==2 and any(len(e.link_faces)==3 for e in f.edges)]
    assert len(flaps)==6,'Source no longer matches inspected repair'
    bmesh.ops.delete(bm,geom=flaps,context='FACES')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    # Source front is +X; export front faces glTF +Z (Blender -Y).
    obj.data.transform(Matrix.Rotation(-math.pi/2,4,'Z'))
    for polygon in obj.data.polygons:polygon.use_smooth=True
    # Imported split normals refer to the pre-reduction geometry. Recompute
    # them after repair instead of retaining facets from collapsed triangles.
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    inspect(obj)
for img in bpy.data.images:
    if img.type=='IMAGE' and img.size[0]:img.scale(1024,1024);img.pack()
for material in bpy.data.materials:
    if not material.use_nodes:continue
    # Use smooth geometric normals for the compact prop. Retain PBR color and
    # roughness; omitting the source normal map also saves texture bandwidth.
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':
            for link in list(node.inputs['Normal'].links):material.node_tree.links.remove(link)
out=OUT/'cafe-pastry-display.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=90)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
topology=[inspect(o) for o in meshes]
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
assert triangles<=6000 and out.stat().st_size<=1024*1024,(triangles,out.stat().st_size)
raw=json.loads((SOURCE/'retry/raw/model.glb.provenance.json').read_text())
report=dict(id=22,path='models/'+out.name,triangles=triangles,bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),topology=topology,provider='Tripo3D',task_id=raw['task_id'],request=raw['request'],reference_notes=json.loads((SOURCE/'references/pastry-display.json').read_text()),cleanup=json.loads(source.with_suffix('.glb.qa.json').read_text()),preparation='Seam-welded before reduction; 0.55m height, 1024px JPEG textures; exact export reimported and checked.',rights='Account entitlement not independently verified; generation and integration requested by owner.')
report['repair']='Removed six inspected superfluous source flaps, each below 0.00011 square metres, sharing an edge with two legitimate faces. No hole filling.'
report['shading']='Recomputed smooth geometric normals; omitted source tangent-space normal map for compact delivery; PBR base color and roughness retained. Some close-up faceting remains from geometry reduction.'
(OUT/'cafe-pastry-display-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print('PACKAGED',triangles,out.stat().st_size,flush=True)

# Review final export without replacing its materials.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral review');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.55,.55,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
light=bpy.data.lights.new('Softbox','AREA');light.energy=350;light.size=4
lamp=bpy.data.objects.new('Softbox',light);scene.collection.objects.link(lamp);lamp.location=(2,-3,4)
camera=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',camera);scene.collection.objects.link(cam)
camera.type='ORTHO';camera.ortho_scale=1.25;scene.camera=cam;scene.view_settings.view_transform='Standard'
for label,pos in [('front',(0,-3,1.4)),('rear',(0,3,1.4)),('left',(-3,0,1.4)),('right',(3,0,1.4)),('top',(0,-.01,4)),('underside',(0,-.01,-4))]:
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.275))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'review-{label}.png');bpy.ops.render.render(write_still=True)
print('REVIEW COMPLETE',flush=True)
