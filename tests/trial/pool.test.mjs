import test from 'node:test';
import assert from 'node:assert/strict';
import {trialPool} from '../../server/trial/postgres.mjs';

test('trial pool preserves its configured CA and enforces certificate and hostname verification', async t => {
 const ca = 'test-only certificate authority';
 const pool = await trialPool({
  DATABASE_URL:'postgresql://test:test@localhost:6543/test?sslmode=no-verify&sslrootcert=untrusted-file',
  DATABASE_SSL_CA:ca
 });
 t.after(() => pool.end());
 assert.deepEqual(pool.options.ssl, {rejectUnauthorized:true, ca});
 assert.equal(pool.options.ssl.checkServerIdentity, undefined);
 const url = new URL(pool.options.connectionString);
 assert.equal(url.searchParams.has('sslmode'), false);
 assert.equal(url.searchParams.has('sslrootcert'), false);
 assert.equal(url.hostname, 'localhost');
 assert.equal(pool.options.max, 1);
 assert.equal(await trialPool({DATABASE_URL:pool.options.connectionString}), pool);
});

test('trial pool uses strict system trust when no custom CA is configured', async t => {
 const {trialPool:defaultPool} = await import('../../server/trial/postgres.mjs?system-trust');
 const pool = await defaultPool({DATABASE_URL:'postgresql://test:test@localhost:6543/test'});
 t.after(() => pool.end());
 assert.deepEqual(pool.options.ssl, {rejectUnauthorized:true});
});
