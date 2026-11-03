"""Package the Tripo plant set from reviewed, seam-welded cleanup outputs.
Run in background Blender. Final drafts are reimported and rendered before promotion.
"""
import bpy, bmesh, json, hashlib, math
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/generated/plants-20261028'
OUT=SOURCE/'final'
OUT.mkdir(exist_ok=True)
NAMES=['snake','rubber','jade','monstera','terracotta','oat','sage']

def inspect(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    result={'boundary_edges':sum(e.is_boundary for e in bm.edges),
            'non_manifold_edges':sum(not e.is_manifold for e in bm.edges)}
    bm.free()
    if any(result.values()):raise ValueError((obj.name,result))
    return result

reports=[]
for index,name in enumerate(NAMES):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source=SOURCE/name/'budget/model.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in meshes:
        obj.data.transform(obj.matrix_world);obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    points=[v.co for o in meshes for v in o.data.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)])
    hi=Vector([max(p[i] for p in points) for i in range(3)])
    origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    # Stay inside the existing half-metre placement cell. Keep authored height.
    width=max(hi.x-lo.x,hi.y-lo.y)
    horizontal=min(1,.46/width) if index<4 else .38/width
    repairs=[]
    for obj in meshes:
        for v in obj.data.vertices:
            v.co-=origin;v.co.x*=horizontal;v.co.y*=horizontal
        obj.data.update()
        if name=='sage':
            # Reviewed source defect: a ~1 mm² flap on the rim shares an edge
            # with two legitimate surface faces. Remove only that extra face.
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8)
            flaps=[f for f in bm.faces if f.calc_area()<2e-6 and sum(e.is_boundary for e in f.edges)==2 and any(len(e.link_faces)>2 for e in f.edges)]
            if len(flaps)!=1:raise ValueError('Sage rim repair no longer matches the inspected source')
            bmesh.ops.delete(bm,geom=flaps,context='FACES')
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
            repairs.append('Removed one inspected superfluous rim flap, area under 2e-6 square metres; no hole filling.')
        inspect(obj)
    for img in bpy.data.images:
        if img.type=='IMAGE' and img.size[0]:img.scale(512,512);img.pack()
    filename=f'cafe-{"plant" if index<4 else "pot"}-{name}.glb'
    out=OUT/filename
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,
        export_animations=False,export_image_format='JPEG',export_jpeg_quality=90)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(out))
    exported=[o for o in bpy.context.scene.objects if o.type=='MESH']
    topology=[inspect(o) for o in exported]
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in exported)
    assert triangles<=3000 and out.stat().st_size<=1024*1024,(name,triangles,out.stat().st_size)
    raw=SOURCE/name/('raw-network' if name=='snake' else 'raw')/'model.glb.provenance.json'
    prov=json.loads(raw.read_text())
    reports.append(dict(name=name,id=15+index,path='models/'+filename,triangles=triangles,
        bytes=out.stat().st_size,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
        texture_size=512,topology=topology,repairs=repairs,provider='Tripo3D',task_id=prov['task_id'],
        request=prov['request'],reference_notes=json.loads((SOURCE/'references'/f'{name}.json').read_text()),
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        cleanup=json.loads(source.with_suffix('.glb.qa.json').read_text()),
        preparation='Seams welded before reduction; width fitted to placement cell; embedded 512px JPEG textures; final export reimported with closed manifold surfaces.',
        rights='Account entitlement not independently verified; generation and integration requested by owner.'))
    print('PACKAGED',name,triangles,out.stat().st_size,flush=True)
(OUT/'cafe-plants-provenance.json').write_text(json.dumps(reports,indent=2)+'\n')

# Inspect the exact final GLBs from six directions, with no material replacement.
bpy.ops.wm.read_factory_settings(use_empty=True)
roots=[]
for i,report in enumerate(reports):
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/Path(report['path']).name))
    imported=set(bpy.context.scene.objects)-before
    root=bpy.data.objects.new(report['name'],None);bpy.context.collection.objects.link(root)
    for obj in imported:
        if not obj.parent:obj.parent=root
    root.location=((i%4-1.5)*1.05,(i//4)*1.15,0)
    roots.append(root)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral review');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.55,.55,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
light=bpy.data.lights.new('Softbox','AREA');light.energy=450;light.shape='DISK';light.size=5
lamp=bpy.data.objects.new('Softbox',light);scene.collection.objects.link(lamp);lamp.location=(-2,-3,5)
camera=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camera);scene.collection.objects.link(cam)
cam.location=(0,-5,4);cam.rotation_euler=(Vector((0,.55,.3))-cam.location).to_track_quat('-Z','Y').to_euler()
camera.type='ORTHO';camera.ortho_scale=4.6;scene.camera=cam
scene.view_settings.view_transform='Standard'
for label,angles in [('front',(0,0,0)),('rear',(0,0,math.pi)),('left',(0,0,math.pi/2)),('right',(0,0,-math.pi/2)),('top',(math.pi/3,0,0)),('underside',(-math.pi/2,0,0))]:
    for root in roots:root.rotation_euler=angles
    scene.render.filepath=str(OUT/f'review-{label}.png');bpy.ops.render.render(write_still=True)
print('REVIEW COMPLETE',flush=True)
