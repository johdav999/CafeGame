# Simulator follow-on roadmap

This records the staged plan agreed in the conversation after the v0.1 foundation, to keep future requests unambiguous. The original foundation stages 1-6 are in simulator-library-release-plan.md. Subsequent stages remain optional mechanisms around the core; game rules and balance belong to each consumer.

| Stage | Scope | Status |
| --- | --- | --- |
| 7 | Movement and interaction adapters, guarded arrival/cancellation and restore rebinding | Implemented |
| 8 | Queues, seating and occupancy | Implemented |
| 9 | Task workflows and staff scheduling | Implemented |
| 10 | Supply and restocking | Implemented |
| 11 | Operating economy: ledger, purchases and wages | Implemented |
| 12 | Quality and maintenance: freshness, quality, cleanliness, wear and repair tasks | Implemented; see simulator-quality.md |
| 13 | Placement and layout: footprints, snapping, validation, interaction clearance, move/sell and navigation updates | Implemented; see simulator-layout.md |
| 14 | Customer demand and satisfaction: preferences, arrivals, patience, satisfaction inputs and saved seeded randomness | Implemented; see simulator-demand.md |
| 15 | Authoring and diagnostics: definitions, scenarios, inspectors, explanations and balancing reports | Implemented; see simulator-authoring.md |
| 16 | Compatibility and scale: explicit migrations/content versions, performance and long stress/replay checks | Implemented; see simulator-compatibility.md |
| 17 | Expanded menu and visible multi-item order tickets | Implemented; see game-menu.md |
| 18 | Hireable staff and concurrent service | Implemented; see game-staff.md |
| 19 | Daily shifts, objectives and returning regulars | Planned; see game-milestones.md |
| 20 | Equipment upgrades and cafe customization | Planned; see game-milestones.md |
| 21 | Art, audio, accessible onboarding and first playable release | Planned; see game-milestones.md |

Implemented source and local checks are distinct from release acceptance. Native Windows/Linux, exact cross-platform parity, full consumer cloud validation, hardware WebGPU and physical mobile acceptance need evidence for the final revision. Existing dated validation reports record what has actually run.

Stages 17-21 expand CafeGame's player-facing content on the existing simulator
foundation. Their scope, dependencies and acceptance criteria are in
[the next five game milestones](game-milestones.md). Stages 17-18 are implemented; stages 19-21 remain plans. These documents do not
authorize paid asset generation.
