// Opens the official Google viewer for manual inspection; does not download tiles/assets.
import {writeFile} from 'node:fs/promises';
const targets=await (await fetch('http://127.0.0.1:9334/json/list')).json();
const target=targets.find(t=>t.type==='page');
if(!target)throw Error('No browser page');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let serial=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data)),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
try{
 await cdp('Page.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});
 if(process.argv[2]!=='--current'){
  await cdp('Page.navigate',{url:process.argv[2]||'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=13.7270%2C100.5408'});
  await new Promise(r=>setTimeout(r,7000));
 }
 if(process.argv[3]==='reject-cookies'){
  await cdp('Runtime.evaluate',{expression:"(document.querySelector('#onetrust-reject-all-handler')||document.querySelector('#CybotCookiebotDialogBodyButtonDecline')||Array.from(document.querySelectorAll('button,a')).find(b=>b.textContent.trim()==='ปฏิเสธ'))?.click()"});
  await new Promise(r=>setTimeout(r,1500));
 }
 const r=await cdp('Runtime.evaluate',{expression:'JSON.stringify({title:document.title,url:location.href,text:document.body.innerText.slice(0,900)})',returnByValue:true});
 console.log(r.result.value);
 const screenshot=await cdp('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});
 await writeFile('.cache/streetview-inspection.jpg',Buffer.from(screenshot.data,'base64'));
}finally{ws.close();}
