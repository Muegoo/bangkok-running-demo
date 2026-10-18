export const R = 6371008.8;
export function project([lon, lat], [lon0, lat0]) {
  return [(lon-lon0)*Math.PI/180*R*Math.cos(lat0*Math.PI/180), -(lat-lat0)*Math.PI/180*R];
}
export function inRing([x,y], ring) {
  let inside = false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function inPolygon(p, rings) { return inRing(p,rings[0]) && !rings.slice(1).some(r=>inRing(p,r)); }
export const inside = (p, polygons) => polygons.some(rings=>inPolygon(p,rings));
export const distance = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
export function clipSegment(a,b,polygons) {
  const d=[b[0]-a[0],b[1]-a[1]], cuts=[0,1];
  for(const rings of polygons) for(const ring of rings) for(let i=1;i<ring.length;i++) {
    const c=ring[i-1], e=[ring[i][0]-c[0],ring[i][1]-c[1]], den=cross(d,e);
    if(Math.abs(den)<1e-12) continue;
    const delta=[c[0]-a[0],c[1]-a[1]], t=cross(delta,e)/den, u=cross(delta,d)/den;
    if(t>0 && t<1 && u>=0 && u<=1) cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);
  const point=t=>[a[0]+d[0]*t,a[1]+d[1]*t], segments=[];
  for(let i=1;i<cuts.length;i++) {
    if(cuts[i]-cuts[i-1]>1e-10 && inside(point((cuts[i]+cuts[i-1])/2),polygons)) segments.push([point(cuts[i-1]),point(cuts[i])]);
  }
  return segments;
}
const same = (a,b) => a[0]===b[0] && a[1]===b[1];
export function stitchRings(lines) {
  const pending=lines.map(l=>l.slice()), result=[];
  while(pending.length) {
    let ring=pending.shift(), progress=true;
    while(!same(ring[0],ring.at(-1)) && progress) {
      progress=false;
      for(let i=0;i<pending.length;i++) {
        let line=pending[i];
        if(same(ring.at(-1),line.at(-1))) line=line.slice().reverse();
        if(same(ring.at(-1),line[0])) { ring.push(...line.slice(1)); pending.splice(i,1); progress=true; break; }
      }
    }
    if(ring.length<4 || !same(ring[0],ring.at(-1))) throw new Error('Unclosed or incomplete multipolygon ring');
    result.push(ring);
  }
  return result;
}
export function polygonsFromElement(element) {
  const coords = g => g.map(p=>[p.lon,p.lat]);
  if(element.type==='way') {
    if(!element.geometry?.length || element.geometry.some(p=>!p)) return [];
    const ring=coords(element.geometry);
    return ring.length>=4 && same(ring[0],ring.at(-1)) ? [[ring]] : [];
  }
  if(element.type!=='relation' || element.tags?.type!=='multipolygon') return [];
  const members=element.members.filter(m=>m.type==='way');
  if(members.some(m=>!m.geometry?.length || m.geometry.some(p=>!p))) return [];
  try {
    const outers=stitchRings(members.filter(m=>m.role!=='inner').map(m=>coords(m.geometry)));
    const inners=stitchRings(members.filter(m=>m.role==='inner').map(m=>coords(m.geometry)));
    return outers.map(r=>[r,...inners.filter(hole=>inRing(hole[0],r))]);
  } catch { return []; }
}
export function overlaps(a,b) {
  return a.some(rings=>rings[0].some(p=>inside(p,b))) || b.some(rings=>rings[0].some(p=>inside(p,a))) ||
    a.some(rings=>rings.some(ring=>ring.slice(1).some((p,i)=>clipSegment(ring[i],p,b).length)));
}
