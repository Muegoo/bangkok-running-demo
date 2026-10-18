import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import {buildScenery} from './scenery.mjs';
import {sceneXml} from './scene-xml.mjs';
import { project, inside, distance, clipSegment, polygonsFromElement, overlaps } from './geometry.mjs';

// All horizontal measurements are derived from WGS84 coordinates; height is a prototype assumption.
const SCALE = 2; // Demo scale, not Roblox's default physical conversion.
const RUN_SPEED = 20; // Faster demo running: 2.5 times the original speed.
const specs = [
  {id:'lumphini',name:'สวนลุมพินี',en:'Lumphini Park',boundaryIds:[23483299],offset:[0,0]},
  {id:'benjakitti',name:'สวนเบญจกิติ',en:'Benjakitti + Forest Park',boundaryIds:[864170465,1306732424],offset:[3200,0]},
];
const xmlEscape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json = (path,obj) => writeFile(path,JSON.stringify(obj,null,2)+'\n');
for(const path of ['data/processed','previews','demo']) await mkdir(path,{recursive:true});
const maps=[];
for(const spec of specs) {
  const raw=JSON.parse(await readFile(`data/raw/${spec.id}.osm.json`,'utf8'));
  const source=JSON.parse(await readFile(`data/raw/${spec.id}.source.json`,'utf8'));
  const boundaries=spec.boundaryIds.map(id=>raw.elements.find(e=>e.type==='way'&&e.id===id));
  if(boundaries.some(e=>!e)) throw new Error(`Missing boundary for ${spec.id}`);
  const geoBoundaries=boundaries.flatMap(polygonsFromElement);
  const all=geoBoundaries.flat(2);
  const origin=[(Math.min(...all.map(p=>p[0]))+Math.max(...all.map(p=>p[0])))/2,(Math.min(...all.map(p=>p[1]))+Math.max(...all.map(p=>p[1])))/2];
  const projectPolys=polys=>polys.map(rings=>rings.map(r=>r.map(p=>project(p,origin))));
  const bounds=projectPolys(geoBoundaries), waters=[], buildings=[], paths=[], trees=[], pois=[], warnings=[];
  const byWay=new Map(raw.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
  const waterMemberIds=new Set();
  const isWater=e=>e.tags?.natural==='water' || e.tags?.waterway==='riverbank';
  for(const e of raw.elements.filter(e=>e.type==='relation'&&isWater(e))) {
    const polys=polygonsFromElement(e), local=projectPolys(polys);
    if(!polys.length) { warnings.push(`Water relation ${e.id}: incomplete geometry; use standalone closed water ways if available.`); continue; }
    if(overlaps(local,bounds)) {
      waters.push({element:e,geo:polys,local});
      for(const member of e.members.filter(m=>m.type==='way')) waterMemberIds.add(member.ref);
    }
  }
  for(const e of byWay.values()) {
    if(e.geometry?.some(p=>!p)) continue;
    if(isWater(e) && !waterMemberIds.has(e.id)) {
      const geo=polygonsFromElement(e), local=projectPolys(geo);
      if(geo.length&&overlaps(local,bounds)) waters.push({element:e,geo,local});
    }
    if(e.tags?.building && e.tags.building!=='no') {
      const geo=polygonsFromElement(e), local=projectPolys(geo);
      if(geo.length&&overlaps(local,bounds)) buildings.push({element:e,geo,local});
    }
    if(!e.tags?.highway || !e.geometry?.length || e.tags.area==='yes') continue;
    if(!['footway','path','pedestrian','track','steps','cycleway','service','residential','unclassified','living_street'].includes(e.tags.highway)) continue;
    const segments=[], geoSegments=[];
    for(let i=1;i<e.geometry.length;i++) {
      const a=project([e.geometry[i-1].lon,e.geometry[i-1].lat],origin), b=project([e.geometry[i].lon,e.geometry[i].lat],origin);
      for(const segment of clipSegment(a,b,bounds)) if(distance(...segment)>0.05) segments.push(segment);
    }
    if(!segments.length) continue;
    const inverse=([x,z])=>[origin[0]+x/(Math.PI/180*6371008.8*Math.cos(origin[1]*Math.PI/180)),origin[1]-z/(Math.PI/180*6371008.8)];
    for(const segment of segments) geoSegments.push(segment.map(inverse));
    paths.push({element:e,segments,geoSegments,length:segments.reduce((n,s)=>n+distance(...s),0)});
  }
  for(const e of raw.elements.filter(e=>e.type==='node'&&e.tags)) {
    const geo=[e.lon,e.lat], point=project(geo,origin);
    if(!inside(point,bounds)) continue;
    if(e.tags.natural==='tree') trees.push({element:e,geo,point});
    if(e.tags.entrance || e.tags.amenity || e.tags.tourism) pois.push({element:e,geo,point});
  }
  // Prefer a publicly accessible pedestrian segment for spawning; never choose a cycle-only path.
  const candidates=paths.filter(p=>['footway','path','pedestrian','service'].includes(p.element.tags.highway) && !['private','no'].includes(p.element.tags.access) && p.element.tags.foot!=='no');
  if(!candidates.length) throw new Error(`No spawn path in ${spec.id}`);
  const startSegments=candidates.sort((a,b)=>b.length-a.length).flatMap(p=>p.segments);
  const startSegment=startSegments.find(([a,b])=>!buildings.some(building=>inside([(a[0]+b[0])/2,(a[1]+b[1])/2],building.local)));
  if(!startSegment) throw new Error(`No unobstructed spawn in ${spec.id}`);
  const start=[(startSegment[0][0]+startSegment[1][0])/2,(startSegment[0][1]+startSegment[1][1])/2];
  const layers=[
    ...boundaries.map(e=>({type:'Feature',id:`way/${e.id}`,properties:{...e.tags,layer:'park',osm_type:e.type,osm_id:e.id},geometry:{type:'MultiPolygon',coordinates:polygonsFromElement(e)}})),
    ...waters.map(w=>({type:'Feature',id:`${w.element.type}/${w.element.id}`,properties:{...w.element.tags,layer:'water',osm_type:w.element.type,osm_id:w.element.id},geometry:{type:'MultiPolygon',coordinates:w.geo}})),
    ...buildings.map(w=>({type:'Feature',id:`${w.element.type}/${w.element.id}`,properties:{...w.element.tags,layer:'building',osm_type:w.element.type,osm_id:w.element.id},geometry:{type:'MultiPolygon',coordinates:w.geo}})),
    ...paths.map(p=>({type:'Feature',id:`way/${p.element.id}`,properties:{...p.element.tags,layer:'path',osm_type:'way',osm_id:p.element.id,clipped_length_m:+p.length.toFixed(2)},geometry:{type:'MultiLineString',coordinates:p.geoSegments}})),
    ...[...trees,...pois].map(p=>({type:'Feature',id:`node/${p.element.id}`,properties:{...p.element.tags,layer:p.element.tags.natural==='tree'?'tree':'poi',osm_type:'node',osm_id:p.element.id},geometry:{type:'Point',coordinates:p.geo}})),
  ];
  const pedestrian=paths.filter(p=>['footway','path','pedestrian','track','steps'].includes(p.element.tags.highway)&&p.element.tags.foot!=='no'&&!['private','no'].includes(p.element.tags.access));
  const stats={boundaryWays:boundaries.length,pathWays:paths.length,pedestrianPathWays:pedestrian.length,
    pedestrianNetworkMeters:Math.round(pedestrian.reduce((n,p)=>n+p.length,0)),waterFeatures:waters.length,
    buildingFootprints:buildings.length,mappedTrees:trees.length,pointsOfInterest:pois.length,
    bridgeTaggedPathWays:paths.filter(p=>p.element.tags.bridge&&p.element.tags.bridge!=='no').length};
  const flat=bounds.flat(2), extent=[Math.min(...flat.map(p=>p[0])),Math.min(...flat.map(p=>p[1])),Math.max(...flat.map(p=>p[0])),Math.max(...flat.map(p=>p[1]))];
  await json(`data/processed/${spec.id}.geojson`,{type:'FeatureCollection',name:spec.name,attribution:'© OpenStreetMap contributors',license:'ODbL-1.0',source,features:layers});
  const map={...spec,origin,bounds,waters,buildings,paths,trees,pois,start,extent,stats,source,warnings};
  maps.push(map);
  console.log(`${spec.id}: ${JSON.stringify(stats)}`);
}

// Lightweight Roblox XML writer. Artifacts use only built-in parts and scripts, no uploaded assets.
let ref=0,partCount=0;
const property=(type,name,value)=>`<${type} name="${name}">${value}</${type}>`;
const item=(cls,name,properties='',children='')=>`<Item class="${cls}" referent="RBX${++ref}"><Properties>${property('string','Name',xmlEscape(name))}${properties}</Properties>${children}</Item>`;
const vector=(name,x,y,z)=>property('Vector3',name,`<X>${x}</X><Y>${y}</Y><Z>${z}</Z>`);
const color=(name,[r,g,b])=>property('Color3',name,`<R>${r/255}</R><G>${g/255}</G><B>${b/255}</B>`);
function cframe(x,y,z,angle=0) {
  const c=Math.cos(angle),s=Math.sin(angle);
  return property('CoordinateFrame','CFrame',`<X>${x}</X><Y>${y}</Y><Z>${z}</Z><R00>${c}</R00><R01>0</R01><R02>${s}</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>${-s}</R20><R21>0</R21><R22>${c}</R22>`);
}
function part(name,x,y,z,sx,sy,sz,rgb,angle=0,extra='',cls='Part') {
  if(![x,y,z,sx,sy,sz,angle].every(Number.isFinite)||Math.min(sx,sy,sz)<=0) throw new Error(`Invalid part ${name}`);
  partCount++;
  const material=name==='ParkGrass'?1280:name.startsWith('Building_')?816:name.startsWith('MappedTreeTrunk_')?512:name.startsWith('OSM_')&&/_(service|residential|unclassified|living_street)$/.test(name)?1376:name.startsWith('OSM_')?836:272;
  const castsShadow=name.startsWith('Building_')||name.startsWith('MappedTree');
  return item(cls,name,property('bool','Anchored','true')+(extra.includes('name="CanCollide"')?'':property('bool','CanCollide','true'))+property('bool','CastShadow',String(castsShadow))+property('token','Material',material)+
    vector('size',sx,sy,sz)+cframe(x,y,z,angle)+property('Color3uint8','Color3uint8',0xff000000+rgb[0]*65536+rgb[1]*256+rgb[2])+property('token','TopSurface',0)+property('token','BottomSurface',0)+extra);
}
// Merge each raster row into wide rectangles, keeping geometry compact and preserving holes/islands.
function rasterRects(extent,cell,contains,emit) {
  const [minx,minz,maxx,maxz]=extent;
  for(let z=Math.floor(minz/cell)*cell;z<maxz;z+=cell) {
    let from=null;
    for(let x=Math.floor(minx/cell)*cell;x<=maxx+cell;x+=cell) {
      const filled=x<maxx&&contains([x+cell/2,z+cell/2]);
      if(filled&&from===null) from=x;
      if(!filled&&from!==null) {emit((from+x)/2,z+cell/2,x-from,cell);from=null;}
    }
  }
}
const palette={grass:[112,151,87],water:[63,147,164],path:[217,199,157],cycle:[152,172,197],road:[126,132,130],building:[155,157,150],bridge:[205,163,115]};
const scenes={};
const parkItems=[], config={studsPerMeter:SCALE,runSpeedStuds:RUN_SPEED,parks:{}};
for(const map of maps) {
  const [ox,oz]=map.offset, groups={ground:[],water:[],paths:[],buildings:[],trees:[]};
  const xyz=p=>[ox+p[0]*SCALE,oz+p[1]*SCALE];
  const [minx,minz,maxx,maxz]=map.extent;
  groups.ground.push(part('PrototypeGround',ox+(minx+maxx)*SCALE/2,-3,oz+(minz+maxz)*SCALE/2,(maxx-minx+40)*SCALE,4,(maxz-minz+40)*SCALE,[73,90,76]));
  rasterRects(map.extent,5,p=>inside(p,map.bounds),(x,z,w,d)=>{const [xx,zz]=xyz([x,z]);groups.ground.push(part('ParkGrass',xx,-0.7,zz,w*SCALE,0.6,d*SCALE,palette.grass));});
  for(const water of map.waters) rasterRects(map.extent,3,p=>inside(p,map.bounds)&&inside(p,water.local),(x,z,w,d)=>{
    const [xx,zz]=xyz([x,z]);groups.water.push(part(`Water_${water.element.id}`,xx,-0.22,zz,w*SCALE,0.2,d*SCALE,palette.water));
  });
  for(const path of map.paths) {
    const tags=path.element.tags;
    const road=['service','residential','unclassified','living_street'].includes(tags.highway);
    const rawWidth=Number(tags.width);
    const width=Number.isFinite(rawWidth)&&rawWidth>0?Math.min(rawWidth,15):road?5:tags.highway==='cycleway'?3:2.5;
    const rgb=tags.bridge&&tags.bridge!=='no'?palette.bridge:road?palette.road:tags.highway==='cycleway'?palette.cycle:palette.path;
    for(const [a,b] of path.segments) {
      const length=distance(a,b); if(length<0.1) continue;
      const [xx,zz]=xyz([(a[0]+b[0])/2,(a[1]+b[1])/2]);
      groups.paths.push(part(`OSM_${path.element.id}_${tags.highway}`,xx,0.08,zz,width*SCALE,0.24,length*SCALE+0.15,rgb,Math.atan2(b[0]-a[0],b[1]-a[1])));
    }
  }
  for(const building of map.buildings) {
    const tags=building.element.tags, tagged=Number(tags.height), levels=Number(tags['building:levels']);
    const h=Number.isFinite(tagged)&&tagged>0?Math.min(tagged,100):Number.isFinite(levels)&&levels>0?Math.min(levels*3,100):6;
    rasterRects(map.extent,4,p=>inside(p,map.bounds)&&inside(p,building.local),(x,z,w,d)=>{
      const [xx,zz]=xyz([x,z]);groups.buildings.push(part(`Building_${building.element.id}`,xx,h*SCALE/2,zz,w*SCALE,h*SCALE,d*SCALE,palette.building));
    });
  }
  // Trees here are only OSM tree points, not an invented survey of the whole park.
  for(const tree of map.trees) {
    const [xx,zz]=xyz(tree.point);
    groups.trees.push(part(`MappedTreeTrunk_${tree.element.id}`,xx,3,zz,1,6,1,[112,88,62],0,property('bool','CanCollide','false')));
    groups.trees.push(part(`MappedTreeCrown_${tree.element.id}`,xx,9,zz,10,10,10,[65,116,68],0,property('bool','CanCollide','false')+property('token','shape',0)));
  }
  const scene=buildScenery(map); scenes[map.id]=scene;
  config.parks[map.id]={name:map.name,spawn:scene.spawn,forward:scene.forward,originWgs84:map.origin,offsetStuds:map.offset};
  const scenic=sceneXml(scene,{item,property,vector,color,cframe,count:()=>partCount++});
  parkItems.push(item('Model',map.id,'',Object.entries(groups).map(([name,parts])=>item('Folder',name,'',parts.join(''))).join('')+scenic));
}
// Use Luau literals rather than dynamic JSON/HTTP requests inside the game.
const luauConfig=`return {studsPerMeter=${SCALE}, runSpeedStuds=${RUN_SPEED}, parks={\n${Object.entries(config.parks).map(([id,p])=>`["${id}"]={name=${JSON.stringify(p.name)},spawn={${p.spawn.join(',')}},forward={${p.forward.join(',')}}}`).join(',\n')}\n}}`;
const sourceProperty=s=>property('ProtectedString','Source',xmlEscape(s));
const server=await readFile('roblox/RunServer.server.luau','utf8'),hud=await readFile('roblox/RunHud.client.luau','utf8');
const cameraScript=await readFile('roblox/RunCamera.client.luau','utf8'),ambientScript=await readFile('roblox/AmbientRunners.client.luau','utf8');
const spawn=config.parks.lumphini.spawn;
const spawnItem=part('LumphiniSpawn',spawn[0],0.4,spawn[2],8,0.4,8,[236,205,91],0,property('bool','Neutral','true')+property('float','Duration',0)+property('float','Transparency',1)+property('bool','CanCollide','false'),'SpawnLocation');
const f=config.parks.lumphini.forward;
const cameraPosition=[spawn[0]-f[0]*8,6,spawn[2]-f[2]*8];
const rawBack=[-f[0],0.035,-f[2]],back=rawBack.map(n=>n/Math.hypot(...rawBack));
const rightLength=Math.hypot(back[2],back[0]);
const right=[back[2]/rightLength,0,-back[0]/rightLength];
const up=[back[1]*right[2],back[2]*right[0]-back[0]*right[2],-back[1]*right[0]];
const cameraMatrix=`<X>${cameraPosition[0]}</X><Y>${cameraPosition[1]}</Y><Z>${cameraPosition[2]}</Z>`+
  [0,1,2].map(row=>`<R${row}0>${right[row]}</R${row}0><R${row}1>${up[row]}</R${row}1><R${row}2>${back[row]}</R${row}2>`).join('');
const cameraRef=`RBX${ref+1}`;
const camera=item('Camera','Camera',property('CoordinateFrame','CFrame',cameraMatrix)+property('float','FieldOfView',70));
const workspace=item('Workspace','Workspace',property('bool','StreamingEnabled','false')+property('float','Gravity',196.2)+property('Ref','CurrentCamera',cameraRef),parkItems.join('')+spawnItem+camera);
const replicated=item('ReplicatedStorage','ReplicatedStorage','',item('ModuleScript','ParkConfig',sourceProperty(luauConfig))+item('RemoteEvent','SelectPark'));
const scripts=item('ServerScriptService','ServerScriptService','',item('Script','RunServer',sourceProperty(server)));
const starter=item('StarterPlayer','StarterPlayer','',item('StarterPlayerScripts','StarterPlayerScripts','',item('LocalScript','RunHud',sourceProperty(hud))+item('LocalScript','RunCamera',sourceProperty(cameraScript))+item('LocalScript','AmbientRunners',sourceProperty(ambientScript))));
// Explicit modern lighting prevents compatibility migration from changing saved brightness.
const lighting=item('Lighting','Lighting',property('token','Technology',4)+property('token','LightingStyle',0)+property('bool','PrioritizeLightingQuality','true')+property('bool','GlobalShadows','true')+property('float','ClockTime',18.8)+property('float','Brightness',1.4)+property('float','ExposureCompensation',0.25)+color('Ambient',[70,79,91])+color('OutdoorAmbient',[79,88,101]),item('BloomEffect','ParkBloom',property('float','Intensity',0.18)+property('float','Size',20)+property('float','Threshold',1.6))+item('Atmosphere','ParkAtmosphere',property('float','Density',0.19)+property('float','Offset',0.15)+color('Color',[175,189,210])+color('Decay',[89,102,126])));
await writeFile('demo/BangkokRunningDemo.rbxlx',`<?xml version="1.0" encoding="utf-8"?><roblox version="4"><External>null</External><External>nil</External>${workspace}${replicated}${scripts}${starter}${lighting}</roblox>`);
await copyFile('demo/BangkokRunningDemo.rbxlx','demo/BangkokRunningDemo-Evening.rbxlx');
await writeFile('roblox/ParkConfig.luau',luauConfig+'\n');
await json('data/processed/park-config.json',config);
await json('data/processed/scenery.json',scenes);

// Native vector previews preserve the complete water polygons, including their inner rings.
function renderPanel(map,index) {
  const x=index*760, y=100, width=700,height=790;
  const [minx,minz,maxx,maxz]=map.extent,scale=Math.min((width-50)/(maxx-minx),(height-140)/(maxz-minz));
  const px=p=>[x+35+(width-50-(maxx-minx)*scale)/2+(p[0]-minx)*scale,y+85+(height-140-(maxz-minz)*scale)/2+(p[1]-minz)*scale];
  const d=polys=>polys.flatMap(rings=>rings.map(r=>r.map((p,i)=>`${i?'L':'M'}${px(p).map(n=>n.toFixed(2)).join(',')}`).join(' ')+'Z')).join(' ');
  const outline=d(map.bounds);
  const paths=map.paths.map(p=>{
    const tags=p.element.tags, rgb=tags.bridge&&tags.bridge!=='no'?'#d9ac72':tags.highway==='cycleway'?'#8eacdc':['service','residential','unclassified','living_street'].includes(tags.highway)?'#8f9692':'#f4e4b5';
    return `<path d="${p.segments.map(s=>s.map((p,i)=>`${i?'L':'M'}${px(p).map(n=>n.toFixed(2)).join(',')}`).join(' ')).join(' ')}" fill="none" stroke="${rgb}" stroke-width="2.2" stroke-linecap="round"/>`;
  }).join('');
  const start=px(map.start);
  return `<g><rect x="${x+16}" y="${y}" width="${width+28}" height="${height}" rx="24" fill="#203f37"/>
    <text x="${x+40}" y="${y+35}" fill="#faf4df" font-size="25" font-weight="700">${map.name}</text>
    <text x="${x+40}" y="${y+62}" fill="#c0d6c8" font-size="15">${map.en}</text>
    <defs><clipPath id="clip${index}"><path d="${outline}" fill-rule="evenodd"/></clipPath></defs>
    <path d="${outline}" fill="#77a16a" stroke="#b8d2a7" stroke-width="2" fill-rule="evenodd"/>
    <g clip-path="url(#clip${index})">${map.waters.map(w=>`<path d="${d(w.local)}" fill="#469eb3" fill-rule="evenodd"/>`).join('')}
    ${map.buildings.map(b=>`<path d="${d(b.local)}" fill="#b3b8ac" fill-rule="evenodd"/>`).join('')}${paths}
    ${map.trees.map(t=>`<circle cx="${px(t.point)[0]}" cy="${px(t.point)[1]}" r="2" fill="#3b6c42"/>`).join('')}</g>
    <circle cx="${start[0]}" cy="${start[1]}" r="7" fill="#ffcf64" stroke="#172f29" stroke-width="2"/>
    <text x="${x+40}" y="${y+height-28}" fill="#cfddcf" font-size="14">${map.stats.pathWays} mapped path ways · ${map.stats.waterFeatures} water features · N ↑</text>
    <path d="M${x+width-100},${y+height-55}h${100*scale}" stroke="#d1dfca" stroke-width="3"/>
    <text x="${x+width-100}" y="${y+height-65}" fill="#d1dfca" font-size="12">100 m</text></g>`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="1030" viewBox="0 0 1520 1030"><rect width="1520" height="1030" fill="#112b26"/><g font-family="Tahoma,Arial,sans-serif"><text x="40" y="45" fill="#f6f0dd" font-size="30" font-weight="700">BANGKOK / RUNNING MAP STUDY</text><text x="40" y="75" fill="#a8c4b5" font-size="16">Real OpenStreetMap geometry · demo preview · not a verified running course</text>${maps.map(renderPanel).join('')}<text x="40" y="925" fill="#e5ddc5" font-size="16">Cream: pedestrian paths | Blue-gray: cycleways | Gray: service roads | Gold: bridge-tagged paths + demo start</text><text x="40" y="955" fill="#a8c4b5" font-size="14">Preview has exact vector outlines. Roblox demo uses 3–5 m raster edges, flat paths, approximate widths and building heights.</text><a href="https://www.openstreetmap.org/copyright"><text x="40" y="995" fill="#d1e3d2" font-size="14">© OpenStreetMap contributors · ODbL · openstreetmap.org/copyright</text></a></g></svg>`;
await writeFile('previews/parks.svg',svg);
const summary={createdAt:new Date().toISOString(),attribution:'© OpenStreetMap contributors',license:'ODbL-1.0',studsPerMeter:SCALE,partCount,
  limitations:['Flat terrain and paths: bridge/elevation tags retained in GeoJSON but not reproduced vertically.',
    'Mapped path network includes cycling and service ways; not a verified running course or lap distance.',
    'Widths default to 2.5/3/5 m when missing; building heights default to 6 m or 3 m per tagged level.',
    'Roblox surface edges use 3–5 m grid approximations; GeoJSON and SVG retain original vector detail.',
    'Scenic 420 m sections use original decorative trees/lights/runners. Prop positions and 6 m road width are artistic assumptions, not site surveys.',
    'Live Studio MCP verification, when available, is recorded separately in data/processed/studio-qa.json.'],
  scenery:Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.info])),
  parks:maps.map(m=>({id:m.id,name:m.name,boundaryIds:m.boundaryIds,originWgs84:m.origin,extentMeters:m.extent,stats:m.stats,source:m.source,warnings:m.warnings}))};
await json('data/processed/summary.json',summary);
console.log(`Wrote demo/BangkokRunningDemo.rbxlx (${partCount} anchored parts), GeoJSON and previews/parks.svg`);
