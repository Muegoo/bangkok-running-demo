import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';

const cache='.cache/roblox-mcp';
await mkdir(cache,{recursive:true});
const versionsRoot=join(process.env.LOCALAPPDATA,'Roblox/Versions');
const copies=await Promise.all((await readdir(versionsRoot)).map(async dir=>{
  const path=join(versionsRoot,dir,'StudioMCP.exe');
  try{return {path,mtime:(await stat(path)).mtimeMs}}catch{return null}
}));
const executable=process.env.ROBLOX_MCP_EXE || copies.filter(Boolean).sort((a,b)=>b.mtime-a.mtime)[0]?.path;
if(!executable) throw new Error('Roblox Studio MCP is not installed.');
const child=spawn(executable,[],{windowsHide:true,stdio:['pipe','pipe','pipe']});
const pending=new Map();let nextId=0,stderr='';
child.stderr.on('data',chunk=>{stderr+=chunk.toString()});
child.on('error',err=>{for(const {reject} of pending.values()) reject(err)});
child.on('exit',code=>{for(const {reject} of pending.values()) reject(new Error(`MCP exited (${code}): ${stderr.slice(-2000)}`))});
const lines=createInterface({input:child.stdout});
lines.on('line',line=>{
  let msg;try{msg=JSON.parse(line)}catch{return}
  if(msg.id!==undefined&&pending.has(msg.id)) {pending.get(msg.id).resolve(msg);pending.delete(msg.id)}
});
async function rpc(method,params={},timeoutMs=45000) {
  const id=++nextId;
  let timer;
  const result=new Promise((resolve,reject)=>{timer=setTimeout(()=>{pending.delete(id);reject(new Error(`MCP timeout: ${method}; ${stderr.slice(-1000)}`))},timeoutMs);pending.set(id,{resolve,reject})});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  try {const msg=await result;if(msg.error)throw new Error(JSON.stringify(msg.error));return msg.result} finally{clearTimeout(timer)}
}
async function saveResult(name,result) {
  const stem=`${Date.now()}-${name}`;
  await writeFile(join(cache,`${stem}.json`),JSON.stringify(result,null,2));
  const printable={...result,content:[]};
  for(let i=0;i<(result.content||[]).length;i++) {
    const c=result.content[i];
    if(c.type==='image') {
      const path=join(cache,`${stem}-${i}.${c.mimeType==='image/jpeg'?'jpg':'png'}`);
      await writeFile(path,Buffer.from(c.data,'base64'));
      printable.content.push({type:'saved_image',path,mimeType:c.mimeType});
    } else printable.content.push(c);
  }
  console.log(JSON.stringify(printable,null,2));
}
try {
  const initialized=await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'BangkokRunningDemo',version:'0.1.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  if(process.argv[2]==='session') {
    await new Promise(resolve=>setTimeout(resolve,2500));
    console.log(JSON.stringify({ready:true,server:initialized.serverInfo}));
    const input=createInterface({input:process.stdin});
    for await(const line of input) {
      if(!line.trim()) continue;
      try {
        const command=JSON.parse(line);
        if(command.close) {input.close();break}
        const result=await rpc('tools/call',{name:command.name,arguments:command.arguments||{}},90000);
        await saveResult(command.name,result);
      }catch(error){console.log(JSON.stringify({error:error.message}))}
    }
  } else if(process.argv[2]==='tools') {
    let result=await rpc('tools/list');
    if(!result.tools?.length) {
      console.error('MCP connected; waiting briefly for Studio to advertise tools...');
      await new Promise(resolve=>setTimeout(resolve,5000));
      result=await rpc('tools/list');
    }
    await writeFile(join(cache,'tools.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({server:initialized.serverInfo,tools:result.tools.map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema}))},null,2));
  } else {
    const name=process.argv[2];
    const args=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):{};
    // Studio discovery follows initialize asynchronously; retain the session while peers register.
    await new Promise(resolve=>setTimeout(resolve,1500));
    let result=await rpc('tools/call',{name,arguments:args},90000);
    if(name==='list_roblox_studios') {
      for(let attempt=0;attempt<4;attempt++) {
        const text=result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n') || '';
        if(!text.includes('"studios":[]')) break;
        await new Promise(resolve=>setTimeout(resolve,2000));
        result=await rpc('tools/call',{name,arguments:args},90000);
      }
    }
    await saveResult(name,result);
  }
} finally {child.stdin.end();child.kill();lines.close()}
