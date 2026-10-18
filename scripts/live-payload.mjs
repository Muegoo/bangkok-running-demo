import {readFile} from 'node:fs/promises';
const scenes=JSON.parse(await readFile('data/processed/scenery.json','utf8'));
const mode=process.argv[2];
const literal=v=>'[====['+JSON.stringify(v)+']====]';
let code='';
if(mode==='init'||mode==='sources'){
  const scripts=[['ReplicatedStorage','ParkConfig','ModuleScript','ParkConfig.luau'],['ServerScriptService','RunServer','Script','RunServer.server.luau'],...['RunHud','RunCamera','AmbientRunners'].map(n=>['StarterPlayer.StarterPlayerScripts',n,'LocalScript',n+'.client.luau'])];
  const sources=[];
  for(const [parent,name,cls,file] of scripts)sources.push({parent,name,cls,source:await readFile('roblox/'+file,'utf8')});
  code=`local data=game:GetService('HttpService'):JSONDecode(${literal(sources)})
game:GetService('ChangeHistoryService'):SetWaypoint('Before running experience')
for _,s in data do
 local parent=game
 for part in string.gmatch(s.parent,'[^.]+') do parent=parent:FindFirstChild(part) end
 local script=parent:FindFirstChild(s.name) or Instance.new(s.cls)
 script.Name=s.name; script.Source=s.source; script.Parent=parent
end
workspace.StreamingEnabled=false
for _,id in {'lumphini','benjakitti'} do
 local park=workspace:FindFirstChild(id)
 local old=park:FindFirstChild('RunningExperience'); if old then old:Destroy() end
 local scene=Instance.new('Folder');scene.Name='RunningExperience';scene.Parent=park
 local marker=park.paths:FindFirstChild('Start_'..id); if marker then marker:Destroy() end
end
local spawn=workspace:FindFirstChild('LumphiniSpawn'); if spawn then spawn.Transparency=1;spawn.CanCollide=false end
local l=game:GetService('Lighting');l.ClockTime=18.8;l.Brightness=1.4;l.ExposureCompensation=.25;l.Ambient=Color3.fromRGB(70,79,91);l.OutdoorAmbient=Color3.fromRGB(79,88,101)
local bloom=l:FindFirstChild('ParkBloom') or Instance.new('BloomEffect');bloom.Name='ParkBloom';bloom.Intensity=.18;bloom.Size=20;bloom.Threshold=1.6;bloom.Parent=l
local atmosphere=l:FindFirstChild('ParkAtmosphere') or Instance.new('Atmosphere');atmosphere.Name='ParkAtmosphere';atmosphere.Density=.19;atmosphere.Offset=.15;atmosphere.Color=Color3.fromRGB(175,189,210);atmosphere.Decay=Color3.fromRGB(89,102,126);atmosphere.Parent=l
return 'Scripts, camera, speed and lighting installed'`;
} else {
  const batches=[];
  for(const [id,scene] of Object.entries(scenes)){
    for(let i=0;i<scene.parts.length;i+=250)batches.push({id,batch:i/250,parts:scene.parts.slice(i,i+250)});
    batches.push({id,models:scene.models,waypoints:scene.waypoints});
  }
  if(mode==='count'){console.log(JSON.stringify({batches:batches.length}));process.exit();}
  const d=batches[Number(mode)];if(!d)throw Error('No batch '+mode);
  code=`local data=game:GetService('HttpService'):JSONDecode(${literal(d)})
local scene=workspace[data.id].RunningExperience
local function make(p,parent)
 local part=Instance.new('Part');part.Name=p.name;part.Size=Vector3.new(table.unpack(p.size));part.Anchored=true;part.CanCollide=p.canCollide==true;part.CanTouch=false;part.CanQuery=part.CanCollide;part.CastShadow=p.castShadow~=false
 part.Color=Color3.fromRGB(table.unpack(p.color));part.Material=Enum.Material[p.material or 'SmoothPlastic'];part.Shape=if p.shape=='Ball' then Enum.PartType.Ball else Enum.PartType.Block
 part.Transparency=p.transparency or 0
 local pos=Vector3.new(table.unpack(p.position));part.CFrame=CFrame.new(pos)*CFrame.Angles(0,p.yaw or 0,0)
 if p.lookFrom then local a=Vector3.new(table.unpack(p.lookFrom));local b=Vector3.new(table.unpack(p.lookTo));part.CFrame=CFrame.lookAt(pos,pos+(b-a)) end
 if p.light then local l=Instance.new('SpotLight');l.Name='ParkLight';l.Face=Enum.NormalId.Bottom;l.Brightness=p.light.brightness;l.Range=p.light.range;l.Angle=p.light.angle;l.Color=Color3.fromRGB(table.unpack(p.light.color));l.Shadows=false;l.Parent=part end
 part.Parent=parent;return part
end
if data.parts then
 local folder=Instance.new('Folder');folder.Name=string.format('Batch_%03d',data.batch)
 for _,p in data.parts do make(p,folder) end
 folder.Parent=scene;task.wait()
else
 for _,m in data.models do
  local model=Instance.new('Model');model.Name=m.name
  local base=CFrame.new(table.unpack(m.position))*CFrame.Angles(0,m.yaw,0)
  for _,p in m.parts do p.position={0,0,0};local part=make(p,model);part.CFrame=base*CFrame.new(table.unpack(p.offset)) end
  model.Parent=scene
 end
 local folder=Instance.new('Folder');folder.Name='Waypoints'
 for i,pos in data.waypoints do make({name=string.format('Point_%03d',i-1),position=pos,size={.1,.1,.1},color={0,0,0},transparency=1,castShadow=false},folder) end
 folder.Parent=scene;task.wait()
end
return {park=data.id,added=data.parts and #data.parts or #data.waypoints+42}`;
}
if(mode==='sources') code=code.slice(0,code.indexOf('workspace.StreamingEnabled=false'))+"return 'Updated scripts'";
console.log(JSON.stringify({code}));
