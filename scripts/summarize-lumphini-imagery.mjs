import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='data/imagery/lumphini';
const refs=JSON.parse(await readFile(`${dir}/references.json`,'utf8'));
const karta=JSON.parse(await readFile(`${dir}/coverage.json`,'utf8'));
let mapillary;
const token=process.env.MAPILLARY_ACCESS_TOKEN;
const url=new URL('https://graph.mapillary.com/images');
Object.entries({bbox:'100.537,13.726,100.546,13.735',fields:'id,geometry,captured_at,creator',limit:1}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
try{
 const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:token?{Authorization:`OAuth ${token}`}:{}});
 const json=await res.json();
 // Never persist the authorization header or any token-bearing URL.
 await writeFile(`${dir}/mapillary.response.json`,JSON.stringify(json,null,2));
 mapillary={httpStatus:res.status,authenticated:Boolean(token),status:res.ok?'query_succeeded':'access_not_available',returned:json.data?.length||0,apiError:json.error?.message};
 console.log(JSON.stringify({provider:'Mapillary',...mapillary}));
}catch(e){mapillary={status:'connection_failed',authenticated:Boolean(token),error:e.message};}
const panoramax=JSON.parse(await readFile('.cache/lumphini-panoramax.json','utf8'));
for(const image of refs.images){
 const data=await readFile(`${dir}/${image.localFile}`);
 if(data[0]!==0xff||data[1]!==0xd8)throw Error('Not JPEG: '+image.localFile);
 image.sha256=createHash('sha256').update(data).digest('hex');
}
await writeFile(`${dir}/references.json`,JSON.stringify(refs,null,2));
const report={checkedAt:new Date().toISOString(),area:'Lumphini Park only',bbox:[100.537,13.726,100.546,13.735],
 providers:{KartaView:{status:karta.observations.every(o=>o.error)?'connection_failed':'query_completed',queries:karta.observations.length,verifiedImagery:false,note:'Timeouts do not establish absence of coverage.'},Mapillary:mapillary,Panoramax:{status:'query_succeeded',returned:panoramax.features.length,note:'No features in this API response and bounding box; not a claim about every Panoramax instance.'},WikimediaCommons:{status:'download_succeeded',downloadedImages:refs.images.length,licenseCounts:Object.fromEntries([...new Set(refs.images.map(i=>i.license))].map(l=>[l,refs.images.filter(i=>i.license===l).length]))}},
 suitableFor:'Licensed individual photo references and manual scene design alongside existing OSM geometry.',
 notVerified:['Continuous street-level imagery inside the park.','Sufficient overlapping images/calibration for photogrammetry.','Surveyed positions or dimensions for scene props.'],
 gameChanges:'None from these imagery requests. Existing evening demo retained; no claim of automatic 3D reconstruction.',
 gallery:'index.html',manifest:'references.json'};
await writeFile(`${dir}/provider-check.json`,JSON.stringify(report,null,2));
const credits=refs.images.map(i=>`- **${i.title.replace('File:','')}** — ${i.author}; ${i.license}\n  - Source: ${i.sourcePage}\n  - License: ${i.licenseUrl||'Public-domain dedication on source page'}\n  - Captured: ${i.date}; downloaded provider preview without further modification.\n`).join('\n');
const md=`# Lumphini imagery experiment\n\nChecked ${report.checkedAt}. Scope: Lumphini Park only.\n\n## Results\n\n- KartaView: three public photo requests and an alternate hostname timed out. Coverage remains unknown.\n- Mapillary: ${mapillary.status}, HTTP ${mapillary.httpStatus||'n/a'}. ${token?'A local token was used without persisting it.':'A registered application client token is required; no token from another project was used.'}\n- Panoramax: this public API returned ${panoramax.features.length} features for the recorded bounding box.\n- Wikimedia Commons: downloaded ${refs.images.length} individual reference photographs through its MediaWiki API, with author, date, source URL, license and SHA-256.\n\nOpen [index.html](index.html) for the local gallery. Photos range from 2007 to 2025 and may not represent current conditions. They are not a continuous 360-degree survey. Existing Roblox scene has not been labeled or replaced as a reconstruction from these photos.\n\n## Attribution\n\n${credits}\n## Reproduce\n\nRun scripts/check-lumphini-imagery.mjs, scripts/probe-imagery-providers.mjs, scripts/fetch-lumphini-references.mjs, then scripts/summarize-lumphini-imagery.mjs from the project root. Set MAPILLARY_ACCESS_TOKEN in the local process environment to enable authenticated Mapillary queries; never commit it. Follow each provider's rate limits and licenses.\n`;
await writeFile(`${dir}/README.md`,md);
console.log(JSON.stringify(report,null,2));
