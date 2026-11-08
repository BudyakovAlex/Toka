export const stations=[
 {number:1134,id:1212,name:'Спортшкола',connector:'GB/T DC'},
 {number:1315,id:1541,name:'Salt GastroBar',connector:'GB/T DC'},
 {number:1103,id:1174,name:'Sinsay',connector:'GB/T AC'}
];
export const labels={available:'🟢 Вільний',busy:'🟠 Зайнятий',disabled:'🔴 Немає відповіді / відключений',connected:'🔵 Підключений',unknown:'⚪ Невідомий'};
export function parseStation(data,station){
 if(data?.id!==station.id||!Array.isArray(data.ports)||!data.name?.includes(`#${station.number}`))throw Error('Station identity/schema mismatch');
 const ports=data.ports.filter(p=>p.title===station.connector);
 if(ports.length!==1)throw Error('Expected exactly one matching connector');
 const port=ports[0],codes={0:'available',1:'busy',2:'disabled',3:'connected',4:'unknown',5:'available'};
 if(!Number.isInteger(port.status)||!Object.hasOwn(codes,port.status))throw Error('Unknown status code');
 return {status:codes[port.status],rawStatus:port.status,power:port.power,price:port.price,checkedAt:new Date().toISOString()};
}
export async function readStation(station,fetcher=fetch){
 const r=await fetcher(`https://toka.energy/map/stations/${station.id}`,{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok){const e=Error(`TOKA HTTP ${r.status}`);e.httpStatus=r.status;e.retryAfter=r.headers.get('retry-after');throw e;}
 return parseStation(await r.json(),station);
}
export function transition(previous,current,station){
 if(!previous||previous.status===current.status)return null;
 return `⚡ TOKA #${station.number} — ${station.name}\n${station.connector}: ${labels[previous.status]||previous.status} → ${labels[current.status]}\nДжерело: TOKA · ${current.checkedAt}\nhttps://toka.energy/mapa`;
}
