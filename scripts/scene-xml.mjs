export function sceneXml(scene, h) {
  const {item,property,vector,color,cframe}=h;
  const materials={Grass:1280,SmoothPlastic:272,Concrete:816,Asphalt:1376,Wood:512,Neon:288,Metal:1088,Brick:848,Pavement:836,Ground:1360};
  function render(p){
    h.count();
    let cf=cframe(...p.position,p.yaw||0);
    if(p.matrix){
      cf=property('CoordinateFrame','CFrame',p.position.map((n,i)=>`<${'XYZ'[i]}>${n}</${'XYZ'[i]}>`).join('')+p.matrix.map((n,i)=>`<R${Math.floor(i/3)}${i%3}>${n}</R${Math.floor(i/3)}${i%3}>`).join(''));
    }else if(p.lookFrom){
      const back=p.lookFrom.map((n,i)=>n-p.lookTo[i]),len=Math.hypot(...back);
      const b=back.map(n=>n/len),r=[b[2],0,-b[0]],rl=Math.hypot(...r);r.forEach((n,i)=>r[i]=n/rl);
      const u=[b[1]*r[2],b[2]*r[0]-b[0]*r[2],-b[1]*r[0]];
      cf=property('CoordinateFrame','CFrame',p.position.map((n,i)=>`<${'XYZ'[i]}>${n}</${'XYZ'[i]}>`).join('')+[0,1,2].map(i=>`<R${i}0>${r[i]}</R${i}0><R${i}1>${u[i]}</R${i}1><R${i}2>${b[i]}</R${i}2>`).join(''));
    }
    const rgb=p.color.map(n=>Math.max(0,Math.min(255,Math.round(n))));
    const props=property('bool','Anchored','true')+property('bool','CanCollide',String(p.canCollide||false))+property('bool','CanTouch','false')+property('bool','CanQuery',String(p.canCollide||false))+property('bool','CastShadow',String(p.castShadow!==false))+vector('size',...p.size)+cf+property('Color3uint8','Color3uint8',0xff000000+rgb[0]*65536+rgb[1]*256+rgb[2])+property('token','Material',materials[p.material]||272)+property('token','shape',p.shape==='Ball'?0:p.shape==='Cylinder'?2:1)+property('float','Transparency',p.transparency||0)+property('float','Reflectance',p.reflectance||0);
    const l=p.light;
    const mesh=p.className==='MeshPart';
    // Roblox exposes MeshSize in Luau, but serializes the original dimensions as InitialSize.
    const meshProps=mesh?property('Content','MeshId',`<url>${p.meshId}</url>`)+property('Content','TextureID',`<url>${p.textureId}</url>`)+vector('InitialSize',...p.meshSize)+property('bool','DoubleSided',String(p.doubleSided!==false)):'';
    const label=p.label?item('SurfaceGui','Wayfinding',property('token','Face',5)+property('Vector2','CanvasSize','<X>720</X><Y>220</Y>')+property('float','LightInfluence',.1),item('TextLabel','Label',property('UDim2','Size','<XS>1</XS><XO>0</XO><YS>1</YS><YO>0</YO>')+property('float','BackgroundTransparency',1)+property('bool','TextScaled','true')+property('token','Font',18)+color('TextColor3',p.label.color)+property('string','Text',h.escape(p.label.text)))):'';
    const special=mesh||p.className==='WedgePart';
    const surface=p.surface?item('SurfaceAppearance','LeafAndBarkSurface',Object.entries({ColorMap:p.surface.colorMap,NormalMap:p.surface.normalMap,RoughnessMap:p.surface.roughnessMap,MetalnessMap:p.surface.metalnessMap}).filter(([,v])=>v).map(([k,v])=>property('Content',k,`<url>${v}</url>`)).join('')+property('token','AlphaMode',p.surface.alphaMode)):'';
    return item(mesh?'MeshPart':p.className==='WedgePart'?'WedgePart':'Part',p.name,(special?props.replace(/<token name="shape">[^<]+<\/token>/,''):props)+meshProps,(l?item('SpotLight','ParkLight',property('float','Brightness',l.brightness)+property('float','Range',l.range)+property('float','Angle',l.angle)+property('token','Face',4)+color('Color',l.color)+property('bool','Shadows',String(l.shadows!==false))):'')+label+surface);
  }
  const models=scene.models.map(m=>item('Model',m.name,'',m.parts.map(p=>{
    const [x,y,z]=p.offset,c=Math.cos(m.yaw),s=Math.sin(m.yaw);
    return render({...p,position:[m.position[0]+x*c+z*s,m.position[1]+y,m.position[2]-x*s+z*c],yaw:m.yaw});
  }).join(''))).join('');
  const points=item('Folder','Waypoints','',scene.waypoints.map((position,i)=>render({name:`Point_${String(i).padStart(3,'0')}`,position,size:[.1,.1,.1],color:[0,0,0],transparency:1,castShadow:false})).join(''));
  const additional=(scene.additionalRoutes||[]).map(route=>item('Folder',route.name,'',route.waypoints.map((position,i)=>render({name:`Point_${String(i).padStart(3,'0')}`,position,size:[.1,.1,.1],color:[0,0,0],transparency:1,castShadow:false})).join(''))).join('');
  return item('Folder','RunningExperience','',scene.parts.map(render).join('')+models+points+additional);
}
