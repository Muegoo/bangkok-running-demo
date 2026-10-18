import {project,inside,distance} from './geometry.mjs';

// Original scene dressing. OSM supplies site positions; photos are visual references,
// not textures. No Google object locations or imagery are imported by this module.
export function applyParkDetails(scene,{map,geo,origin,rainTree,slenderTree,creatorTree,clockTower}){
 const routes=[scene.waypoints,...scene.additionalRoutes.map(r=>r.waypoints)].map(ps=>ps.map(p=>[p[0]/2,p[2]/2]));
 const segments=routes.flatMap(ps=>ps.slice(1).map((p,i)=>[ps[i],p]));
 let seed=271828;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const nearest=p=>{let best=Infinity;for(const [a,b] of segments){const x=b[0]-a[0],z=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1)));best=Math.min(best,Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-z*t))}return best};
 const land=p=>inside(p,map.bounds)&&!map.waters.some(w=>inside(p,w.local))&&!map.buildings.some(b=>inside(p,b.local));
 const old=scene.parts;
 const sidewalks=old.filter(p=>p.name==='ShoulderWalk');
 const benches=old.filter(p=>p.name==='BenchSeat');
 const lamps=old.map((p,i)=>({p,i})).filter(({p})=>p.name.startsWith('LampPole_')).map(({p,i})=>({pole:p,tip:old[i+3]}));
 const roots=old.filter(p=>p.className==='MeshPart'&&p.name.endsWith('trunk_geom')).map(p=>{
  const id=Number(p.name.match(/NaturalTree_(\d+)_/)[1]),s=.82+(id%7)*.055,a=id*2.399963229728653;
  const [x,,z]=rainTree.parts.find(p=>p.name==='trunk_geom').relativeCFrame;
  return [p.position[0]-s*(x*Math.cos(a)+z*Math.sin(a)),p.position[2]-s*(-x*Math.sin(a)+z*Math.cos(a))];
 });
 scene.parts=old.filter(p=>p.className!=='MeshPart'&&!/^Lamp|^Bench|^ParkBin$|^Shrub$/.test(p.name));
 const add=(name,position,size,color,material='SmoothPlastic',extra={})=>{const p={name,position,size,color,material,canCollide:false,castShadow:false,...extra};scene.parts.push(p);return p};
 const norm=v=>{const l=Math.hypot(...v);return v.map(n=>n/l)};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const rod=(name,a,b,diameter,color,material='Metal',extra={})=>{
  const d=b.map((n,i)=>n-a[i]),length=Math.hypot(...d),x=norm(d),z=norm(cross(x,Math.abs(x[1])>.95?[0,0,1]:[0,1,0])),y=cross(z,x);
  return add(name,a.map((n,i)=>(n+b[i])/2),[length,diameter,diameter],color,material,{shape:'Cylinder',matrix:[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]],...extra});
 };
 function localPart(name,center,yaw,offset,size,color,material='SmoothPlastic',extra={}){
  const c=Math.cos(yaw),s=Math.sin(yaw),[x,y,z]=offset;
  return add(name,[center[0]+x*c+z*s,center[1]+y,center[2]-x*s+z*c],size,color,material,{yaw,...extra});
 }
 let treeId=0;
 const slenderAdjusted={...slenderTree,parts:slenderTree.parts.map(m=>({...m,size:[m.size[0]*.5,m.size[1]*.88,m.size[2]*.5],relativeCFrame:[m.relativeCFrame[0]*.5,m.relativeCFrame[1]*.88,m.relativeCFrame[2]*.5,...m.relativeCFrame.slice(3)]}))};
 const broadAdjusted={...rainTree,parts:rainTree.parts.map(m=>m.name==='trunk_geom'?{...m,size:[m.size[0]*.52,m.size[1],m.size[2]*.52],relativeCFrame:[m.relativeCFrame[0]*.52,m.relativeCFrame[1],m.relativeCFrame[2]*.52,...m.relativeCFrame.slice(3)]}:m)};
 function meshModel(asset,base,scale,yaw,prefix,tint=[255,255,255]){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const m of asset.parts){const [x,y,z,...r]=m.relativeCFrame;add(prefix+'_'+m.name,[base[0]+scale*(x*c+z*s),base[1]+scale*y,base[2]+scale*(-x*s+z*c)],m.size.map(n=>n*scale),tint||m.color||[255,255,255],'SmoothPlastic',{className:'MeshPart',meshId:m.meshId,textureId:m.textureId,meshSize:m.meshSize,doubleSided:true,surface:m.surface,matrix:[c*r[0]+s*r[6],c*r[1]+s*r[7],c*r[2]+s*r[8],r[3],r[4],r[5],-s*r[0]+c*r[6],-s*r[1]+c*r[7],-s*r[2]+c*r[8]],castShadow:true});}
 }
 function treeAt(x,z){
  const index=treeId++,yaw=rand()*Math.PI*2,scale=.78+rand()*.32;
  if(creatorTree&&(index<roots.length||index%6!==0)){
   const wide=index%3!==0,xz=wide?1.12:.9,ys=wide?.42:.51;
   const variant={...creatorTree,parts:creatorTree.parts.map(m=>{
    const leaf=m.name==='leaves',sx=leaf?xz:.6,sy=leaf?ys:.68,sz=leaf?xz:.6;
    return {...m,size:[m.size[0]*sx,m.size[1]*sy,m.size[2]*sz],relativeCFrame:[m.relativeCFrame[0]*sx,m.relativeCFrame[1]*.68+(leaf?3.7:0),m.relativeCFrame[2]*sz,...m.relativeCFrame.slice(3)]};
   })};
   meshModel(variant,[x,0,z],scale,yaw,`ParkTree_${index}`,null);return;
  }
  if(index%3!==0){
   meshModel(slenderAdjusted,[x,0,z],scale,yaw,`DetailTree_${index}`,[218,224,207]);
   // An independently generated slender trunk paired with the original leaf canopy.
   // The text-only generator omitted broad foliage, so it is not used as a bare tree.
   const m=rainTree.parts.find(p=>p.name==='canopy_geom');
   const canopy={parts:[{...m,size:m.size.map(n=>n*.82),relativeCFrame:[0,27,0,...m.relativeCFrame.slice(3)]}]};
   meshModel(canopy,[x,0,z],scale,yaw,`DetailCrown_${index}`,[171+rand()*24,194+rand()*20,151+rand()*20]);
  }else meshModel(broadAdjusted,[x,0,z],scale*.86,yaw,`DetailTree_${index}`,[181,200,158]);
 }
 for(const [x,z] of roots)treeAt(x,z);
 const planted=roots.map(p=>p.map(n=>n/2));
 function extraTree(p){if(!land(p)||nearest(p)<5.3||planted.some(q=>distance(p,q)<6.5))return;treeAt(p[0]*2,p[1]*2);planted.push(p)}
 for(const f of geo.features.filter(f=>f.properties.layer==='tree'&&f.geometry.type==='Point'))extraTree(project(f.geometry.coordinates,origin));
 let edgeLine=0;
 scene.parts=scene.parts.filter(p=>p.name!=='EdgeLine'||edgeLine++%2===0);
 for(const p of scene.parts){
  if(p.name==='RunAsphalt')p.color=[116+rand()*4,119+rand()*4,117+rand()*4];
  if(p.name==='CenterLine'||p.name==='EdgeLine'){p.color=[203,172,79];p.transparency=.12+rand()*.15;}
  if(p.name==='Curb'){p.color=[145,145,132];p.material='Concrete';}
  if(p.name==='ShoulderWalk'){p.color=[92,82,73];p.material='Pavement';p.canCollide=true;}
  if(p.name==='CorridorGrass')p.color=[75+rand()*9,103+rand()*9,55+rand()*7];
  if(p.name==='OSM_Water'){p.color=[51,87,80];p.transparency=.12;p.reflectance=.14;}
 }
 let pavers=0;
 for(const walk of sidewalks){
  const count=Math.max(1,Math.ceil(walk.size[2]/3.2)),length=walk.size[2]/count;
  for(let i=0;i<count;i++){
   const warm=rand();localPart(`Paver_${pavers++}`,walk.position,walk.yaw,[0,.085,-walk.size[2]/2+(i+.5)*length],[walk.size[0]-.08,.045,length-.075],[122+warm*19,107+warm*14,94+warm*12],'Pavement');
  }
 }
 let lampIndex=0;
 for(const {pole,tip} of lamps){
  const n=lampIndex++,x=pole.position[0],z=pole.position[2],h=19.5+(n%4)*.6;
  const dx=tip.position[0]-x,dz=tip.position[2]-z,l=Math.hypot(dx,dz)||1,nx=dx/l,nz=dz/l;
  add(`ParkLamp_${n}_Foot`,[x,.17,z],[1.1,.34,1.1],[112,114,107],'Concrete');
  rod(`ParkLamp_${n}_Base`,[x,.25,z],[x,1.4,z],.43,[99,108,105]);
  rod(`ParkLamp_${n}_Shaft`,[x,1.4,z],[x,h-1.6,z],.24,[137,144,141],'Metal',{castShadow:true});
  for(let j=0;j<5;j++){
   const point=t=>{const a=t*Math.PI/2;return[x+nx*2.8*(1-Math.cos(a)),h-1.6+2.8*Math.sin(a),z+nz*2.8*(1-Math.cos(a))]};
   rod(`ParkLamp_${n}_Neck_${j}`,point(j/5),point((j+1)/5),.23,[137,144,141]);
  }
  const head=[x+nx*3.05,h+1.16,z+nz*3.05],yaw=Math.atan2(nx,nz);
  add(`ParkLamp_${n}_Housing`,head,[1.05,.27,2.25],[91,99,98],'Metal',{yaw});
  add(`ParkLamp_${n}_Emitter`,[head[0],head[1]-.16,head[2]],[.84,.06,1.9],[255,246,227],'Neon',{yaw,light:{brightness:2.5,range:72,angle:105,color:[255,242,222],shadows:false}});
 }
 let benchIndex=0;
 for(const b of benches){
  const n=benchIndex++,c=[b.position[0],0,b.position[2]],yaw=b.yaw+Math.PI/2,green=[43,83,72];
  for(let i=0;i<4;i++)localPart(`GreenBench_${n}_Seat_${i}`,c,yaw,[0,1.04,-.48+i*.29],[4.25,.14,.24],green,'Wood');
  for(let i=0;i<3;i++)localPart(`GreenBench_${n}_Back_${i}`,c,yaw,[0,1.62+i*.29,.57],[4.25,.21,.12],green,'Wood');
  for(const side of [-1,1]){
   for(const z of[-.4,.4])localPart(`GreenBench_${n}_Leg`,c,yaw,[side*1.65,.51,z],[.16,1.02,.16],[38,65,56],'Metal');
   localPart(`GreenBench_${n}_Arm`,c,yaw,[side*1.88,1.7,.04],[.14,.14,1.14],green,'Metal');
   localPart(`GreenBench_${n}_Support`,c,yaw,[side*1.88,1.35,-.4],[.13,.65,.13],green,'Metal');
  }
  const bin=localPart(`ParkBin_${n}`,c,yaw,[3.35,1.08,0],[1.12,2.16,1.12],[47,71,59],'Metal');
  localPart(`ParkBin_${n}_Lid`,bin.position,yaw,[0,1.12,0],[1.26,.16,1.26],[68,79,70],'Metal');
 }
 function frame(ps,d){
  for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],l=distance(a,b);if(d<=l||i===ps.length-1){const t=Math.min(1,d/(l||1)),f=[(b[0]-a[0])/(l||1),(b[1]-a[1])/(l||1)];return{p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],f,n:[-f[1],f[0]]}}d-=l;}
 }
 const total=ps=>ps.slice(1).reduce((sum,p,i)=>sum+distance(ps[i],p),0);
 let rails=0,plants=0,litter=0,signs=0,drains=0;
 for(const [ri,ps] of routes.entries()){
  const len=total(ps);
  for(let d=12;d<len-8;d+=10){
   const a=frame(ps,d-4.8),b=frame(ps,d+4.8),m=frame(ps,d);
   for(const side of[-1,1]){
    const wet=[m.p[0]+m.n[0]*side*8,m.p[1]+m.n[1]*side*8],edge=[m.p[0]+m.n[0]*side*4.7,m.p[1]+m.n[1]*side*4.7];
    if(map.waters.some(w=>inside(wet,w.local))&&land(edge)&&nearest(edge)>4.4){
     const pa=[(a.p[0]+a.n[0]*side*4.7)*2,(a.p[1]+a.n[1]*side*4.7)*2],pb=[(b.p[0]+b.n[0]*side*4.7)*2,(b.p[1]+b.n[1]*side*4.7)*2],n=rails++;
     for(const p of[pa,pb])rod(`LakesideRail_${n}_Post`,[p[0],.1,p[1]],[p[0],2.4,p[1]],.13,[43,88,75]);
     for(const y of[.5,1.35,2.2])rod(`LakesideRail_${n}_Bar`,[pa[0],y,pa[1]],[pb[0],y,pb[1]],.11,[43,88,75]);
    }
   }
   if(Math.floor(d/10)%2===0){
    const side=rand()<.5?-1:1,p=[m.p[0]+m.n[0]*side*(5.2+rand()*2),m.p[1]+m.n[1]*side*(5.2+rand()*2)];
    if(land(p)&&nearest(p)>4.8){
     const n=plants++,base=[p[0]*2,0,p[1]*2];
     for(let j=0;j<6;j++){const yaw=j*Math.PI/3+rand()*.6,r=.45+rand()*.55;rod(`VergePlant_${n}_${j}`,[base[0],.1,base[2]],[base[0]+Math.cos(yaw)*r,.5+rand()*.7,base[2]+Math.sin(yaw)*r],.11,[70+rand()*25,103+rand()*28,48]);}
    }
   }
   for(let j=0;j<2;j++){const side=j?-1:1,p=[m.p[0]+m.n[0]*side*(2+rand()*.7),m.p[1]+m.n[1]*side*(2+rand()*.7)];add(`LeafLitter_${litter++}`,[p[0]*2,.496,p[1]*2],[.12+rand()*.13,.012,.27+rand()*.2],[132+rand()*32,117+rand()*25,61],'SmoothPlastic',{yaw:rand()*6.28,transparency:.22});}
   if(d%20===12){for(const side of[-1,1]){const p=[m.p[0]+m.n[0]*side*3.6,m.p[1]+m.n[1]*side*3.6],n=drains++;add(`Drain_${n}`,[p[0]*2,.29,p[1]*2],[1.15,.04,.7],[56,64,61],'Metal',{yaw:Math.atan2(m.f[0],m.f[1])});for(let k=0;k<4;k++)localPart(`Drain_${n}_Slot`,[p[0]*2,.315,p[1]*2],Math.atan2(m.f[0],m.f[1]),[-.42+k*.28,0,0],[.06,.01,.57],[20,27,24],'SmoothPlastic');}}
   if(Math.floor(d/10)%3===0)for(const side of[-1,1]){const p=[m.p[0]+m.n[0]*side*(16+rand()*19),m.p[1]+m.n[1]*side*(16+rand()*19)];extraTree(p)}
  }
  for(let d=ri?70:120;d<len-30;d+=500){
   const m=frame(ps,d),side=1,p=[m.p[0]+m.n[0]*side*5.5,m.p[1]+m.n[1]*side*5.5];if(!land(p)||nearest(p)<4.8)continue;
   const yaw=Math.atan2(m.n[0],m.n[1]),n=signs++,c=[p[0]*2,0,p[1]*2];
   rod(`RouteSign_${n}_Post`,[c[0],0,c[2]],[c[0],4.7,c[2]],.17,[69,83,71]);
   localPart(`RouteSign_${n}_Panel`,c,yaw,[0,4.4,0],[3.7,1.35,.14],[34,70,58],'SmoothPlastic',{label:{text:ri?'วงด้านใน →':'วงรอบใหญ่ →',color:[244,241,217]}});
  }
 }
 // Planters use the open parallel-path geometry for context, not a Google object survey.
 let planters=0;
 const median=geo.features.find(f=>f.id==='way/145574792');
 if(median){const ps=median.geometry.coordinates[0].map(p=>project(p,origin));for(let d=10;d<total(ps)-10;d+=9){
  const m=frame(ps,d),side=m.n[1]>0?1:-1,p=[m.p[0]+m.n[0]*side*6.4,m.p[1]+m.n[1]*side*6.4];
  if(!land(p)||nearest(p)<5.5)continue;const c=[p[0]*2,0,p[1]*2],yaw=Math.atan2(m.f[0],m.f[1]),n=planters++;
  add(`PlantedMedian_${n}_Bed`,[c[0],.5,c[2]],[2.8,1.05,15.7],[62,83,49],'Grass',{yaw});
  for(const side of[-1,1])localPart(`PlantedMedian_${n}_Edging`,c,yaw,[side*1.45,.35,0],[.18,.7,16],[187,185,164],'Concrete');
  for(let i=0;i<6;i++)localPart(`PlantedMedian_${n}_Flowers`,c,yaw,[(i%2?1:-1)*.45,1.12,-6.5+i*2.6],[.3,.15,.34],i%3?[192,168,195]:[208,199,146],'SmoothPlastic');
 }}
 // An original skyline supplies urban context; it does not reproduce named buildings.
 for(let i=0;i<7;i++){
  const x=(map.extent[0]-95-i%2*45)*2,z=(map.extent[1]+80+i*95)*2,w=44+(i%3)*17,h=180+(i%4)*65;
  add(`UrbanBackdrop_${i}`,[x,h/2,z],[w,h,w*.7],[66+i*3,77+i*2,81+i*2],'SmoothPlastic',{reflectance:.08,castShadow:true});
  for(let k=1;k<13;k++)add(`UrbanBackdrop_${i}_Band_${k}`,[x+w/2+.03,h*k/14,z],[.05,.8,w*.64],[139,145,139],'Metal');
 }
 // Open OSM building footprints provide positions for a handful of recognizable landmarks.
 const landmarks=[];
 const centroid=f=>{const ps=f.geometry.coordinates[0][0].slice(0,-1).map(p=>project(p,origin));return[ps.reduce((s,p)=>s+p[0],0)/ps.length,ps.reduce((s,p)=>s+p[1],0)/ps.length]};
 function pavilion(f){
  const p=centroid(f),c=[p[0]*2,0,p[1]*2],r=8,roof=[60,92,70];if(nearest(p)<7)return;
  rod(`Pavilion_${f.id}_Base`,[c[0],-.15,c[2]],[c[0],.5,c[2]],r*2+1,[163,158,140],'Concrete');
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=c[0]+Math.cos(a)*r*.74,z=c[2]+Math.sin(a)*r*.74;
   rod(`Pavilion_${f.id}_Column_${i}`,[x,.5,z],[x,7.3,z],.43,[169,156,124],'Concrete',{castShadow:true});
   add(`Pavilion_${f.id}_Roof_${i}`,[c[0]+Math.sin(a)*r*.48,8.4,c[2]+Math.cos(a)*r*.48],[6.8,3,r+1],roof,'Metal',{className:'WedgePart',yaw:a,castShadow:true});
  }
  rod(`Pavilion_${f.id}_Finial`,[c[0],9,c[2]],[c[0],11.1,c[2]],.27,[98,114,78]);landmarks.push({id:f.id,name:f.properties.name,position:c,source:'OSM centroid; original approximate pavilion'});
 }
 for(const f of geo.features.filter(f=>f.properties.layer==='building'&&f.properties.name)){
  const p=centroid(f);if(nearest(p)>65)continue;
  if(f.properties.name==='หอนาฬิกาจีน'&&clockTower){meshModel(clockTower,[p[0]*2,0,p[1]*2],28/clockTower.bounds[1],0,'ChineseClockTower');landmarks.push({id:f.id,name:f.properties.name,position:[p[0]*2,0,p[1]*2],source:'OSM centroid and height; original generated approximate mesh'});continue;}
  if(f.properties.amenity==='shelter'||/ศาลาแปด/.test(f.properties.name)){pavilion(f);continue;}
  if(!['ห้องสมุดประชาชนลุมพินี','ศูนย์กีฬาในร่ม','ลุมพินีสถาน'].includes(f.properties.name))continue;
  const ps=f.geometry.coordinates[0][0].map(p=>project(p,origin)),xs=ps.map(p=>p[0]),zs=ps.map(p=>p[1]),w=(Math.max(...xs)-Math.min(...xs))*2,d=(Math.max(...zs)-Math.min(...zs))*2,h=Number.parseFloat(f.properties.height)*2||8;
  if(nearest(p)<Math.max(w,d)/4+7)continue;
  const c=[p[0]*2,0,p[1]*2];add(`ParkBuilding_${f.id}`, [c[0],h/2,c[2]],[w,h,d],[168,164,145],'Concrete',{castShadow:true});
  add(`ParkBuilding_${f.id}_Roof`,[c[0],h+.2,c[2]],[w+.8,.45,d+.8],[72,84,75],'Metal',{castShadow:true});
  for(let i=0;i<Math.floor(w/4);i++)add(`ParkBuilding_${f.id}_Window_${i}`,[c[0]-w/2+2+i*4,h*.62,c[2]+d/2+.03],[2.3,2,.07],[67,89,85],'SmoothPlastic');
  landmarks.push({id:f.id,name:f.properties.name,position:c,source:'OSM footprint bounds; approximate facade'});
 }
 scene.info.detailPass={classification:'Original artistic approximation, not a Google Street View reconstruction',trees:treeId,pavers,lamps:lampIndex,benches:benchIndex,lakesideRailSections:rails,vergePlants:plants,leafLitter:litter,drains,routeSigns:signs,planters,landmarks,skyline:'Original generic silhouettes, not named building reconstructions',roadGeometry:'Unchanged approved route and road parts',sources:['Original user running photo','Licensed Wikimedia Commons reference photographs','OpenStreetMap footprints and POIs','Free Creator Store tree by Adrijan0830, asset 6020696518'],googleUse:'Official viewer inspected manually for context only; no Google images, textures, mesh, or object-location index imported.'};
 scene.info.decorativeTrees=treeId;scene.info.streetLamps=lampIndex;scene.info.decorativeProps=scene.parts.length;
 return scene;
}
