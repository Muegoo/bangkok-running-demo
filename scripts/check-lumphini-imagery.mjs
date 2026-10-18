import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {inside,project} from './geometry.mjs';
const dir='data/imagery/lumphini';
await mkdir(dir,{recursive:true});
const geo=JSON.parse(await readFile('data/processed/lumphini.geojson','utf8'));
const config=JSON.parse(await readFile('data/processed/park-config.json','utf8')).parks.lumphini;
const boundary=geo.features.filter(f=>f.properties.layer==='park').flatMap(f=>f.geometry.coordinates);
const local=boundary.map(rings=>rings.map(r=>r.map(p=>project(p,config.originWgs84))));
const points=[['center',13.7304754,100.54165085],['north',13.7325,100.5417],['south',13.7284,100.5417]];
const observations=[],photos=new Map();
for(const [name,lat,lng] of points){
  const url=new URL('https://api.openstreetcam.org/2.0/photo/');
  Object.entries({lat,lng,radius:500,zoomLevel:17,join:'sequence',itemsPerPage:150,page:1}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  try{
    const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'LumphiniRobloxDemo/1.0 (small-area imagery coverage research)'}});
    const body=await res.text();
    await writeFile(`${dir}/kartaview-${name}.response.txt`,body);
    let json;try{json=JSON.parse(body);}catch{}
    const data=json?.result?.data||[];
    for(const p of data)photos.set(String(p.id),p);
    const info={name,url:String(url),status:res.status,apiStatus:json?.status,returned:data.length,pagination:json?.result?.pagination,contentType:res.headers.get('content-type')};
    observations.push(info);console.log(JSON.stringify(info));
  }catch(error){const info={name,url:String(url),error:error.message};observations.push(info);console.log(JSON.stringify(info));}
}
const classified=[...photos.values()].map(p=>({...p,insidePark:inside(project([Number(p.lng),Number(p.lat)],config.originWgs84),local)}));
await writeFile(`${dir}/kartaview-photos.json`,JSON.stringify(classified,null,2));
const report={checkedAt:new Date().toISOString(),provider:'KartaView',license:'CC-BY-SA-4.0',licenseUrl:'https://kartaview.org/terms',apiDocs:'https://kartaview.org/doc/photos',observations,uniquePhotos:classified.length,insidePark:classified.filter(p=>p.insidePark).length,outsidePark:classified.filter(p=>!p.insidePark).length,completeCoverage:false};
await writeFile(`${dir}/coverage.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({uniquePhotos:report.uniquePhotos,insidePark:report.insidePark,outsidePark:report.outsidePark}));
