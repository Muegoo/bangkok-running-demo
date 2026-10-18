// Reusable native Roblox XML primitives; no external model or texture assets.
export function xmlWriter(prefix='LOOP'){
 let next=0,count=0;
 const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const property=(type,name,v)=>`<${type} name="${name}">${v}</${type}>`;
 const item=(cls,name,props='',children='')=>`<Item class="${cls}" referent="${prefix}${++next}"><Properties>${property('string','Name',escape(name))}${props}</Properties>${children}</Item>`;
 const vector=(name,x,y,z)=>property('Vector3',name,`<X>${x}</X><Y>${y}</Y><Z>${z}</Z>`);
 const color=(name,[r,g,b])=>property('Color3',name,`<R>${r/255}</R><G>${g/255}</G><B>${b/255}</B>`);
 const cframe=(x,y,z,a=0)=>property('CoordinateFrame','CFrame',`<X>${x}</X><Y>${y}</Y><Z>${z}</Z><R00>${Math.cos(a)}</R00><R01>0</R01><R02>${Math.sin(a)}</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>${-Math.sin(a)}</R20><R21>0</R21><R22>${Math.cos(a)}</R22>`);
 return {escape,property,item,vector,color,cframe,count:()=>count++,get partCount(){return count;}};
}
