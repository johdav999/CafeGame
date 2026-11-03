# Surface integrity before promotion

Inspect the raw, cleaned and final budgeted model separately. A later decimator,
transform, exporter or runtime import can invalidate an earlier visual review.

Confirmed CafeGame failure (2026-10-27): reducing unwelded Tripo meshes opened
1,764–8,286 positional boundary edges per asset. Disabling culling or textures
did not repair them. Welding coincident seams before reduction restored the
source boundary counts; the machine, cup and table returned to zero boundaries.

## Geometry preparation

- glTF stores separate vertices for different UVs or normals at the same position.
  Collapse-decimating those disconnected patches independently can pull their
  edges apart. Reconnect positional seams before reduction, retaining UVs on
  face corners; choose the merge tolerance relative to the source dimensions and
  thin details. Do not weld separate objects or close intentional gaps blindly.
- Record positional-connectivity boundaries before and after reduction. The
  cleanup helper reports this on a temporary diagnostic weld, alongside raw
  non-manifold counts. New/enlarged boundaries block export. Existing boundaries
  still need review: a cup opening or thin leaf may be intentional; random holes
  in cabinet fronts are not. Boundary metrics cannot prove absence of all holes,
  intersecting faces or damage to silhouette and UVs.
- Remove confirmed duplicate/coplanar faces, resolve inverted winding, and
  recalculate normals after final geometry edits. Preserve the raw model and
  rebuild from it when reduction fails; do not fill every boundary or remesh away
  handles, rims and other intended openings.

## Diagnose the symptom

Use reversible diagnostic variants, changing one property at a time:

1. Compare back-face culling with double-sided rendering. If faces return, check
   winding and thin surfaces. Use double-sided materials only where the intended
   surface requires them; they do not repair missing triangles or overlapping
   geometry.
2. Compare textured and opaque solid materials, then lit and unlit shading.
   This separates alpha/UV/normal-map issues and self-shadow artifacts from
   actual gaps. Check depth fighting and duplicate scene instances if defects
   change with camera distance. Diagnose the asset and runtime before declaring
   the provider or renderer at fault.
3. Inspect face orientation and positional connectivity in Blender, including
   the underside and rear. Keep deliberate transparency, openings and thin parts.

## Final exported asset acceptance

Reimport the exact final GLB after reduction and export. Orbit through front,
rear, sides, top and underside at close and normal gameplay distances. Inspect
silhouette, rims/legs/handles, UV seams and planar faces for gaps or flicker.
Then inspect that same asset in the target game with its actual materials,
transforms and lighting. For CafeGame/WebEngine, check both WebGPU and WebGL 2.
If a backend is unavailable, report the missing check instead of claiming it
passed. Do not use a two-sided or unlit diagnostic as the production fix unless
it is the intended material behavior.

Record hashes, topology/reduction settings, renderer, reviewed views and evidence
paths in provenance. A structural pass and a visual pass are separate results.
Do not submit a paid regeneration merely because local cleanup failed without
authorization for another provider job.
