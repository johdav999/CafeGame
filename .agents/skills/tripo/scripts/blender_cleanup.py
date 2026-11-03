"""Run only in headless Blender. Conservative static-mesh cleanup, not retopology."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import uuid
import bpy
import bmesh
from mathutils import Matrix, Vector


def stats(meshes):
    result = dict(objects=len(meshes), vertices=0, triangles=0, non_manifold_edges=0)
    for obj in meshes:
        obj.data.calc_loop_triangles()
        result['vertices'] += len(obj.data.vertices)
        result['triangles'] += len(obj.data.loop_triangles)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        result['non_manifold_edges'] += sum(not edge.is_manifold for edge in bm.edges)
        bm.free()
    return result


def surface_topology(mesh):
    """Inspect positional connectivity without changing UV/normal seam data."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    try:
        # A diagnostic-only weld distinguishes glTF attribute splits from holes.
        extent = max((max(v.co[i] for v in bm.verts)-min(v.co[i] for v in bm.verts)
                      for i in range(3)), default=1) if bm.verts else 1
        tolerance = max(1e-9, extent * 1e-8)
        count = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=tolerance)
        boundary = [e for e in bm.edges if e.is_boundary]
        return dict(seam_duplicates=count-len(bm.verts), boundary_edges=len(boundary),
                    boundary_length=sum(e.calc_length() for e in boundary),
                    non_manifold_edges=sum(not e.is_manifold for e in bm.edges),
                    tolerance=tolerance)
    finally:
        bm.free()


def validate_reduction(before, after):
    if after['boundary_edges'] > before['boundary_edges'] or after['boundary_length'] > before['boundary_length'] * 1.01 + before['tolerance'] * 10:
        raise ValueError('Reduction opened or enlarged surface boundaries. Retry from the raw source with a smaller reduction and a reviewed seam weld; do not hide holes with double-sided materials.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--height', type=float)
    parser.add_argument('--merge-distance', type=float, default=0)
    parser.add_argument('--decimate-ratio', type=float, default=1)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    output = args.output.resolve()
    source = args.input.resolve(strict=True)
    report_path = output.with_suffix('.glb.qa.json')
    if output.exists() or report_path.exists() or source == output:
        raise ValueError('Refusing to overwrite input, output or report')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() == '.glb':
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif source.suffix.lower() == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(source))
    else:
        raise ValueError('Input must be GLB or FBX')
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not meshes or any(obj.type == 'ARMATURE' or obj.animation_data for obj in bpy.context.scene.objects):
        raise ValueError('Cleanup requires static meshes; rigged/animated assets need a dedicated workflow')
    if any(obj.data.shape_keys or obj.modifiers for obj in meshes):
        raise ValueError('Shape keys or modifiers need a dedicated workflow')
    before = stats(meshes)
    topology = []
    worlds = {obj.name: obj.matrix_world.copy() for obj in meshes}
    for obj in meshes:
        world = worlds[obj.name]
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        if args.merge_distance > 0:
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=args.merge_distance)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-8)
        loose = [vert for vert in bm.verts if not vert.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        connected_before = surface_topology(obj.data)
        if args.decimate_ratio < 1:
            if connected_before['seam_duplicates']:
                raise ValueError('Reduction would collapse disconnected UV/normal seam patches. Choose a source-scale --merge-distance to reconnect coincident vertices before decimation, or omit reduction.')
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Requested reduction', 'DECIMATE')
            modifier.ratio = args.decimate_ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            connected_after = surface_topology(obj.data)
            validate_reduction(connected_before, connected_after)
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
            obj.data.update()
        topology.append(dict(object=obj.name, before_reduction=connected_before,
                             after_reduction=surface_topology(obj.data)))
    points = [v.co.copy() for obj in meshes for v in obj.data.vertices]
    if not points or not sum(len(obj.data.polygons) for obj in meshes):
        raise ValueError('No surface geometry remains')
    lower = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    upper = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    height = upper.z - lower.z
    if args.height and height <= 1e-8:
        raise ValueError('Cannot normalize a zero-height model')
    scale = args.height / height if args.height else 1.0
    offset = Vector(((lower.x + upper.x)/2, (lower.y + upper.y)/2, lower.z))
    for obj in meshes:
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - offset) * scale
        obj.data.update()
    after = stats(meshes)
    dimensions = (upper - lower) * scale
    report = dict(source=source.name, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  blender=bpy.app.version_string, created_at=datetime.now(timezone.utc).isoformat(),
                  before=before, after=after, scale_factor=scale,
                  dimensions_gltf_xyz=[dimensions.x, dimensions.z, dimensions.y],
                  merge_distance=args.merge_distance, decimate_ratio=args.decimate_ratio,
                  topology=topology,
                  materials=[m.name for m in bpy.data.materials],
                  textures=[dict(name=i.name, width=i.size[0], height=i.size[1]) for i in bpy.data.images if i.type == 'IMAGE'],
                  warnings=['Visual/material/usage-rights review still required.',
                            'Non-manifold counts include intentionally split UV/normal seams.',
                            'Open boundaries are reported, not automatically filled; hidden parts are not guessed.',
                            'Topology metrics are not visual acceptance. Reimport the final optimized export and inspect all sides in the target renderer.'])
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    temporary = output.with_name(output.stem + '.' + uuid.uuid4().hex + '.glb')
    try:
        bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', use_selection=True,
                                  export_yup=True, export_animations=False)
        data = temporary.read_bytes()
        report['output_sha256'] = hashlib.sha256(data).hexdigest()
        report['bytes'] = len(data)
        with output.open('xb') as stream:
            stream.write(data)
        with report_path.open('x', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2)
            stream.write('\n')
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
