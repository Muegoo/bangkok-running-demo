import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const qa=JSON.parse(await readFile('data/processed/lumphini-strava-qa.json','utf8'));
const build=JSON.parse(await readFile('data/processed/lumphini-strava-build.json','utf8'));
const digest=createHash('sha256').update(await readFile(build.artifact)).digest('hex');
assert.equal(digest,qa.artifactSha256,'Published place differs from the recorded Studio QA artifact');
assert.equal(digest,build.sha256,'Published place differs from the build manifest');
const net=JSON.parse(await readFile('data/processed/lumphini-strava-layout.geojson','utf8'));
assert.equal(net.type,'FeatureCollection');
for(const feature of net.features){
  assert.ok(feature.properties.sourceWays.length>0);
  assert.ok(feature.geometry.coordinates.flat().every(Number.isFinite));
}
console.log(`Published place matches recorded Studio QA: ${digest}`);
