import test from 'node:test';
import assert from 'node:assert/strict';
import {stations,parseStation,readStation,transition} from './lib/toka.mjs';
const sample=(status=0)=>({id:1212,name:'TOKA #1134 Sports school Fast Charger',ports:[{title:'GB/T DC',status,power:160}]});
test('correct TOKA codes, free variants have same meaning',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(n=>parseStation(sample(n),stations[0]).status),['available','busy','disabled','connected','unknown','available']);
 assert.equal(transition(parseStation(sample(0),stations[0]),parseStation(sample(5),stations[0]),stations[0]),null);
});
test('silent baseline and unchanged; real change creates message',()=>{
 const a=parseStation(sample(0),stations[0]),b=parseStation(sample(1),stations[0]);
 assert.equal(transition(null,a,stations[0]),null);
 assert.equal(transition(a,a,stations[0]),null);
 const text=transition(a,b,stations[0]);assert.match(text,/1134/);assert.match(text,/GB\/T DC/);assert.match(text,/→/);assert.ok(text.includes('\n'));
});
test('reject wrong station, missing/duplicate connectors and new status codes',()=>{
 assert.throws(()=>parseStation({...sample(),id:1134},stations[0]));
 assert.throws(()=>parseStation({...sample(),ports:[]},stations[0]));
 assert.throws(()=>parseStation({...sample(),ports:[...sample().ports,...sample().ports]},stations[0]));
 assert.throws(()=>parseStation(sample(99),stations[0]));
});
test('HTTP error is an error, never disabled status',async()=>{
 await assert.rejects(readStation(stations[0],async()=>new Response('{}',{status:429,headers:{'retry-after':'120'}})),e=>e.httpStatus===429&&e.retryAfter==='120');
});
