import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('data/raw', { recursive: true });
const parks = [
  { id: 'lumphini', name: 'สวนลุมพินี', bbox: [13.7235, 100.5345, 13.7365, 100.5475] },
  { id: 'benjakitti', name: 'สวนเบญจกิติ', bbox: [13.722, 100.547, 13.737, 100.563] },
];
for (const park of parks) {
  const [s,w,n,e] = park.bbox;
  const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`;
  console.log(`Fetching ${park.id}: ${url}`);
  const response = await fetch(url, { headers: { 'User-Agent': 'BangkokRunningDemo/0.1 (local prototype)' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`OSM ${response.status}: ${(await response.text()).slice(0,300)}`);
  const data = await response.json();
  const nodes = new Map(data.elements.filter(e=>e.type==='node').map(n=>[n.id,n]));
  const ways = new Map(data.elements.filter(e=>e.type==='way').map(w=>[w.id,w]));
  for (const element of data.elements) {
    if (element.type === 'way') element.geometry = element.nodes.map(id=>nodes.get(id)).map(n=>n ? {lat:n.lat,lon:n.lon} : null);
    if (element.type === 'relation') for (const member of element.members) {
      if (member.type === 'way') member.geometry = ways.get(member.ref)?.geometry;
    }
  }
  const fetchedAt = new Date().toISOString();
  await writeFile(`data/raw/${park.id}.osm.json`, JSON.stringify(data));
  await writeFile(`data/raw/${park.id}.source.json`, JSON.stringify({ ...park, url, fetchedAt,
    license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', copyrightUrl: 'https://www.openstreetmap.org/copyright',
  },null,2));
  console.log(`${park.id}: ${data.elements.length} elements, ${ways.size} ways`);
}
