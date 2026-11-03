"""Asset-specific repair of the reviewed Tripo bay, retaining its authored frame.
Remove three measured dangling fins and restore missing glazing at the six
identified apertures. Glass artwork is sampled from the original ImageGen
reference through UVs; no bitmap or architectural frame is synthesized.
"""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Matrix
root=Path(__file__).resolve().parents[1]/'assets/generated/window-wall-20261028'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(root/'master/model.glb'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
fins=[f for f in bm.faces if len(f.verts)==3 and sum(e.is_boundary for e in f.edges)==2 and any(len(e.link_faces)==3 for e in f.edges) and f.calc_area()<.002]
assert len(fins)==3,len(fins)
bmesh.ops.delete(bm,geom=fins,context='FACES_ONLY')
loose=[e for e in bm.edges if not e.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='EDGES')
assert all(e.is_manifold for e in bm.edges)
bmesh.ops.rotate(bm,verts=list(bm.verts),cent=(0,0,0),matrix=Matrix.Rotation(-math.pi/2,3,'Z'))
bm.normal_update()
# These measured rectangles are the six absent glazing centers, not the
# surrounding architectural opening or the oak frame/mullions.
def hole_region(point):
 return .23<abs(point.x)<.9 and any(a<point.z<b for a,b in [(1.63,2.06),(2.25,2.76),(2.95,3.46)])
tunnels=[f for f in bm.faces if hole_region(f.calc_center_median()) and .095<f.calc_center_median().y<.12]
assert tunnels
removed=len(tunnels);bmesh.ops.delete(bm,geom=tunnels,context='FACES_ONLY')
loose=[e for e in bm.edges if not e.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='EDGES')
pending=set(e for e in bm.edges if e.is_boundary);loops=[]
while pending:
 seed=pending.pop();edges={seed};vertices=set(seed.verts);stack=list(seed.verts)
 while stack:
  v=stack.pop()
  for e in v.link_edges:
   if e in pending:
    pending.remove(e);edges.add(e)
    for other in e.verts:
     if other not in vertices:vertices.add(other);stack.append(other)
 loops.append((edges,vertices))
stats=[{'edges':len(es),'bounds':[[min(v.co[k] for v in vs),max(v.co[k] for v in vs)] for k in range(3)]} for es,vs in loops]
(root/'glazing-loop-inspection.json').write_text(json.dumps(stats,indent=2))
assert len(loops)==12,stats
assert all(max(v.co.y for v in vs)-min(v.co.y for v in vs)<.12 for es,vs in loops),stats
glass=bpy.data.materials.new('Glazing - ImageGen sky reflection');glass.use_nodes=True
shader=glass.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.22;shader.inputs['Metallic'].default_value=0
reflection=bpy.data.images.load(str(root/'reference.png'));reflection.scale(1024,1024)
image=glass.node_tree.nodes.new('ShaderNodeTexImage');image.image=reflection
glass.node_tree.links.new(image.outputs['Color'],shader.inputs['Base Color'])
obj.data.materials.append(glass);glass_index=len(obj.data.materials)-1
uv=bm.loops.layers.uv.active
def glaze(face):
 face.material_index=glass_index
 for loop in face.loops:
  p=loop.vert.co
  x0,x1=(-1.35,-.06) if p.x<0 else (.06,1.35)
  z0,z1=(1.35,2.1) if p.z<2.1 else (2.1,2.85) if p.z<2.85 else (2.85,3.6)
  u=max(0,min(1,(p.x-x0)/(x1-x0)));v=max(0,min(1,(p.z-z0)/(z1-z0)))
  loop[uv].uv=(.335+.11*u,.71+.08*v)
caps=[]
for edges,vertices in loops:
 depth=sum(v.co.y for v in vertices)/len(vertices)
 for v in vertices:v.co.y=depth
 remaining=set(edges);faces=[]
 while remaining:
  edge=next(iter(remaining));path=[edge.verts[0]];walk=[];current=edge.verts[0]
  while True:
   choices=[e for e in current.link_edges if e in remaining and e not in walk]
   assert choices, 'Open contour'
   edge=choices[0];walk.append(edge);current=edge.other_vert(current)
   if current in path:
    start=path.index(current);cycle=path[start:];cycle_edges=walk[start:]
    assert len(cycle)>=3
    faces.append(bm.faces.new(cycle));remaining.difference_update(cycle_edges);break
   path.append(current)
 for f in faces:glaze(f)
 caps.extend(faces)
# Match the remaining cool-colored glass border to the same generated sky art.
original=obj.data.materials[0];bsdf=original.node_tree.nodes.get('Principled BSDF')
color_node=bsdf.inputs['Base Color'].links[0].from_node
albedo=color_node.image
if max(albedo.size)>1024:albedo.scale(1024,1024)
width,height=albedo.size; pixels=list(albedo.pixels)
for f in bm.faces:
 if f in caps:continue
 p=f.calc_center_median()
 if abs(p.x)>1.38 or not 1.34<p.z<3.62 or abs(f.normal.y)<.6:continue
 coord=sum((l[uv].uv for l in f.loops),start=__import__('mathutils').Vector((0,0)))/len(f.loops)
 index=(int(coord.y*(height-1))*width+int(coord.x*(width-1)))*4
 r,g,b=pixels[index:index+3]
 if b>=r*.99 and b>=g*.96 and g>=r*.98 and r+g+b>.7:glaze(f)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data)
assert all(e.is_manifold for e in bm.edges)
report={'removed_fins':len(fins),'removed_tunnel_faces':removed,'glazing_contours':stats,'glazing_caps':len(caps),'boundary_edges':sum(e.is_boundary for e in bm.edges),'non_manifold_edges':sum(not e.is_manifold for e in bm.edges)}
bm.free()
for texture in bpy.data.images:
 if max(texture.size)>1024:texture.scale(1024,1024)
out=root/'repaired/model.glb';out.parent.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_animations=False,export_image_format='JPEG',export_jpeg_quality=90)
(root/'repair-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)







