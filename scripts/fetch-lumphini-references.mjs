import {mkdir,readFile,writeFile} from 'node:fs/promises';
const dir='data/imagery/lumphini';await mkdir(`${dir}/photos`,{recursive:true});
const titles=['Walking path at Lumphini Park.jpg','Lumphini Park at night, Bangkok, Thailand.jpg','Social Distancing Bench.jpg','Lumphini Clock Tower.jpg','Lumpini Park pavilion Bangkok 12.JPG','Lumphini Park main entrance roadway.JPG','Lumphini Park 9.jpg','Lumphini Park 2025 by Don Ramey Logan.jpg'];
const url=new URL('https://commons.wikimedia.org/w/api.php');
Object.entries({action:'query',titles:titles.map(t=>'File:'+t).join('|'),prop:'imageinfo',iiprop:'url|extmetadata|metadata',iiurlwidth:1280,format:'json'}).forEach(([k,v])=>url.searchParams.set(k,v));
const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'User-Agent':'LumphiniRobloxDemo/1.0 (local reference study)'}});
if(!res.ok)throw Error(`Commons HTTP ${res.status}`);
const data=await res.json();await writeFile(`${dir}/commons-metadata.json`,JSON.stringify(data,null,2));
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').replaceAll('&amp;','&').trim();
const manifest=[];
for(const page of Object.values(data.query.pages)){
 const i=page.imageinfo?.[0];if(!i)continue;
 const m=i.extmetadata,license=plain(m.LicenseShortName?.value);
 if(!/CC BY(?:-SA)? [234]|CC0|Public domain/.test(license))throw Error(`Review license: ${page.title} ${license}`);
 const name=`commons-${page.pageid}.jpg`,source=i.thumburl||i.url;
 try {
  const r=await fetch(source,{signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  if(!r.headers.get('content-type')?.startsWith('image/'))throw Error('Not an image');
  const body=Buffer.from(await r.arrayBuffer());await writeFile(`${dir}/photos/${name}`,body);
  manifest.push({title:page.title,pageId:page.pageid,author:plain(m.Artist?.value),license,licenseUrl:m.LicenseUrl?.value,sourcePage:i.descriptionurl,originalUrl:i.url,downloadUrl:source,localFile:`photos/${name}`,date:plain(m.DateTimeOriginal?.value),description:plain(m.ImageDescription?.value),changes:'None; downloaded provider thumbnail for reference only.',bytes:body.length});
  console.log(JSON.stringify({title:page.title,license,file:name,bytes:body.length}));
 } catch(e){console.log(JSON.stringify({title:page.title,error:e.message}));}
}
await writeFile(`${dir}/references.json`,JSON.stringify({retrievedAt:new Date().toISOString(),provider:'Wikimedia Commons MediaWiki API',requestUrl:String(url),note:'Individual geotagged/reference photographs, not continuous street-view coverage or photogrammetry.',images:manifest},null,2));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Lumphini · licensed photo references</title><style>body{background:#15231e;color:#edf0df;font:16px/1.6 Tahoma,Arial;margin:30px auto;max-width:1300px;padding:0 20px}h1{font-size:30px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{background:#24382e;border-radius:14px;padding:16px}img{width:100%;height:310px;object-fit:contain;background:#0e1813}a{color:#b5dcad}small{color:#c0ccb7}h2{font-size:17px}</style><h1>สวนลุมพินี — ภาพอ้างอิงที่มีใบอนุญาต</h1><p>ภาพถ่ายแยกจุดจาก Wikimedia Commons API ไม่ใช่ภาพ Street View ต่อเนื่อง และอาจไม่ตรงสภาพปัจจุบัน<br>ใช้ตรวจรายละเอียดถนน ต้นไม้ ม้านั่ง อาคาร และบรรยากาศ เก็บเครดิตของแต่ละภาพไว้ด้านล่าง</p><section>${manifest.map(p=>`<article><a href="${esc(p.sourcePage)}"><img src="${esc(p.localFile)}" alt="${esc(p.title)}"></a><h2>${esc(p.title.replace('File:',''))}</h2><small>${esc(p.date)}<br>© ${esc(p.author)} · <a href="${esc(p.licenseUrl||p.sourcePage)}">${esc(p.license)}</a><br><a href="${esc(p.sourcePage)}">Original source / attribution</a></small></article>`).join('')}</section></html>`;
await writeFile(`${dir}/index.html`,html);
console.log(`Saved ${manifest.length} licensed reference photographs.`);
