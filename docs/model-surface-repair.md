# Generated model surface repair · 2026-10-27

The widespread speckled holes came from reducing disconnected glTF UV/normal
seam patches. The project preparation script ran collapse decimation without
first reconnecting coincident positions. The reduced patches pulled apart.
Two-sided materials, opaque solid materials and unlit materials did not repair
the holes. The shipped material culling settings have not been changed.

`tools/prepare-cafe-models.py` now welds positional seams at 1e-6 source units
while retaining per-corner UVs, recalculates normals, reduces, and rejects any
increase in boundary count or significant boundary length. It rebuilds from the
preserved source masters rather than attempting to fill the damaged exports.
All six generated static props were rebuilt within their original budgets.
Their hashes and topology measurements are in `assets/models/cafe-provenance.json`.

| Asset | Previous exported boundary edges | Repaired boundary edges |
| --- | ---: | ---: |
| Espresso machine | 8,286 | 0 |
| Espresso cup | 1,764 | 0 |
| Straight counter | 4,722 | 4 |
| Corner counter | 3,538 | 15 |
| Table | 2,730 | 0 |
| Chair | 3,124 | 2 |

Counts join coincident exported positions, so UV splits alone do not count as
holes. The small remaining counts also exist in the source masters; the repair
does not blindly fill intentional openings or thin details. Structural counts
are accompanied by visual review rather than treated as proof of perfect art.
`tests/cafe-models.test.mjs` checks these limits on the actual shipped GLBs.

The shared Tripo cleanup helper refuses reduction while coincident seam splits
remain, reports positional topology before/after reduction, and rejects boundary
growth. It keeps welding opt-in through `--merge-distance`, chosen for the source
scale. Its headless fixture proves that unsafe reduction is refused, source bytes
are preserved, and a welded reduction stays closed. The skill's surface-integrity
reference requires review after the last optimization/export and on both browser
backends; double-sided rendering is a diagnostic, not a universal repair.

Validation evidence: `build/evidence/model-seam-verified.log`,
`tripo-surface-tests.log`, `tripo-workflow-final.log`, `cafe-models-browser.json`,
`faces-*.png`, and `cafe-models-*.png`. Browser model checks use a 0.5 render scale
with unchanged CSS dimensions; this is asset-integrity coverage, not a hardware
performance or physical-mobile claim. No provider generation or charges occurred.
