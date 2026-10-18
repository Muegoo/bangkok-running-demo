import {readFile,writeFile} from 'node:fs/promises';
import {project,distance} from './geometry.mjs';
const geo=JSON.parse(await readFile('data/processed/lumphini.geojson','utf8'));
const origin=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks.lumphini.originWgs84;
const paths=geo.features.filter(f=>f.properties.layer==='path'&&['pedestrian','footway','path','service','track'].includes(f.properties.highway)&&f.properties.foot!=='no'&&!['no','private'].includes(f.properties.access));
const key=p=>p.map(n=>n.toFixed(7)).join(','),nodes=new Map(),edgeWays=new Map();
for(const way of paths)for(const segment of way.geometry.coordinates){
 for(let i=1;i<segment.length;i++){
  const a=segment[i-1],b=segment[i],ka=key(a),kb=key(b);if(ka===kb)continue;
  if(!nodes.has(ka))nodes.set(ka,{geo:a,p:project(a,origin),neighbors:new Set()});
  if(!nodes.has(kb))nodes.set(kb,{geo:b,p:project(b,origin),neighbors:new Set()});
  nodes.get(ka).neighbors.add(kb);nodes.get(kb).neighbors.add(ka);
  edgeWays.set([ka,kb].sort().join('|'),way.id);
 }
}
// Keep connected through-paths so a checkpoint cannot snap to an entrance spur.
const queue=[...nodes].filter(([,n])=>n.neighbors.size<2).map(([k])=>k);
while(queue.length){const k=queue.pop(),n=nodes.get(k);if(!n||n.neighbors.size>=2)continue;for(const other of n.neighbors){const o=nodes.get(other);o.neighbors.delete(k);if(o.neighbors.size<2)queue.push(other);}nodes.delete(k);}
let keys;
const selection=JSON.parse(await readFile('data/processed/lumphini-route-selection.json','utf8'));
const nearest=p=>{const local=project(p,origin);return [...nodes].reduce((best,[k,n])=>distance(n.p,local)<distance(nodes.get(best).p,local)?k:best,nodes.keys().next().value);};
const stops=selection.checkpointsWgs84.map(nearest);
function shortest(start,end){
 const costs=new Map([[start,0]]),previous=new Map(),todo=new Set([start]);
 while(todo.size){
  let current;for(const k of todo)if(current===undefined||costs.get(k)<costs.get(current))current=k;
  todo.delete(current);if(current===end)break;
  for(const next of nodes.get(current).neighbors){
   const cost=costs.get(current)+distance(nodes.get(current).p,nodes.get(next).p);
   if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);previous.set(next,current);todo.add(next);}
  }
 }
 if(!costs.has(end))throw Error('Disconnected running checkpoints');
 const path=[end];while(path[0]!==start)path.unshift(previous.get(path[0]));return path;
}
keys=[];for(let i=0;i<stops.length;i++)keys.push(...shortest(stops[i],stops[(i+1)%stops.length]).slice(0,-1));
if(new Set(keys).size!==keys.length)throw Error('Selected course backtracks; adjust checkpoints: '+JSON.stringify({repeated:keys.filter((k,i)=>keys.indexOf(k)!==i),stops}));
const desired=project([100.5393,13.72985],origin);
let first=0;for(let i=1;i<keys.length;i++)if(distance(nodes.get(keys[i]).p,desired)<distance(nodes.get(keys[first]).p,desired))first=i;
keys=keys.slice(first).concat(keys.slice(0,first));keys.push(keys[0]);
const coordinates=keys.map(k=>nodes.get(k).geo),length=keys.slice(1).reduce((sum,k,i)=>sum+distance(nodes.get(keys[i]).p,nodes.get(k).p),0);
const sourceWays=[...new Set(keys.slice(1).map((k,i)=>edgeWays.get([keys[i],k].sort().join('|'))))];
const route={type:'Feature',properties:{name:'Lumphini reference-aligned running circuit',status:'REFERENCE-ALIGNED — public running-route references; not quantified Strava popularity',lengthMeters:+length.toFixed(2),source:'OpenStreetMap pedestrian network',sourceWays,references:selection.references,routeSelection:selection.method,attribution:'© OpenStreetMap contributors',license:'ODbL-1.0'},geometry:{type:'LineString',coordinates}};
await writeFile('data/processed/lumphini-loop-candidate.geojson',JSON.stringify(route,null,2));
const bounds=geo.features.filter(f=>f.properties.layer==='park').flatMap(f=>f.geometry.coordinates).flat(2).map(p=>project(p,origin));
const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys),scale=Math.min(850/(maxX-minX),800/(maxY-minY));
const xy=p=>{const [x,y]=project(p,origin);return[75+(x-minX)*scale,155+(y-minY)*scale];};
const line=coords=>coords.map((p,i)=>(i?'L':'M')+xy(p).join(',')).join(' ');
const outlines=geo.features.filter(f=>['park','water'].includes(f.properties.layer)).map(f=>`<path d="${f.geometry.coordinates.flatMap(poly=>poly.map(r=>line(r)+'Z')).join(' ')}" fill="${f.properties.layer==='park'?'#355746':'#234b62'}" fill-rule="evenodd"/>`).join('');
const lines=paths.map(f=>`<path d="${f.geometry.coordinates.map(line).join(' ')}" fill="none" stroke="#789181" stroke-width="1" opacity=".5"/>`).join('');
const start=xy(coordinates[0]);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><rect width="1000" height="1100" fill="#142b24"/><g font-family="Tahoma,Arial" fill="#edf2e5"><text x="60" y="56" font-size="29">LUMPHINI / RUNNING CORRIDOR STUDY</text><text x="60" y="92" font-size="19">OSM running circuit · ${(length/1000).toFixed(2)} km · public route references</text>${outlines}${lines}<path d="${line(coordinates)}" fill="none" stroke="#f6cf69" stroke-width="6" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="10" fill="#fff8d6"/><text x="60" y="1030" font-size="16">Yellow: reference-aligned OSM circuit. No aggregated popularity measurements.</text><text x="60" y="1064" font-size="15">© OpenStreetMap contributors · ODbL · openstreetmap.org/copyright</text></g></svg>`;
await writeFile('previews/lumphini-loop-candidate.svg',svg);
console.log(JSON.stringify({lengthMeters:+length.toFixed(2),vertices:keys.length,sourceWays,method:selection.method},null,2));
