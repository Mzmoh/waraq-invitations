import test from 'node:test';
import assert from 'node:assert/strict';
import {countdownParts} from '../public/invitation.js';
import {calendarText,qrMatrix} from '../public/invitation-share.js';

const now=Date.parse('2027-01-01T00:00:00Z');

test('countdown preserves days, hours, minutes and seconds',()=>{
  assert.deepEqual(countdownParts('2027-01-02T02:03:04Z',now),[1,2,3,4]);
  assert.deepEqual(countdownParts('2027-01-01T00:00:01Z',now+950),[0,0,0,1]);
});

test('started and invalid instants have no negative countdown',()=>{
  for(const instant of ['2026-12-01T00:00:00Z','2027-01-01T00:00:00Z','']) assert.equal(countdownParts(instant,now),null);
});

test('calendar uses UTC seconds, escapes commas and newlines, and folds UTF-8 safely',()=>{
  const name='حفل التخرج، '.repeat(15);
  const text=calendarText({startAt:'2027-07-01T20:30:45+03:00',title:name,message:'one,two;three\nfour'},'guest');
  assert.match(text,/DTSTART:20270701T173045Z/);
  assert.ok(text.includes('DESCRIPTION:one\\,two\\;three\\nfour'));
  assert.ok(text.replace(/\r\n /g,'').includes('SUMMARY:'+name));
  assert.ok(text.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});

test('QR grows for longer URLs and has three complete finder patterns',()=>{
  const url='https://invitation.invalid/i/abcd';
  const matrix=qrMatrix(url);
  assert.ok(qrMatrix(url+'a'.repeat(130)).length>matrix.length);
  const finder=['1111111','1000001','1011101','1011101','1011101','1000001','1111111'];
  for(const [x,y] of [[0,0],[matrix.length-7,0],[0,matrix.length-7]])
    assert.deepEqual(matrix.slice(y,y+7).map(row=>row.slice(x,x+7).map(Number).join('')),finder);
  assert.throws(()=>qrMatrix('javascript:alert(1)'));
});
