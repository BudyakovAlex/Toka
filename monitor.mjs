import fs from 'node:fs/promises';
const stations=[
{id:1134,name:'Спортшкола',url:'https://carcharger.city/stantsii/01m084fvt06t4fcx5q5cmpvfd4-boryspil-toka-1134-sports-school-fast-charger-toka/'},
{id:1315,name:'Salt GastroBar',url:'https://carcharger.city/stantsii/01m084ngbqqswq98qt358zgay5-boryspil-toka-1315-salt-gastrobar-fast-charger-toka/'},
{id:1103,name:'Sinsay',connector:'GB/T AC',url:'https://carcharger.city/merezhi/toka/boryspil/'}
];
const token=process.env.TELEGRAM_BOT_TOKEN,chatId=process.env.TELEGRAM_CHAT_ID;
if(!token||!chatId)throw Error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in GitHub Actions secrets');
let state={};try{state=JSON.parse(await fs.readFile('state.json','utf8'))}catch{}
const next={...state};
for(const station of stations){
 let status='unknown';
 try{
  const response=await fetch(station.url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=(await response.text()).replace(/<script[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  const connector=station.connector||'GB/T DC';
  const i=html.indexOf(connector);
  if(i>=0){
   const part=html.slice(i,i+180);
   const suffix=part.slice(connector.length).trimStart();
   if(/^(?:Вільний|Вільно|Доступний)/i.test(suffix))status='available';
   else if(/^(?:Зайнято|Зайнятий|Заряджається)/i.test(suffix))status='busy';
   else if(/^(?:Відключений|Недоступний)/i.test(suffix))status='disabled';
  }
 }catch(e){console.warn(station.id,e.message)}
 const previous=state[station.id]?.status??'unknown';
 console.log(station.id,previous,'=>',status);
 // Send availability changes once; report unavailable/unknown on every scheduled check.
 let message=null;
 if(status==='available'&&previous!=='available')
  message='⚡ TOKA #'+station.id+' — '+station.name+'\n🟢 '+(station.connector||'GB/T DC')+': доступний\n'+station.url;
 else if(status==='disabled')
  message='⚡ TOKA #'+station.id+' — '+station.name+'\n🔴 '+(station.connector||'GB/T DC')+': відключений (перевірка кожні 5 хв)\n'+station.url;
 else if(status==='unknown')
  message='⚡ TOKA #'+station.id+' — '+station.name+'\n⚪ '+(station.connector||'GB/T DC')+': статус невідомий; доступність не підтверджена\n'+station.url;
 if(message){
  const r=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:message})});
  const result=await r.json();
  if(!r.ok||!result.ok)throw Error('Telegram send failed: '+(result.description||r.status));
 }
 // Unknown is not proof of outage; retain last known state to avoid false alerts
 if(status!=='unknown')next[station.id]={status,checkedAt:new Date().toISOString()};
}
await fs.writeFile('state.json',JSON.stringify(next,null,2)+'\n');
