import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=JSON.parse(await readFile('data/processed/lumphini-strava-scene.json','utf8'));
const scene=JSON.parse(await readFile('data/processed/lumphini-detail-scene.json','utf8'));
const build=JSON.parse(await readFile('data/processed/lumphini-detail-build.json','utf8'));
const network=await readFile('data/processed/lumphini-strava-layout.geojson','utf8');
const road=s=>s.parts.filter(p=>p.name==='RunAsphalt').map(p=>({position:p.position,size:p.size,yaw:p.yaw,canCollide:p.canCollide,material:p.material}));
assert.deepEqual(road(scene),road(base),'Approved running road geometry changed');
assert.deepEqual(scene.waypoints,base.waypoints,'Approved main route changed');
assert.deepEqual(scene.additionalRoutes,base.additionalRoutes,'Approved inner connector changed');
for(const p of scene.parts){
 assert.ok(p.position.every(Number.isFinite)&&p.size.every(n=>Number.isFinite(n)&&n>0),'Invalid geometry '+p.name);
 if(p.matrix)assert.ok(p.matrix.length===9&&p.matrix.every(Number.isFinite),'Invalid transform '+p.name);
 if(p.className==='MeshPart')assert.ok(p.meshSize.every(n=>Number.isFinite(n)&&n>0),'Invalid mesh dimensions '+p.name);
}
const xml=await readFile(build.artifact,'utf8');
assert.equal(createHash('sha256').update(xml).digest('hex'),build.sha256);
assert.equal((xml.match(/class="(?:Part|MeshPart|WedgePart)"/g)||[]).length+1,build.partCount);
assert.equal((xml.match(/<Vector3 name="InitialSize">/g)||[]).length,scene.parts.filter(p=>p.className==='MeshPart').length);
assert.ok(!/streetviewpixels|googleusercontent|NaN|Infinity|<Vector3 name="MeshSize">/.test(xml));
assert.ok(xml.includes('<string name="Name">ParkLighting</string>'));
const result={checkedAt:new Date().toISOString(),status:'passed_route_preservation_geometry_and_artifact_checks',artifact:build.artifact,artifactSha256:build.sha256,approvedRouteFileSha256:createHash('sha256').update(network).digest('hex'),approvedRoadSegments:road(scene).length,mainAndInnerWaypointsUnchanged:true,partCount:build.partCount,detailCounts:scene.info.detailPass,limits:'Scenery is an artistic approximation; no complete Street View survey or mobile performance certification.'};
await writeFile('data/processed/lumphini-detail-validation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,partCount:result.partCount,roadSegments:result.approvedRoadSegments,routeUnchanged:result.mainAndInnerWaypointsUnchanged}));
