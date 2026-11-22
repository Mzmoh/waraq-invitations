import test from 'node:test';
import assert from 'node:assert/strict';
import {utcCandidates,localDateTime,validMap,specialFields} from '../public/editor-model.js';

test('Baghdad wall time preserves seconds and round-trips',()=>{
  const wall='2026-12-02T18:42:56';
  const instants=utcCandidates(wall,'Asia/Baghdad');
  assert.deepEqual(instants,['2026-12-02T15:42:56.000Z']);
  assert.equal(localDateTime(instants[0],'Asia/Baghdad'),wall);
});
test('daylight saving gap and overlap remain distinguishable',()=>{
  assert.deepEqual(utcCandidates('2026-03-08T02:14:03','America/New_York'),[]);
  assert.deepEqual(utcCandidates('2026-11-01T01:14:03','America/New_York'),['2026-11-01T05:14:03.000Z','2026-11-01T06:14:03.000Z']);
});
test('invalid or absent local dates yield no event',()=>{
  for(const bad of ['','2027-02-29T09:00:00','2026-01-01T25:00','bad'])
    assert.deepEqual(utcCandidates(bad,'Asia/Baghdad'),[]);
});
test('all eight occasions have specific editable field groups',()=>{
  assert.equal(Object.keys(specialFields).length,8);
  const keys=cat=>specialFields[cat].map(f=>f[0]);
  assert.ok(keys('wedding').includes('bride'));assert.ok(keys('graduation').includes('graduate'));
  assert.ok(keys('baby').includes('birthDate'));assert.ok(keys('ramadan').includes('gatheringType'));
  for(const cat of Object.keys(specialFields).filter(c=>c!=='wedding')) assert.ok(!keys(cat).includes('groom'));
  assert.deepEqual(keys('general'),[]);
});
test('map links restrict provider, scheme, path and credentials',()=>{
  for(const value of ['https://maps.app.goo.gl/ab','https://www.google.com/maps/place/Baghdad','https://goo.gl/maps/ab'])assert.ok(validMap(value));
  for(const value of ['javascript:alert(1)','https://google.com.attacker.com/maps/a','https://username@maps.google.com/x','https://google.com/login','http://maps.google.com/x'])assert.equal(validMap(value),false);
});
