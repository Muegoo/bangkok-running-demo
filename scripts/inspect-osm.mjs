import {readFile} from 'node:fs/promises';
for (const id of ['lumphini','benjakitti']) {
  const data=JSON.parse(await readFile(`data/raw/${id}.osm.json`,'utf8'));
  console.log(id);
  for(const e of data.elements.filter(e=>e.tags?.leisure==='park')) {
    console.log(JSON.stringify({id:e.id,type:e.type,tags:e.tags,points:e.geometry?.length,
      bounds:e.geometry?.filter(Boolean).reduce((b,p)=>[Math.min(b[0],p.lat),Math.min(b[1],p.lon),Math.max(b[2],p.lat),Math.max(b[3],p.lon)],[90,180,-90,-180])}));
  }
}
