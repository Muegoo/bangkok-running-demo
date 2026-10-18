import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {project,inside,distance} from './geometry.mjs';
import {buildScenery} from './scenery.mjs';
import {sceneXml} from './scene-xml.mjs';
import {xmlWriter} from './roblox-xml.mjs';
import {applyMeshTrees} from './mesh-trees.mjs';
import {applyParkDetails} from './scenery-details.mjs';
const argument=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1]};
const networkFile=argument('--network'),outputFile=argument('--output');
if(networkFile&&!outputFile)throw Error('Network builds require an explicit --output to preserve saved places');
const network=networkFile?JSON.parse(await readFile(networkFile,'utf8')):null;
const route=network?network.features.find(f=>f.id==='MainLoop'):JSON.parse(await readFile('data/processed/lumphini-loop-candidate.geojson','utf8'));
const innerRoutes=network?network.features.filter(f=>f.properties.render&&f.id!=='MainLoop'):[];
const prefix=argument('--prefix')||'lumphini-loop';
const overview=process.argv.includes('--overview');
const detailed=process.argv.includes('--details');
if(detailed&&!outputFile)throw Error('Detailed builds require an explicit --output');
const geo=JSON.parse(await readFile('data/processed/lumphini.geojson','utf8'));
const origin=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks.lumphini.originWgs84;
const polys=f=>f.geometry.coordinates.map(rings=>rings.map(r=>r.map(p=>project(p,origin))));
const bounds=geo.features.filter(f=>f.properties.layer==='park').flatMap(polys);
const waters=geo.features.filter(f=>f.properties.layer==='water').map(f=>({local:polys(f)}));
const buildings=geo.features.filter(f=>f.properties.layer==='building').map(f=>({local:polys(f)}));
const points=route.geometry.coordinates.map(p=>project(p,origin));
const segments=points.slice(1).map((p,i)=>[points[i],p]);
const flat=bounds.flat(2),extent=[Math.min(...flat.map(p=>p[0])),Math.min(...flat.map(p=>p[1])),Math.max(...flat.map(p=>p[0])),Math.max(...flat.map(p=>p[1]))];
const map={id:'lumphini',offset:[0,0],bounds,waters,buildings,extent,paths:[{element:{id:'loop-candidate',tags:{highway:'pedestrian'}},segments,length:route.properties.lengthMeters}]};
const scene=buildScenery(map,{maxMeters:10000,sampleSpacing:6,treeSpacing:18,treeRows:1});
applyMeshTrees(scene,JSON.parse(await readFile('roblox/assets/RainTree.json','utf8')));
scene.additionalRoutes=[];
for(const feature of innerRoutes){
 const ps=feature.geometry.coordinates.map(p=>project(p,origin));
 const ss=ps.slice(1).map((p,i)=>[ps[i],p]);
 const innerMap={...map,paths:[{element:{id:feature.id,tags:{highway:'pedestrian'}},segments:ss,length:feature.properties.lengthMeters}]};
 const branch=buildScenery(innerMap,{maxMeters:10000,sampleSpacing:6,treeSpacing:18,treeRows:1});
 applyMeshTrees(branch,JSON.parse(await readFile('roblox/assets/RainTree.json','utf8')));
 branch.parts=branch.parts.filter(p=>!/^CityBackdrop_|^WindowBand_/.test(p.name));
 for(const p of branch.parts){if(p.className==='MeshPart')p.name=feature.id+'_'+p.name;scene.parts.push(p)}
 scene.additionalRoutes.push({name:feature.id+'Route',waypoints:branch.waypoints});
 scene.info.decorativeTrees+=branch.info.decorativeTrees;
 scene.info.streetLamps+=branch.info.streetLamps;
 // Keep the junction open where the connector joins the main circuit.
 const junctions=[ps[0],ps.at(-1)].map(p=>p.map(n=>n*2));
 scene.parts=scene.parts.filter(p=>!((p.name==='Curb'||p.name==='ShoulderWalk'||p.className==='MeshPart')&&junctions.some(j=>Math.hypot(p.position[0]-j[0],p.position[2]-j[1])<(p.className==='MeshPart'?24:16))));
 segments.push(...ss);
}
if(network){
 scene.parts=scene.parts.filter(p=>!/^CityBackdrop_|^WindowBand_/.test(p.name));
 scene.info.routeNetwork=network.properties;
 scene.info.routeLengths=network.features.map(f=>({id:f.id,lengthMeters:f.properties.lengthMeters}));
}
scene.info.sourceWays=network?[...new Set(network.features.filter(f=>f.properties.render).flatMap(f=>f.properties.sourceWays))]:route.properties.sourceWays;
scene.info.routeStatus=route.properties.status;
if(network){scene.info.decorativeTrees=scene.parts.filter(p=>p.className==='MeshPart'&&p.name.endsWith('trunk_geom')).length;scene.info.decorativeProps=scene.parts.length;}
// Dress only a corridor around the proposed running loop, preserving OSM water holes.
const near=p=>{let best=Infinity;for(const [a,b] of segments){const x=b[0]-a[0],z=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z)));best=Math.min(best,Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-z*t));}return best;};
const add=(name,position,size,color,material='Grass',extra={})=>scene.parts.push({name,position,size,color,material,canCollide:true,castShadow:false,...extra});
add('CorridorBase',[(extent[0]+extent[2]),-3,(extent[1]+extent[3])],[(extent[2]-extent[0]+100)*2,4,(extent[3]-extent[1]+100)*2],[39,57,40]);
const cell=detailed?3:10;
for(let z=Math.floor(extent[1]/cell)*cell;z<extent[3];z+=cell){
 let run=null,lastType=null;
 for(let x=Math.floor(extent[0]/cell)*cell;x<=extent[2]+cell;x+=cell){
  const p=[x+cell/2,z+cell/2],close=x<extent[2]&&(network||near(p)<65)&&inside(p,bounds);
  const type=close?(waters.some(w=>inside(p,w.local))?'water':'grass'):null;
  if(type!==lastType){
   if(run!==null){const water=lastType==='water';add(water?'OSM_Water':'CorridorGrass',[(run+x),water?-.22:-.7,(z+cell/2)*2],[(x-run)*2,water?.2:.6,cell*2],water?[45,99,113]:[93,125,66],water?'SmoothPlastic':'Grass');}
   run=type===null?null:x;lastType=type;
  }
 }
}
if(detailed)applyParkDetails(scene,{map,geo,origin,rainTree:JSON.parse(await readFile('roblox/assets/RainTree.json','utf8')),slenderTree:JSON.parse(await readFile('roblox/assets/SlenderParkTree.json','utf8')),creatorTree:JSON.parse(await readFile('roblox/assets/CreatorParkTree.json','utf8')),clockTower:JSON.parse(await readFile('roblox/assets/ChineseClockTower.json','utf8'))});
const h=xmlWriter('LUMRUN'),{item,property,vector,color,cframe,escape}=h;
const nativeScene=sceneXml(scene,h);
const innerLoopMeters=network?.features.find(f=>f.id==='InnerLoop')?.properties.lengthMeters;
const cfg=`return {studsPerMeter=2,runSpeedStuds=20,loopMeters=${route.properties.lengthMeters},${innerLoopMeters?`innerLoopMeters=${innerLoopMeters},`:''}parks={lumphini={name="สวนลุมพินี",spawn={${scene.spawn}},forward={${scene.forward}}}}}`;
const source=s=>property('ProtectedString','Source',escape(s));
const server=await readFile('roblox/RunServer.server.luau','utf8');
const camera=await readFile('roblox/RunCamera.client.luau','utf8');
const hud=await readFile('roblox/LumphiniLoopHud.client.luau','utf8');
const environment=await readFile('roblox/LoopEnvironment.client.luau','utf8');
let ambient=await readFile('roblox/AmbientRunners.client.luau','utf8');
if(!ambient.includes('for _, park in {"lumphini", "benjakitti"} do'))throw Error('Ambient loop changed; adapt explicitly');
ambient=ambient.replace('for _, park in {"lumphini", "benjakitti"} do','for _, park in {"lumphini"} do');
const spawn=item('SpawnLocation','LumphiniSpawn',vector('size',4,.4,4)+cframe(scene.spawn[0],.4,scene.spawn[2])+property('bool','Anchored','true')+property('bool','Neutral','true')+property('float','Duration',0)+property('float','Transparency',1)+property('bool','CanCollide','false'));h.count();
const park=item('Model','lumphini','',nativeScene);
const [x,,z]=scene.spawn,[fx,,fz]=scene.forward;
// A small tilt keeps north up when Studio normalizes the edit camera near vertical.
const by=2350/Math.hypot(2350,400),bz=400/Math.hypot(2350,400);
const overviewCF=property('CoordinateFrame','CFrame','<X>22</X><Y>2350</Y><Z>360</Z>'+[1,0,0,0,bz,by,0,-by,bz].map((n,i)=>`<R${Math.floor(i/3)}${i%3}>${n}</R${Math.floor(i/3)}${i%3}>`).join(''));
const cameraXml=item('Camera','Camera',(overview?overviewCF:cframe(x-fx*8,6.5,z-fz*8,Math.atan2(-fx,-fz)))+property('float','FieldOfView',overview?50:68));
const cameraRef=cameraXml.match(/referent="([^"]+)"/)[1];
const workspace=item('Workspace','Workspace',property('bool','StreamingEnabled','false')+property('float','Gravity',196.2)+property('Ref','CurrentCamera',cameraRef),park+spawn+cameraXml);
const replicated=item('ReplicatedStorage','ReplicatedStorage','',item('ModuleScript','ParkConfig',source(cfg))+item('RemoteEvent','SelectPark'));
const scripts=item('ServerScriptService','ServerScriptService','',item('Script','RunServer',source(server)));
const detailLighting=detailed?item('LocalScript','ParkLighting',source(await readFile('roblox/ParkLighting.client.luau','utf8')))+item('LocalScript','DetailVisibility',source(await readFile('roblox/DetailVisibility.client.luau','utf8'))):'';
const starter=item('StarterPlayer','StarterPlayer','',item('StarterPlayerScripts','StarterPlayerScripts','',item('LocalScript','RunCamera',source(camera))+item('LocalScript','RunHud',source(hud))+item('LocalScript','AmbientRunners',source(ambient))+item('LocalScript','LoopEnvironment',source(environment))+detailLighting));
const lighting=item('Lighting','Lighting',property('token','Technology',4)+property('token','LightingStyle',0)+property('bool','PrioritizeLightingQuality','true')+property('bool','GlobalShadows','true')+property('float','ClockTime',18.8)+property('float','Brightness',1.4)+property('float','ExposureCompensation',.35)+color('Ambient',[77,85,91])+color('OutdoorAmbient',[86,96,103]),item('BloomEffect','ParkBloom',property('float','Intensity',.15)+property('float','Size',18)+property('float','Threshold',1.6))+item('Atmosphere','ParkAtmosphere',property('float','Density',.18)+color('Color',[175,190,210])));
const xml=`<?xml version="1.0" encoding="utf-8"?><roblox version="4"><External>null</External><External>nil</External>${workspace}${replicated}${scripts}${starter}${lighting}</roblox>`;
const finalXml=overview?xml.replace('<float name="ClockTime">18.8</float>','<float name="ClockTime">11</float>'):xml;
const artifact=outputFile||'demo/LumphiniLoopCandidate.rbxlx';
await writeFile(artifact,finalXml);
if(!outputFile)await copyFile(artifact,'demo/LumphiniRunningCorridor.rbxlx');
await writeFile(`data/processed/${prefix}-scene.json`,JSON.stringify(scene));
await writeFile(`data/processed/${prefix}-build.json`,JSON.stringify({builtAt:new Date().toISOString(),artifact,status:route.properties.status,lengthMeters:route.properties.lengthMeters,partCount:h.partCount,sha256:createHash('sha256').update(finalXml).digest('hex'),scenery:scene.info,scope:network?'Main and inner park running circuits; surrounding streets excluded.':'Lumphini running corridor only; existing two-park demos are preserved.',geometrySource:network?'OSM vertices; visually selected from the user-supplied Strava screenshot. No Strava GPS/API data.':'OSM vertices; course selection checked against BKK PATH RUN and published running guides. No Strava statistics.',googleUse:'Official viewer inspected only. No Google imagery, textures, mesh assets, or traced object positions embedded.'},null,2));
console.log(JSON.stringify({partCount:h.partCount,lengthMeters:route.properties.lengthMeters,scene:scene.info}));
