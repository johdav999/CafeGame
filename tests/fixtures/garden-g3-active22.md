# Frozen G3 migration fixture

`garden-g3-active22.bin` was written by the completed G3 implementation before
G4 catalog changes (schema 22, content/rules 19, Garden version 3, core wire 1).
It contains four active visits with indoor/outdoor claims, three staff, 24 beans
and 3.00 paid wages. The opening checkpoint is included. It contains no summer
stock or cold station. Loading requires host-provided development ownership;
the bytes never grant access.

SHA-256: `bd5185b499bc8b54b55e6f3ee5e5001332a6ad43d18a3dbdacd921edff490abc`.

Keep the bytes unchanged. `cafe_summer_menu` embeds this fixture in Wasm and
loads the same bytes natively to verify catalog upgrade and restart.
