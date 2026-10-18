import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inside,clipSegment,distance,stitchRings} from './geometry.mjs';

// Exercise actual edge cases: a line crossing both a polygon boundary and an island/hole.
const square=[[0,0],[10,0],[10,10],[0,10],[0,0]], hole=[[4,4],[6,4],[6,6],[4,6],[4,4]];
assert.equal(inside([5,5],[[square,hole]]),false);
assert.equal(inside([2,5],[[square,hole]]),true);
const segments=clipSegment([-5,5],[15,5],[[square,hole]]);
assert.equal(segments.length,2);
assert.ok(Math.abs(segments.reduce((n,s)=>n+distance(...s),0)-8)<1e-8);
assert.equal(stitchRings([[[0,0],[1,0]],[[1,1],[1,0]],[[1,1],[0,0]]])[0].length,4);

const summary=JSON.parse(await readFile('data/processed/summary.json','utf8'));
const config=JSON.parse(await readFile('data/processed/park-config.json','utf8'));
const checks=[];
for(const park of summary.parks) {
  const geo=JSON.parse(await readFile(`data/processed/${park.id}.geojson`,'utf8'));
  const raw=JSON.parse(await readFile(`data/raw/${park.id}.osm.json`,'utf8'));
  const sourceIds=new Set(raw.elements.map(e=>`${e.type}/${e.id}`));
  assert.equal(geo.type,'FeatureCollection');
  assert.ok(geo.features.length>0);
  assert.equal(new Set(geo.features.map(f=>f.id)).size,geo.features.length,'Duplicate GeoJSON IDs');
  const walk=(value)=>{
    if(typeof value[0]==='number') {
      assert.equal(value.length,2);
      assert.ok(value.every(Number.isFinite));
      assert.ok(value[0]>100.53&&value[0]<100.57&&value[1]>13.72&&value[1]<13.74,'Unexpected geographic extent');
    } else for(const child of value) walk(child);
  };
  for(const feature of geo.features) {
    assert.ok(sourceIds.has(feature.id),`Unknown source ${feature.id}`);
    walk(feature.geometry.coordinates);
    if(feature.geometry.type==='MultiPolygon') for(const polygon of feature.geometry.coordinates) for(const ring of polygon) {
      assert.ok(ring.length>=4);
      assert.deepEqual(ring[0],ring.at(-1));
    }
  }
  const paths=geo.features.filter(f=>f.properties.layer==='path');
  assert.equal(paths.length,park.stats.pathWays);
  assert.equal(geo.features.filter(f=>f.properties.layer==='water').length,park.stats.waterFeatures);
  assert.ok(config.parks[park.id].spawn.every(Number.isFinite));
  assert.ok(paths.some(f=>!['private','no'].includes(f.properties.access) && f.properties.foot!=='no'));
  checks.push({park:park.id,features:geo.features.length,pathWays:paths.length,sourceElements:raw.elements.length});
}
const xml=await readFile('demo/BangkokRunningDemo.rbxlx','utf8');
assert.ok(!/\b(?:NaN|Infinity)\b/.test(xml));
assert.equal((xml.match(/class="Part"/g)||[]).length+1,summary.partCount);
assert.equal((xml.match(/class="SpawnLocation"/g)||[]).length,1);
for(const name of ['ParkConfig','SelectPark','RunServer','RunHud']) assert.ok(xml.includes(`>${name}</string>`));
let enginePlaytest='Not recorded. See studio-qa.json when a live Studio test has been run.';
try {
  const qa=JSON.parse(await readFile('data/processed/studio-qa.json','utf8'));
  const digest=createHash('sha256').update(await readFile('demo/BangkokRunningDemo.rbxlx')).digest('hex');
  enginePlaytest=qa.demoSha256===digest?`Passed live Studio MCP checks; scope and details in studio-qa.json (${qa.checkedAt}).`:'Existing Studio QA is for a different demo artifact; rerun gameplay checks.';
}catch(error){if(error.code!=='ENOENT')throw error}
const report={checkedAt:new Date().toISOString(),geometryChecks:'Passed polygon-hole clipping, reversed ring assembly, finite coordinates, closed polygons, OSM source IDs, feature counts and spawn configuration.',parks:checks,partCount:summary.partCount,enginePlaytest};
await writeFile('data/processed/validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
