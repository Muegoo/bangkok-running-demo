import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Observations are exported from actual native MCP responses, not fabricated test results.
const observed=JSON.parse(await readFile('.cache/experience-observations.json','utf8'));
const summary=JSON.parse(await readFile('data/processed/summary.json','utf8'));
assert.equal(observed.partCount,summary.partCount);
assert.ok(Object.values(observed.scriptParity).every(Boolean));
for(const run of [observed.lumphiniRun,observed.benjakittiRun]){
  assert.equal(run.speed,20);assert.ok(run.distance>=28&&run.distance<=32);assert.equal(run.seconds,3);
}
assert.equal(observed.returnToLumphini.distance,0);
assert.equal(observed.returnToLumphini.seconds,0);
assert.equal(observed.firstPerson.head,1);
assert.equal(observed.firstPerson.first,true);
assert.equal(observed.lightSwitch.lumphiniEnabled,0);
assert.equal(observed.lightSwitch.benjakittiEnabled,19);
assert.equal(observed.reopenedLighting.compatibilityColorGrading,false);
assert.equal(observed.reopenedLighting.globalShadows,true);
assert.deepEqual(observed.gameScriptMessages,[]);
const demo=await readFile('demo/BangkokRunningDemo.rbxlx');
assert.equal(observed.testedDemoSha256,createHash('sha256').update(demo).digest('hex'),'Cached MCP observations belong to another build; rerun Studio checks.');
assert.deepEqual(await readFile('demo/BangkokRunningDemo-Evening.rbxlx'),demo);
try {
  const old=JSON.parse(await readFile('data/processed/studio-qa.json','utf8'));
  if(old.partCount===6975)await copyFile('data/processed/studio-qa.json','data/processed/studio-qa-v1.json');
}catch(e){if(e.code!=='ENOENT')throw e;}
const report={checkedAt:new Date().toISOString(),status:'passed',version:2,
  method:'Native Roblox Studio MCP; reopen saved XML, play, keyboard movement, actual HUD clicks, client/server inspection and viewport captures.',
  demoFile:'demo/BangkokRunningDemo.rbxlx',openedCopy:'demo/BangkokRunningDemo-Evening.rbxlx',demoSha256:createHash('sha256').update(demo).digest('hex'),
  ...observed,previews:['previews/lumphini-evening.jpg','previews/lumphini-eye-view.jpg','previews/benjakitti-evening.jpg'],
  scope:'Saved final XML reopened and played. Final script sources match local files. 3-second movement checks in both parks; park switching, counter reset, camera visibility and active-park lighting checked.',
  remaining:['Original artistic props and road widths are approximations, not a site survey.','Flat bridges and placeholder water/buildings; no verified full running lap.','No mobile performance benchmark.']};
await writeFile('data/processed/studio-qa.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,partCount:report.partCount,demoSha256:report.demoSha256}));
