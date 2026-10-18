import {distance,inside} from './geometry.mjs';

// These props are original scenery inspired by the supplied reference photograph.
// Only the route centerline is geospatial data; trees/lights/widths are artistic approximations.
export function buildScenery(map, options={}) {
  const candidates=map.paths.filter(p=>['pedestrian','footway','path'].includes(p.element.tags.highway)&&!p.element.tags.bridge&&p.element.tags.foot!=='no'&&!['private','no'].includes(p.element.tags.access));
  candidates.sort((a,b)=>b.length-a.length);
  const source=candidates[0];
  if(!source) throw new Error(`No scenic route: ${map.id}`);
  const chains=[];let chain=[];
  for(const [a,b] of source.segments){
    if(chain.length&&distance(chain.at(-1),a)>0.1){chains.push(chain);chain=[];}
    if(!chain.length)chain.push(a);
    chain.push(b);
  }
  if(chain.length)chains.push(chain);
  const lengthOf=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  chains.sort((a,b)=>lengthOf(b)-lengthOf(a));
  const original=chains[0], total=lengthOf(original), maxDistance=Math.min(total,options.maxMeters||420);
  function pointAt(d){
    d=Math.max(0,Math.min(d,total));
    for(let i=1;i<original.length;i++){
      const a=original[i-1],b=original[i],len=distance(a,b);
      if(d<=len||i===original.length-1){const t=Math.min(1,d/Math.max(len,1e-6));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
      d-=len;
    }
  }
  // Use small sections to follow the actual curved centerline smoothly.
  const samples=[];
  for(let d=0;d<=maxDistance;d+=options.sampleSpacing||3)samples.push(pointAt(d));
  if(distance(samples.at(-1),pointAt(maxDistance))>0.05)samples.push(pointAt(maxDistance));
  const [ox,oz]=map.offset;
  const world=([x,z],y=0)=>[ox+x*2,y,oz+z*2];
  const parts=[], models=[];
  let seed=map.id==='lumphini'?1234567:6789234;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  function add(name,position,size,color,material='SmoothPlastic',options={}){
    const spec={name,position,size,color,material,canCollide:false,castShadow:true,...options};
    parts.push(spec);return spec;
  }
  function strip(name,a,b,width,height,y,rgb,material='Concrete',shift=0){
    const len=distance(a,b);if(len<0.01)return;
    const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
    add(name,world([(a[0]+b[0])/2-dz*shift,(a[1]+b[1])/2+dx*shift],y),[width*2,height,len*2+0.1],rgb,material,{yaw:Math.atan2(dx,dz),canCollide:name==='RunAsphalt'||name.startsWith('Curb')});
  }
  const roadWidth=6;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    strip('RunAsphalt',a,b,roadWidth,0.28,0.34,[91,94,94],'Asphalt');
    strip('CenterLine',a,b,0.07,0.025,0.495,[229,197,73],'SmoothPlastic',0);
    for(const sign of[-1,1]){
      strip('EdgeLine',a,b,0.07,0.025,0.495,[229,197,73],'SmoothPlastic',sign*2.7);
      strip('Curb',a,b,0.18,0.3,0.39,[151,151,140],'Concrete',sign*3.08);
      strip('ShoulderWalk',a,b,1.3,0.12,0.2,[153,144,123],'Concrete',sign*3.8);
    }
  }
  const frame=d=>{
    const p=pointAt(d),a=pointAt(Math.max(0,d-1)),b=pointAt(Math.min(maxDistance,d+1)),len=Math.max(distance(a,b),0.001);
    const forward=[(b[0]-a[0])/len,(b[1]-a[1])/len];
    return {p,forward,normal:[-forward[1],forward[0]]};
  };
  const allowed=p=>inside(p,map.bounds)&&!map.waters.some(w=>inside(p,w.local))&&!map.buildings.some(b=>inside(p,b.local));
  const routeDistance=p=>{
    let best=Infinity;
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
      best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t));
    }return best;
  };
  let trees=0,lamps=0;
  for(let d=0;d<maxDistance;d+=options.treeSpacing||10){
    const f=frame(d);
    for(const sign of[-1,1])for(let row=0;row<(options.treeRows||2);row++){
      const offset=6.1+row*7+rand()*2;
      const p=[f.p[0]+f.normal[0]*sign*offset+f.forward[0]*(rand()-.5)*5,f.p[1]+f.normal[1]*sign*offset+f.forward[1]*(rand()-.5)*5];
      if(!allowed(p)||routeDistance(p)<5)continue;
      const h=19+rand()*11,base=world(p),r=1.1+rand()*.6;
      add(`ScenicTrunk_${trees}`, [base[0],h*.35,base[2]],[r,h*.7,r],[95+rand()*18,82,64],'Wood');
      for(let branch=0;branch<3;branch++){
        const angle=branch*Math.PI*2/3+rand();
        const start=[base[0],h*.38,base[2]],end=[base[0]+Math.cos(angle)*5,h*.72,base[2]+Math.sin(angle)*5];
        add(`Branch_${trees}_${branch}`,[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2],[.6,.6,Math.hypot(...end.map((v,i)=>v-start[i]))],[98,84,63],'Wood',{lookFrom:start,lookTo:end});
      }
      for(let leaf=0;leaf<8;leaf++){
        const a=leaf/8*Math.PI*2,spread=leaf===0?0:5+rand()*4;
        add(`LeafCrown_${trees}_${leaf}`,[base[0]+Math.cos(a)*spread,h*.8+rand()*4,base[2]+Math.sin(a)*spread],[11+rand()*8,5+rand()*4,10+rand()*7],[47+rand()*24,85+rand()*27,43+rand()*15],'Grass',{shape:'Ball',yaw:rand()*Math.PI});
      }
      trees++;
    }
  }
  for(let d=8;d<maxDistance-5;d+=22){
    const f=frame(d),side=lamps%2===0?-1:1;
    const p=[f.p[0]+f.normal[0]*side*4.65,f.p[1]+f.normal[1]*side*4.65],b=world(p);
    add(`LampPole_${lamps}`,[b[0],8,b[2]],[.24,16,.24],[110,117,115],'SmoothPlastic');
    const tip=[b[0]-f.normal[0]*side*3,16.25,b[2]-f.normal[1]*side*3];
    add(`LampArm_${lamps}`,[(b[0]+tip[0])/2,16.15,(b[2]+tip[2])/2],[.25,.25,3.2],[110,117,115],'SmoothPlastic',{yaw:Math.atan2(f.normal[0],f.normal[1])});
    add(`LampHousing_${lamps}`,tip,[1.3,.24,2],[78,86,87],'SmoothPlastic',{yaw:Math.atan2(f.forward[0],f.forward[1])});
    add(`LampEmitter_${lamps}`,[tip[0],16.05,tip[2]],[1,.08,1.65],[255,246,224],'Neon',{light:{brightness:3.8,range:57,angle:115,color:[255,241,214],shadows:false}});
    lamps++;
  }
  for(let d=30;d<maxDistance;d+=65){
    const f=frame(d),side=-1,p=[f.p[0]+f.normal[0]*side*5.3,f.p[1]+f.normal[1]*side*5.3];if(!allowed(p))continue;
    const b=world(p),yaw=Math.atan2(f.forward[0],f.forward[1]);
    add('BenchSeat',[b[0],1.25,b[2]],[3.6,.25,1.05],[116,87,55],'Wood',{yaw});
    add('BenchBack',[b[0]+f.normal[0]*.45,2,b[2]+f.normal[1]*.45],[3.6,1.15,.18],[116,87,55],'Wood',{yaw});
    for(const s of[-1,1])add('BenchLeg',[b[0]+f.forward[0]*s*1.3,.6,b[2]+f.forward[1]*s*1.3],[.2,1.2,.7],[52,58,57],'SmoothPlastic',{yaw});
    add('ParkBin',[b[0]+f.forward[0]*3,1.3,b[2]+f.forward[1]*3],[1.25,2.6,1.25],[40,67,56],'SmoothPlastic');
  }
  // Plant beds near the start create a believable edge without blocking the route.
  for(let d=0;d<Math.min(maxDistance,130);d+=4){const f=frame(d);for(const sign of[-1,1]){
    const p=[f.p[0]+f.normal[0]*sign*(4.9+rand()),f.p[1]+f.normal[1]*sign*(4.9+rand())];
    if(!allowed(p)||routeDistance(p)<4.7)continue;
    add('Shrub',world(p,.8+rand()*.5),[2.2+rand()*2,1.3+rand(),2.2+rand()*2],[42,79+rand()*25,45],'Grass',{shape:'Ball'});
  }}
  // Background buildings are generic silhouettes, not reconstructions from Street View.
  for(let i=0;i<13;i++){
    const local=[map.extent[0]-45-rand()*110,map.extent[1]+rand()*(map.extent[3]-map.extent[1])];
    const b=world(local),h=45+rand()*110,w=20+rand()*18;
    add(`CityBackdrop_${i}`,[b[0],h/2,b[2]],[w,h,w*.7],[39+rand()*15,45+rand()*12,57+rand()*14],'Concrete');
    for(let row=0;row<8;row++)if(rand()>.25)add(`WindowBand_${i}_${row}`,[b[0]+w/2+.03,h*.15+row*h*.09,b[2]],[.04,.7,w*.48],[155+rand()*65,140+rand()*50,95],'Neon',{castShadow:false});
  }
  for(let i=0;i<6;i++){
    const f=frame(45+i*55),p=world([f.p[0]+f.normal[0]*(i%2?-.8:.8),f.p[1]+f.normal[1]*(i%2?-.8:.8)],.5);
    const yaw=Math.atan2(-f.forward[0],-f.forward[1]);
    const c=[[66,96,127],[159,103,119],[207,190,140],[108,132,104],[93,85,123],[168,177,184]][i];
    models.push({name:`Runner_${String(i+1).padStart(2,'0')}`,position:p,yaw,parts:[
      {name:'Torso',offset:[0,2.9,0],size:[1.55,1.7,.8],color:c},
      {name:'Head',offset:[0,4.25,0],size:[.9,.95,.9],color:[185,145,110],shape:'Ball'},
      {name:'Hair',offset:[0,4.67,.04],size:[.95,.36,.9],color:[42,34,29],shape:'Ball'},
      {name:'LeftArm',offset:[-1.02,2.85,0],size:[.45,1.55,.5],color:c},
      {name:'RightArm',offset:[1.02,2.85,0],size:[.45,1.55,.5],color:c},
      {name:'LeftLeg',offset:[-.43,1.14,0],size:[.6,1.7,.65],color:[39,44,48]},
      {name:'RightLeg',offset:[.43,1.14,0],size:[.6,1.7,.65],color:[39,44,48]},
    ]});
  }
  const f=frame(15),start=world(f.p,7);
  return {parts,models,waypoints:samples.map(p=>world(p,.5)),spawn:start,forward:[f.forward[0],0,f.forward[1]],
    info:{sourceWay:source.element.id,centerlineMeters:+maxDistance.toFixed(1),roadWidthMeters:roadWidth,decorativeTrees:trees,streetLamps:lamps,decorativeProps:parts.length,runners:models.length,classification:'Original artistic dressing; prop positions and road width are not a site survey.'}};
}
