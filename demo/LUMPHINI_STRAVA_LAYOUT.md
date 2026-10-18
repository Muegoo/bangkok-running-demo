# Lumphini: main and inner running loops

Open `demo/LumphiniStravaLayout.rbxlx`. This is the current version matching the two park circuits selected from the user's Strava screenshot. It opens in daylight with an overview camera. Press F5 to run, WASD to move, right-drag to look, and V to switch close-follow/eye view. Speed remains 20 studs/second at the prototype scale of 2 studs/meter.

The main circuit includes the interior lake-side bend and diagonal. A new 684 m connector joins the western junction to the southern bend via the south side of Palm Hill Circle and the eastern curve of the inner circuit. The main lap is approximately 2.59 km; the inner lap, including its shared portion of the main lap, is approximately 1.08 km. The distinct network contains approximately 3.28 km of paths. The surrounding street circuit is excluded.

These are visual selections on connected OpenStreetMap paths. The input screenshot is not a GPS trace, so dimensions, precise branch selection and lap distances remain approximate. Its colors do not provide numeric activity counts. The screenshot stays in the local reference gallery; it is not embedded as a Roblox texture. Trees, lamps, widths and other scenery remain original artistic approximations. Ground and ponds across the park are filled from OSM for spatial context; only the selected running corridors receive road models.

Review:

- The optional local comparison gallery is generated only when a reference screenshot is supplied; personal source screenshots are excluded from this repository.
- `previews/lumphini-strava-layout.svg` / `.png`: orange main circuit, teal interior connector; white junctions.
- `previews/lumphini-strava-overview.jpg`: native Studio overview.
- `data/processed/lumphini-strava-layout.geojson`: main loop, new connector and complete inner lap, with OSM source way IDs.
- `data/processed/lumphini-strava-validation.json`: topology, distances, mesh dimensions and artifact checks.
- `data/processed/lumphini-strava-qa.json`: native Studio checks and limitations.

Existing user-saved places are preserved. This new filename avoids the earlier perimeter-only files being confused with the two-loop layout. Mesh sizing uses `InitialSize`, which is Roblox's serialized form of `MeshSize`.

Rebuild from the project root:

```powershell
node scripts/build-lumphini-strava-routes.mjs
node scripts/build-lumphini-loop-demo.mjs --network data/processed/lumphini-strava-layout.geojson --output demo/LumphiniStravaLayout.rbxlx --prefix lumphini-strava --overview
node scripts/validate-lumphini-strava.mjs
```

To replace the local screenshot reference, pass its path as the first argument to `build-lumphini-strava-routes.mjs`. Visual checkpoints still need review; replacing an image does not automatically change the selected paths.

Map data © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright . Route geometry and source way IDs are included. The original generated tree asset is documented in `roblox/assets/RainTree.json`; access may need to be granted when publishing under a different account or group.
