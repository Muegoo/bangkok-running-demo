import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {project,distance} from './geometry.mjs';
const net=JSON.parse(await readFile('data/processed/lumphini-strava-layout.geojson','utf8'));
const geo=JSON.parse(await readFile('data/processed/lumphini.geojson','utf8'));
const scene=JSON.parse(await readFile('data/processed/lumphini-strava-scene.json','utf8'));
const build=JSON.parse(await readFile('data/processed/lumphini-strava-build.json','utf8'));
const origin=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks.lumphini.originWgs84;
const key=p=>p.map(n=>n.toFixed(7)).join(','),edge=(a,b)=>[key(a),key(b)].sort().join('|');
const source=new Map();
for(const f of geo.features.filter(f=>f.properties.layer==='path'&&['pedestrian','footway','path'].includes(f.properties.highway)&&f.properties.foot!=='no'&&!['no','private'].includes(f.properties.access)))for(const line of f.geometry.coordinates)for(let i=1;i<line.length;i++){
 const k=edge(line[i-1],line[i]);if(!source.has(k))source.set(k,new Set());source.get(k).add(f.id);
}
for(const f of net.features){
 const coords=f.geometry.coordinates;assert.ok(coords.flat().every(Number.isFinite));
 if(f.properties.kind==='closed_loop'){assert.deepEqual(coords[0],coords.at(-1));assert.equal(new Set(coords.slice(0,-1).map(key)).size,coords.length-1)}
 let length=0;for(let i=1;i<coords.length;i++){
  const ways=source.get(edge(coords[i-1],coords[i]));assert.ok(ways&&f.properties.sourceWays.some(w=>ways.has(w)),'Unverified OSM edge');
  length+=distance(project(coords[i-1],origin),project(coords[i],origin));
 }
 assert.ok(Math.abs(length-f.properties.lengthMeters)<.01,'Incorrect route length');
}
const main=net.features.find(f=>f.id==='MainLoop'),connector=net.features.find(f=>f.id==='InnerConnector');
const mainNodes=new Set(main.geometry.coordinates.map(key));
assert.ok(mainNodes.has(key(connector.geometry.coordinates[0]))&&mainNodes.has(key(connector.geometry.coordinates.at(-1))),'Disconnected connector');
assert.equal(scene.additionalRoutes.length,1);
const xml=await readFile(build.artifact,'utf8');assert.equal(createHash('sha256').update(xml).digest('hex'),build.sha256);
assert.equal((xml.match(/class="(?:Part|MeshPart)"/g)||[]).length+1,build.partCount);
const meshes=scene.parts.filter(p=>p.className==='MeshPart');assert.equal((xml.match(/<Vector3 name="InitialSize">/g)||[]).length,meshes.length);
assert.ok(meshes.every(p=>p.meshSize.every(n=>Number.isFinite(n)&&n>0)));
assert.ok(!/googleusercontent|streetviewpixels|<Vector3 name="MeshSize">|NaN|Infinity/.test(xml));
assert.ok(!xml.includes('data/reference/lumphini-strava-user.png'),'Screenshot must not become a Roblox texture');
const result={checkedAt:new Date().toISOString(),status:'passed_osm_topology_and_artifact_checks',artifact:build.artifact,partCount:build.partCount,treeMeshParts:meshes.length,routes:net.features.map(f=>({id:f.id,meters:f.properties.lengthMeters})),connectorJoinsMainAtBothEnds:true,stravaInput:'User-supplied screenshot; visually matched, not a georeferenced GPS trace',limits:'Does not certify GPS accuracy, numeric popularity, full-lap playability, or mobile performance.'};
await writeFile('data/processed/lumphini-strava-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
