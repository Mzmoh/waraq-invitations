import test from 'node:test';
import assert from 'node:assert/strict';
import entrypoint from '../../api/index.mjs';

test('Vercel entrypoint diagnoses missing configuration without leaking values and retries initialization', async t => {
 const names = ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','PUBLIC_ORIGIN','WARAQ_TRIAL_ONLY','COOKIE_SECURE'];
 const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
 const messages = [];
 t.mock.method(console, 'error', (...args) => messages.push(args.join(' ')));
 t.after(() => {
  for (const name of names) {
   if (previous[name] === undefined) delete process.env[name];
   else process.env[name] = previous[name];
  }
 });
 for (const name of names) delete process.env[name];
 const request = () => new Request('https://waraq.example/api/index?waraq_path=/robots.txt');
 const missing = await entrypoint.fetch(request());
 assert.equal(missing.status, 503);
 assert.equal(missing.headers.get('cache-control'), 'no-store');
 assert.equal((await missing.json()).error.code, 'TRIAL_NOT_CONFIGURED');
 for (const name of names) assert.ok(messages[0].includes(name));

 Object.assign(process.env, {
  DATABASE_URL:'postgresql://test:never-log-this-password@localhost:1/test',
  SUPABASE_URL:'invalid-url-with-private-marker',
  SUPABASE_SERVICE_ROLE_KEY:'never-log-this-key',
  PUBLIC_ORIGIN:'https://waraq.example',
  WARAQ_TRIAL_ONLY:'true',
  COOKIE_SECURE:'true'
 });
 const invalid = await entrypoint.fetch(request());
 assert.equal(invalid.status, 503);
 assert.doesNotMatch(messages.join('\n'), /never-log|private-marker|postgresql:/);
 assert.doesNotMatch(await invalid.text(), /never-log|private-marker|DATABASE_URL/);

 process.env.SUPABASE_URL = 'https://example.supabase.co';
 const recovered = await entrypoint.fetch(request());
 assert.equal(recovered.status, 200);
 assert.equal(await recovered.text(), 'User-agent: *\nDisallow: /\n');
});
