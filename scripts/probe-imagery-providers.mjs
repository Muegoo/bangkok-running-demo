import {writeFile} from 'node:fs/promises';
const urls=[
 ['kartaview-alternate','https://api.kartaview.org/2.0/photo/?lat=13.7304754&lng=100.54165085&radius=500'],
 ['panoramax','https://api.panoramax.xyz/api/search?bbox=100.537,13.726,100.546,13.735&limit=5'],
 ['commons','https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=Category:Lumphini_Park&gcmtype=file&gcmlimit=100&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1000&format=json'],
];
await Promise.allSettled(urls.map(async([name,url])=>{
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumphiniRobloxDemo/1.0 (local small-area reference study)'}});
  const t=await r.text();await writeFile(`.cache/lumphini-${name}.json`,t);
  console.log(JSON.stringify({name,status:r.status,length:t.length,preview:t.slice(0,160)}));
 }catch(e){console.log(JSON.stringify({name,error:e.message,cause:e.cause?.message}));}
}));
