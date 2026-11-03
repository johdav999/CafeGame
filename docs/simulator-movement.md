# Stage 7: movement and interaction adapters

In Serve, click a visible barista to select them, then click an open floor
position to walk there. A selection panel confirms selection and reports busy
staff or unreachable destinations. Escape or Deselect clears selection; switching
tabs also clears it. Dragging still orbits the camera, and counter/machine clicks
still prepare orders. Touch taps use the same controls.

Manual destinations use the existing half-metre navigation graph, including its
furniture obstacles and corner clearance. Idle staff stay at the destination;
assigned café work takes priority and busy staff reject manual movement. Pause
freezes travel. Selection and manual positions are transient and reset on load,
scenario replacement or layout rebuild. They do not alter the save format.

`node tools/staff-move-smoke.cjs` exercises visible selection, floor clicks,
blocked cells, arrival, remaining at the destination, pause, deselection and
subsequent service on WebGL 2 and automatic backend selection.

Validation (2026-10-29): browser build passed, all 21 Node tests and seven native
CTest checks passed, and staff-move plus counter-click browser checks passed on
forced WebGL 2 and automatic selection in Edge. Movement evidence is saved under
`build/evidence/staff-move-*.png`. Physical mobile/touch-device acceptance was not run.

The browser creates a visible barista and guest using WebEngine primitives. Brew creates an Assigned job; the barista walks behind the counter to the machine before arrival commits beans and starts the three-second process. The guest walks from the entrance to the service point. Serve requires the guest to have arrived. Serving/cancelling sends the guest out and returns the barista home.

Movement reuses WebEngine PathFollower and CharacterMotorComponent. Two authored clear corridors use free movement, without dynamic collision avoidance. Layout changes must preserve these corridors until navigation surfaces/obstacle handling are integrated. Queue allocation and seating remain stage 8.

The portable engine/simulator/travel.hpp binding contains only simulator IDs and a host request sequence. The host binds tickets to scene-scoped actor handles and interaction points. Missing staff, blocked movement or cancellation report movementFailed; obsolete assignment/epoch responses cannot start production. Outbox backpressure retains completion for retry. No navigation pointer or actor is serialized.

Load resets scene navigation and clocks, then rebuilds pending travel against fresh handles. Assigned jobs travel again; already-running jobs resume without consuming inputs twice. Scene positions are reconstructed at safe authored points; exact poses are not saved. Pause/hidden-tab suspension advances neither travel nor production. The headless Simulation::brew(true) retains explicit immediate arrival for console/tests; the browser uses brew(false).

Tests cover arrival exactly once, stale response after load, a new host request on the same assignment, failed movement, cancellation cleanup and stock conservation. Browser checks exercise actual actor displacement, paused positions and the existing rendering/save/payment flow. See the validation results recorded below.

Validation (2026-10-25): complete cafe_game Wasm build passed. Cafe simulation CTest 1/1 passed; engine CTest 4/4 and 787 contracts passed in Node and Edge 156. The browser smoke passed forced WebGL 2 and automatic software fallback, including actual barista displacement, stationary actors during pause, assigned-travel save/cancel/load, mid-production restore, serving and no duplicate payment. Screenshots are in build/evidence. All four tooling tests and seven bundled-source hashes passed; JavaScript syntax checks passed. Native Windows/Linux, hardware WebGPU and physical mobile checks were not run. No engine renderer pin change, paid asset generation, commit or push was performed.
