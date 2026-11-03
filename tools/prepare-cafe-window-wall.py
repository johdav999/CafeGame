"""Prepare the Tripo window bay, preserving reviewed UVs and closed surfaces.

Run with Blender --background --factory-startup --python this-file --
  --input assets/generated/.../master/model.glb --output assets/generated/.../candidate/model.glb
This writes a candidate and QA report, never promotes it automatically.
"""
import argparse
import bpy
import bmesh
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--triangles', type=int, default=18000)
parser.add_argument('--flip-front', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source, output = ROOT/args.input, ROOT/args.output
if output.exists():
    raise RuntimeError('Choose a new candidate output; preserve previous reviews')
output.parent.mkdir(parents=True, exist_ok=True)

def topology(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    result={'boundary_edges':sum(e.is_boundary for e in bm.edges),
            'non_manifold_edges':sum(not e.is_manifold for e in bm.edges)}
    bm.free();return result

def closed(obj):
    result=topology(obj)
    if any(result.values()):raise RuntimeError(f'Unexplained open/non-manifold surface: {result}')
    return result

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not objects or any(o.modifiers or o.data.shape_keys for o in objects):raise RuntimeError('Expected static Tripo meshes')
for obj in objects:closed(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join();obj=bpy.context.object
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
original_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
closed(obj)
if original_triangles>args.triangles:
    modifier=obj.modifiers.new('Reviewed connected-mesh reduction','DECIMATE')
    modifier.ratio=args.triangles/original_triangles;modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    closed(obj)
if args.flip_front:
    obj.data.transform(Matrix.Rotation(math.pi,4,'Z'))
points=[v.co.copy() for v in obj.data.vertices]
lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
size=hi-lo
# Blender Z is height, negative Y faces the cafe. The rear is 12 cm
# outside the floor edge; the sill projects 30 cm toward the interior.
for v in obj.data.vertices:
    v.co.x=(v.co.x-(lo.x+hi.x)/2)*4/size.x
    v.co.y=(v.co.y-hi.y)*.42/size.y+.12
    v.co.z=(v.co.z-lo.z)*4/size.z
    if abs(abs(v.co.x)-2)<.02:v.co.x=2 if v.co.x>0 else -2
# Flatten the generated plaster at repeated joining strips. Matching X alone
# leaves rippled front edges that read as cracks between otherwise closed bays.
for v in obj.data.vertices:
    if v.co.z>1.4 and v.co.y<-.18 and (abs(v.co.x)>1.5 or v.co.z>3.72):
        v.co.y=-.23
# Restore a consistent flat glazing surface through the residual blue border
# triangles as well as the repaired centers. Retain the original oak sash.
glass_index=next(i for i,m in enumerate(obj.data.materials) if m.name.startswith('Glazing'))
def pane(p):
    return .09<abs(p.x)<1.025 and any(a<p.z<b for a,b in [(1.50,2.12),(2.18,2.82),(2.90,3.58)])
for p in obj.data.polygons:
    center=sum((obj.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
    if pane(center) and -.065<center.y<0 and abs(p.normal.y)>.6:
        p.material_index=glass_index
for p in obj.data.polygons:
    if p.material_index!=glass_index:continue
    p.use_smooth=False
    for index in p.vertices:
        v=obj.data.vertices[index]
        if -.065<v.co.y<0:v.co.y=-.05 if v.co.y<-.03 else -.012
    for loop_index in p.loop_indices:
        v=obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
        obj.data.uv_layers.active.data[loop_index].uv=(.335+.11*min(1,max(0,(abs(v.x)-.09)/.94)),.71+.08*min(1,max(0,(v.z-1.5)/2.08)))
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-9)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
closed(obj)
# Imported custom normals describe the original rippled glazing. Replace those
# glass corner normals with the repaired plane normals before final export.
normals=[tuple(n.vector) for n in obj.data.corner_normals]
for p in obj.data.polygons:
    if p.material_index==glass_index:
        for index in p.loop_indices:normals[index]=tuple(p.normal)
obj.data.normals_split_custom_set(normals)
for image in bpy.data.images:
    if image.size[0]>1024 or image.size[1]>1024:
        scale=1024/max(image.size);image.scale(max(1,round(image.size[0]*scale)),max(1,round(image.size[1]*scale)))
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,
    export_animations=False,export_image_format='JPEG',export_jpeg_quality=90)
if output.stat().st_size>2*1024*1024:raise RuntimeError('Window wall exceeds the 2 MiB architecture budget')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(output))
exported=[o for o in bpy.context.scene.objects if o.type=='MESH']
checks=[closed(o) for o in exported]
triangles=sum(len(p.vertices)-2 for o in exported for p in o.data.polygons)
if triangles>24000:raise RuntimeError(f'Window wall exceeds 24k triangles: {triangles}')
report={'name':'window-wall','id':24,'path':'models/cafe-window-wall.glb','provider':'Tripo3D',
    'source':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,
    'source_triangles':original_triangles,'triangles':triangles,'topology':checks,
    'dimensionsMetres':[4,4,.42],'frontDirection':'+Z','backPlane':-.12,'sillFrontPlane':.30,
    'preparation':'Welded positional seams before reduction; scaled to 4m bay; planar joining ends; 1024px embedded JPEG textures; reimported surface checks.',
    'visual_review':'Pending Blender and actual game review; candidate only.'}
output.with_suffix('.qa.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
