import {get,put} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
import {stations,readStation,transition} from '../lib/toka.mjs';
export const maxDuration=60;
const PATH='toka-direct-v1.json',REVISION='toka-direct-v1';
const options={access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:0};
async function readState(){
 const result=await get(PATH,{access:'private',useCache:false});
 if(!result)return {state:{version:1,stations:{},pending:[]},etag:null};
 const state=await new Response(result.stream).json();
 if(state.version!==1||!state.stations||!Array.isArray(state.pending))throw Error('Invalid saved state');
 return {state,etag:result.blob.etag};
}
async function save(state,etag){
 const result=await put(PATH,JSON.stringify(state),{...options,...(etag?{ifMatch:etag}:{allowOverwrite:false})});
 return result.etag;
}
async function notify(text){
 const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text,link_preview_options:{is_disabled:true}})});
 if(!r.ok||!(await r.json()).ok)throw Error('Telegram delivery failed');
}
async function handle(request){
 const mode=new URL(request.url).searchParams.get('mode');
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(mode==='health')return json({ok:true,revision:REVISION,source:'toka.energy',minimumIntervalSeconds:120,configured:['BLOB_READ_WRITE_TOKEN','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID'].every(k=>Boolean(process.env[k]))});
 let snapshot;
 try{snapshot=await readState();}catch(e){console.error('State read failed:',e.message);return json({error:'State unavailable'},503);}
 let {state,etag}=snapshot;
 if(mode==='status')return json({revision:REVISION,stations:state.stations,lastPoll:state.lastPoll,halted:state.halted||false});
 // Preserve existing public external scheduler endpoint; CAS/throttling span instances.
 const now=Date.now();
 if(state.halted)return json({skipped:'source access restricted'},503);
 if(state.leaseUntil>now||state.nextPoll>now)return json({skipped:'interval or active check',nextPoll:state.nextPoll});
 if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)return json({error:'Telegram not configured'},503);
 state.lease=randomUUID();state.leaseUntil=now+90000;state.nextPoll=now+120000;
 try{etag=await save(state,etag);}catch(e){console.error('Acquire failed:',e.message);return json({skipped:'concurrent check or storage failure'},503);}
 let sent=0;const errors=[];
 try{
  // Outbox is at-least-once: crash after Telegram acceptance may duplicate delivery.
  while(state.pending.length){await notify(state.pending[0].text);state.pending.shift();etag=await save(state,etag);sent++;}
  const results=await Promise.allSettled(stations.map(st=>readStation(st)));
  for(let i=0;i<results.length;i++){
   const st=stations[i],result=results[i];
   if(result.status==='rejected'){
    const error=result.reason;errors.push({station:st.number,error:error.message});
    if([401,403,428].includes(error.httpStatus))state.halted=true;
    if(error.httpStatus===429){const raw=error.retryAfter;const delay=raw&&/^\d+$/.test(raw)?Number(raw)*1000:Date.parse(raw||'')-Date.now();state.nextPoll=Math.max(state.nextPoll,Date.now()+Math.max(120000,Number.isFinite(delay)?delay:900000));}
    continue;
   }
   const current=result.value,previous=state.stations[st.number];
   const text=transition(previous,current,st);
   state.stations[st.number]={...current,source:'toka.energy',sourceId:st.id,connector:st.connector};
   if(text)state.pending.push({id:randomUUID(),text});
  }
  state.lastPoll=new Date().toISOString();state.errors=errors;etag=await save(state,etag);
  while(state.pending.length){await notify(state.pending[0].text);state.pending.shift();etag=await save(state,etag);sent++;}
  return json({ok:errors.length===0,revision:REVISION,sent,stations:state.stations,errors},errors.length?502:200);
 }catch(e){console.error('Monitor failed:',e.message);return json({error:'Monitor failed; inspect logs'},502);}
 finally{delete state.lease;delete state.leaseUntil;try{await save(state,etag);}catch(e){console.error('State release failed:',e.message);}}
}
export const GET=handle;
export const POST=handle;
