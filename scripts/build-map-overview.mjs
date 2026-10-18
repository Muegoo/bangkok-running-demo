import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Make a separate review file; preserve the place the user saved in Studio.
const source='demo/LumphiniRunningCorridor.rbxlx';
const output='demo/LumphiniMapOverview.rbxlx';
const original=await readFile(source,'utf8');
const tree=JSON.parse(await readFile('roblox/assets/RainTree.json','utf8'));
const templates=new Map(tree.parts.map(p=>[p.meshId,p]));
let repaired=0;
let xml=original.replace(/(<Item class="MeshPart"[^>]*>\s*<Properties>)([\s\S]*?)(<\/Properties>)/g,(all,open,body,end)=>{
 const id=body.match(/<Content name="MeshId">\s*<url>([^<]+)<\/url>/)?.[1];
 const template=templates.get(id);
 if(!template)return all;
 const size='<Vector3 name="InitialSize">'+template.meshSize.map((n,i)=>`<${'XYZ'[i]}>${n}</${'XYZ'[i]}>`).join('')+'</Vector3>';
 if(!body.includes('name="InitialSize"'))throw Error('Missing original mesh dimensions');
 repaired++;
 return open+body.replace(/<Vector3 name="InitialSize">[\s\S]*?<\/Vector3>/,size)+end;
});
if(repaired===0)throw Error('No original tropical tree meshes found');
const by=2350/Math.hypot(2350,1),bz=1/Math.hypot(2350,1);
const cf=(name,x,y,z,m)=>`<CoordinateFrame name="${name}"><X>${x}</X><Y>${y}</Y><Z>${z}</Z>${m.map((n,i)=>`<R${Math.floor(i/3)}${i%3}>${n}</R${Math.floor(i/3)}${i%3}>`).join('')}</CoordinateFrame>`;
let cameras=0;
xml=xml.replace(/(<Item class="Camera"[^>]*>\s*<Properties>)([\s\S]*?)(<\/Properties>)/g,(all,open,body,end)=>{
 cameras++;
 body=body.replace(/<CoordinateFrame name="CFrame">[\s\S]*?<\/CoordinateFrame>/,cf('CFrame',22,2350,-39,[1,0,0,0,bz,by,0,-by,bz]));
 body=body.replace(/<CoordinateFrame name="Focus">[\s\S]*?<\/CoordinateFrame>/,cf('Focus',22,0,-40,[1,0,0,0,1,0,0,0,1]));
 body=body.replace(/<(float|double) name="FieldOfView">[^<]+<\/\1>/,'<float name="FieldOfView">50</float>');
 return open+body+end;
});
if(!cameras)throw Error('No camera found');
let lights=0;
xml=xml.replace(/(<Item class="Lighting"[^>]*>\s*<Properties>)([\s\S]*?)(<\/Properties>)/g,(all,open,body,end)=>{
 lights++;
 // Studio writes TimeOfDay, while the procedural writer uses ClockTime.
 body=body.replace(/<(float|double) name="ClockTime">[^<]+<\/\1>/,'<float name="ClockTime">11</float>');
 body=body.replace(/<string name="TimeOfDay">[^<]+<\/string>/,'<string name="TimeOfDay">11:00:00</string>');
 return open+body+end;
});
if(!lights)throw Error('No Lighting service found');
await writeFile(output,xml);
const metadata={createdAt:new Date().toISOString(),source,output,sourceSha256:createHash('sha256').update(original).digest('hex'),outputSha256:createHash('sha256').update(xml).digest('hex'),treeMeshParts:repaired,cameras,daylight:'11:00',camera:'North up, almost vertical to avoid camera gimbal singularity',route:'Preserves the route and scene in the latest user-saved source file; no route regeneration.'};
await writeFile('previews/lumphini-map-overview.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));
