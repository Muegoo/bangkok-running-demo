import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {project,distance} from './geometry.mjs';

const geo=JSON.parse(await readFile('data/processed/lumphini.geojson','utf8'));
const main=JSON.parse(await readFile('data/processed/lumphini-loop-candidate.geojson','utf8'));
const origin=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks.lumphini.originWgs84;
const ways=geo.features.filter(f=>f.properties.layer==='path'&&['pedestrian','footway','path'].includes(f.properties.highway)&&f.properties.foot!=='no'&&!['no','private'].includes(f.properties.access));
const key=p=>p.map(n=>n.toFixed(7)).join(','),edgeKey=(a,b)=>[a,b].sort().join('|');
const graph=new Map(),sourceWays=new Map();
for(const w of ways)for(const line of w.geometry.coordinates)for(let i=1;i<line.length;i++){
 const a=key(line[i-1]),b=key(line[i]);if(a===b)continue;
 for(const [k,p] of [[a,line[i-1]],[b,line[i]]])if(!graph.has(k))graph.set(k,{geo:p,p:project(p,origin),neighbors:new Set()});
 graph.get(a).neighbors.add(b);graph.get(b).neighbors.add(a);sourceWays.set(edgeKey(a,b),w.id);
}
const mainKeys=main.geometry.coordinates.map(key),mainNodes=new Set(mainKeys);
const nearest=(p,allowed=graph.keys())=>{let best,dist=Infinity;for(const k of allowed){const d=distance(project(p,origin),graph.get(k).p);if(d<dist){dist=d;best=k}}return best};
function shortest(a,b){
 const costs=new Map([[a,0]]),prev=new Map(),todo=new Set([a]);
 while(todo.size){let k;for(const n of todo)if(k===undefined||costs.get(n)<costs.get(k))k=n;todo.delete(k);if(k===b)break;
  for(const n of graph.get(k).neighbors){const c=costs.get(k)+distance(graph.get(k).p,graph.get(n).p);if(c<(costs.get(n)??Infinity)){costs.set(n,c);prev.set(n,k);todo.add(n)}}
 }
 assert.ok(costs.has(b),'Disconnected selected paths');const out=[b];while(out[0]!==a)out.unshift(prev.get(out[0]));return out;
}
// Visual checkpoints identify the western junction, the south arc of Palm Hill,
// and the curved eastern side of the inner loop visible in the user's screenshot.
const checkpoints=[[100.5388425,13.7303138],[100.5411009,13.7310125],[100.5417254,13.730915],[100.54260,13.7293],[100.5418466,13.7285489]];
const stops=checkpoints.map((p,i)=>nearest(p,i===0||i===checkpoints.length-1?mainNodes:graph.keys()));
const inner=[];for(let i=1;i<stops.length;i++)inner.push(...shortest(stops[i-1],stops[i]).slice(i===1?0:1));
assert.equal(new Set(inner).size,inner.length,'Inner connector doubles back');
assert.ok(inner.slice(1,-1).every(k=>!mainNodes.has(k)),'Connector crosses main loop before its endpoint');
const length=keys=>keys.slice(1).reduce((sum,k,i)=>sum+distance(graph.get(keys[i]).p,graph.get(k).p),0);
const waysFor=keys=>[...new Set(keys.slice(1).map((k,i)=>sourceWays.get(edgeKey(keys[i],k))))];
const mainOpen=mainKeys.slice(0,-1),from=mainOpen.indexOf(inner.at(-1)),to=mainOpen.indexOf(inner[0]);
const arc=step=>{const a=[mainOpen[from]];let i=from;while(i!==to){i=(i+step+mainOpen.length)%mainOpen.length;a.push(mainOpen[i])}return a};
const arcs=[arc(1),arc(-1)].sort((a,b)=>length(a)-length(b));
const innerLoop=inner.concat(arcs[0].slice(1));
assert.equal(innerLoop[0],innerLoop.at(-1));
assert.equal(new Set(innerLoop.slice(0,-1)).size,innerLoop.length-1);
function feature(id,keys,kind,render){return {type:'Feature',id,properties:{name:id,kind,render,lengthMeters:+length(keys).toFixed(2),sourceWays:waysFor(keys),geometrySource:'OpenStreetMap vertices and connected pedestrian edges',selectionSource:'User-supplied Strava screenshot; visual route selection, no Strava GPS/API data',status:'VISUAL MATCH — approximate; not a GPX trace'},geometry:{type:'LineString',coordinates:keys.map(k=>graph.get(k).geo)}}}
const features=[feature('MainLoop',mainKeys,'closed_loop',true),feature('InnerConnector',inner,'open_connector',true),feature('InnerLoop',innerLoop,'closed_loop',false)];
const unique=new Map();for(const ks of [mainKeys,inner])for(let i=1;i<ks.length;i++)unique.set(edgeKey(ks[i-1],ks[i]),distance(graph.get(ks[i-1]).p,graph.get(ks[i]).p));
const result={type:'FeatureCollection',properties:{createdAt:new Date().toISOString(),scope:'Main park running loop plus interior heart-shaped loop; excludes the surrounding street circuit.',userSelection:'Both outer and inner park loops',uniqueNetworkMeters:+[...unique.values()].reduce((a,b)=>a+b,0).toFixed(2),reference:'data/reference/lumphini-strava-user.png',accuracy:'Visual alignment to OSM; source screenshot is not georeferenced GPX and provides no numeric activity counts.',checkpointsWgs84:checkpoints,attribution:'© OpenStreetMap contributors',license:'ODbL-1.0'},features};
await mkdir('data/reference',{recursive:true});
if(process.argv[2])await copyFile(process.argv[2],'data/reference/lumphini-strava-user.png');
// An optional local screenshot is excluded from the public repository.
let hasReference=false;
try { await access('data/reference/lumphini-strava-user.png'); hasReference=true; } catch(error) { if(error.code!=='ENOENT')throw error; }
await writeFile('data/processed/lumphini-strava-layout.geojson',JSON.stringify(result,null,2));
const bounds=geo.features.filter(f=>f.properties.layer==='park').flatMap(f=>f.geometry.coordinates).flat(2).map(p=>project(p,origin));
const minX=Math.min(...bounds.map(p=>p[0])),minY=Math.min(...bounds.map(p=>p[1])),maxX=Math.max(...bounds.map(p=>p[0])),maxY=Math.max(...bounds.map(p=>p[1]));
const scale=Math.min(790/(maxX-minX),760/(maxY-minY));
const xy=p=>{const [x,y]=project(p,origin);return[70+(x-minX)*scale,170+(y-minY)*scale]};
const line=ps=>ps.map((p,i)=>(i?'L':'M')+xy(p).join(',')).join(' ');
const context=geo.features.filter(f=>['park','water'].includes(f.properties.layer)).map(f=>`<path d="${f.geometry.coordinates.flatMap(poly=>poly.map(r=>line(r)+'Z')).join(' ')}" fill="${f.properties.layer==='park'?'#2d5843':'#225570'}" fill-rule="evenodd"/>`).join('');
const network=ways.map(f=>`<path d="${f.geometry.coordinates.map(line).join(' ')}" fill="none" stroke="#9bb6a5" stroke-width="1" opacity=".45"/>`).join('');
const routeSvg=features.filter(f=>f.properties.render).map(f=>`<path d="${line(f.geometry.coordinates)}" fill="none" stroke="${f.id==='MainLoop'?'#ff9b40':'#74e8d2'}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const junctions=[inner[0],inner.at(-1)].map(k=>{const p=xy(graph.get(k).geo);return `<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#fff"/>`}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="940" height="1100"><rect width="100%" height="100%" fill="#10271f"/><g font-family="Tahoma,Arial" fill="#edf5e8"><text x="50" y="50" font-size="27">สวนลุมพินี · วงรอบใหญ่ + วงด้านใน</text><text x="50" y="85" font-size="17">แนวทางจากภาพที่คุณส่ง · ใช้พิกัดทางเดิน OSM · ยังไม่ใช่ GPX</text><text x="50" y="118" font-size="17" fill="#ffad65">สีส้ม: วงรอบใหญ่ ${(features[0].properties.lengthMeters/1000).toFixed(2)} กม.</text><text x="440" y="118" font-size="17" fill="#74e8d2">สีเขียว: ทางเชื่อมเพิ่มวงด้านใน</text>${context}${network}${routeSvg}${junctions}<text x="50" y="985" font-size="17">วงด้านในรวมช่วงที่ใช้ร่วมกับวงใหญ่: ${(features[2].properties.lengthMeters/1000).toFixed(2)} กม.</text><text x="50" y="1016" font-size="16">ระยะเป็นค่าประมาณจาก OSM · ไม่รวมถนนรอบนอกสวน</text><text x="50" y="1050" font-size="15">Map data © OpenStreetMap contributors · ODbL 1.0</text></g></svg>`;
await writeFile('previews/lumphini-strava-layout.svg',svg);
const html=`<!doctype html><html lang="th"><meta charset="utf-8"><title>สวนลุม · เปรียบเทียบแนววิ่ง</title><style>body{margin:0;background:#10271f;color:#eef5ea;font:17px Tahoma}header{padding:20px}main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}img{width:100%;height:auto}h2{font-size:19px}p{line-height:1.6}@media(max-width:900px){main{grid-template-columns:1fr}}</style><header><h1>สวนลุมพินี · เทียบแนววิ่งสองวง</h1><p>ซ้าย: ภาพที่คุณส่ง · ขวา: แนวที่เลือกบนพิกัด OSM<br>สีส้มเป็นวงใหญ่ สีเขียวเป็นทางเชื่อมที่เพิ่มวงด้านใน ไม่มีการใส่ภาพ Strava เป็นพื้นผิวในเกม</p></header><main><section><h2>ภาพอ้างอิง</h2><img src="../data/reference/lumphini-strava-user.png"></section><section><h2>ผังสำหรับสร้างเกม</h2><img src="lumphini-strava-layout.svg"></section></main></html>`;
if(hasReference)await writeFile('previews/lumphini-strava-comparison.html',html);
console.log(JSON.stringify({uniqueNetworkMeters:result.properties.uniqueNetworkMeters,routes:features.map(f=>({name:f.id,meters:f.properties.lengthMeters,ways:f.properties.sourceWays}))},null,2));
