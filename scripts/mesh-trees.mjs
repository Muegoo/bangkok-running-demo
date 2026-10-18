export function applyMeshTrees(scene,asset){
 const trunks=scene.parts.filter(p=>p.name.startsWith('ScenicTrunk_'));
 scene.parts=scene.parts.filter(p=>!/^ScenicTrunk_|^Branch_|^LeafCrown_/.test(p.name));
 for(const trunk of trunks){
  const id=Number(trunk.name.split('_').at(-1)),scale=.82+(id%7)*.055,yaw=id*2.399963229728653,c=Math.cos(yaw),s=Math.sin(yaw);
  for(const mesh of asset.parts){
   const [lx,ly,lz,...r]=mesh.relativeCFrame;
   const matrix=[c*r[0]+s*r[6],c*r[1]+s*r[7],c*r[2]+s*r[8],r[3],r[4],r[5],-s*r[0]+c*r[6],-s*r[1]+c*r[7],-s*r[2]+c*r[8]];
   scene.parts.push({name:`NaturalTree_${id}_${mesh.name}`,className:'MeshPart',meshId:mesh.meshId,textureId:mesh.textureId,meshSize:mesh.meshSize,size:mesh.size.map(n=>n*scale),position:[trunk.position[0]+scale*(lx*c+lz*s),ly*scale,trunk.position[2]+scale*(-lx*s+lz*c)],matrix,doubleSided:true,color:[255,255,255],material:'SmoothPlastic',canCollide:false,castShadow:true});
  }
 }
 scene.info.treeAssetId=asset.assetId;
 scene.info.treeGeometry='Original generated tropical tree mesh, instanced with varied scale and heading';
 scene.info.decorativeProps=scene.parts.length;
 return scene;
}
