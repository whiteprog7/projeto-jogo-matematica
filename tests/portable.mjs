import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {portableConfig, writePortableConfig} from '../scripts/configure-portable.mjs';

const args = ['--database-id', '11111111-2222-4333-8444-555555555555', '--database-name', 'tufi-test', '--worker-name', 'tufi-test', '--origin', 'https://jogo.example.com'];
const config = portableConfig(args);
assert.equal(config.main, 'portable-worker.mjs');
assert.equal(config.d1_databases[0].binding, 'DB');
assert.equal(config.d1_databases[0].migrations_dir, 'drizzle');
assert.equal(config.vars.APP_ORIGIN, 'https://jogo.example.com');
assert.deepEqual(config.routes, [{pattern: 'jogo.example.com', custom_domain: true}]);
for (const bad of [[], [...args, '--origin', 'https://other.example.com'], [...args, '--unknown', 'value'], args.map(v => v === 'https://jogo.example.com' ? 'http://jogo.example.com' : v), args.map(v => v === 'https://jogo.example.com' ? 'https://jogo.example.com/path' : v), args.map(v => v === 'tufi-test' ? '../escape' : v), args.map(v => v === '11111111-2222-4333-8444-555555555555' ? '00000000-0000-4000-8000-000000000000' : v)]) {
  assert.throws(() => portableConfig(bad));
}

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tufi-portable-'));
try {
  const output = path.join(directory, 'wrangler.portable.json');
  writePortableConfig(config, output);
  assert.throws(() => writePortableConfig({...config, name: 'changed'}, output), {code: 'EEXIST'});
  assert.equal(JSON.parse(await fs.readFile(output, 'utf8')).name, 'tufi-test');

  // Load the real wrapper against a small Worker fixture; production build and
  // secrets are not used in this request-boundary test.
  const source = await fs.readFile(new URL('../portable-worker.mjs', import.meta.url), 'utf8');
  const expectedImport = "import worker from './dist/server/index.js';";
  assert.ok(source.startsWith(expectedImport));
  await fs.writeFile(path.join(directory, 'fixture.mjs'), `export default { marker:'preserved', async fetch(request,env,ctx){return Response.json({headers:Object.fromEntries(request.headers),method:request.method,body:await request.text(),env:env.marker,ctx:ctx.marker})} };`);
  await fs.writeFile(path.join(directory, 'wrapper.mjs'), source.replace(expectedImport, "import worker from './fixture.mjs';"));
  const worker = (await import(pathToFileURL(path.join(directory, 'wrapper.mjs')).href)).default;
  assert.equal(worker.marker, 'preserved');
  const request = new Request('https://jogo.example.com/api/auth', {method:'POST', headers:{'oai-authenticated-user-id':'forged', 'OAI-Authenticated-User-Email':'fake@example.com', 'oai-authenticated-user-arbitrary':'forged', 'origin':'https://jogo.example.com', 'cookie':'__Host-tufi-session=fixture', 'content-type':'application/json'}, body:JSON.stringify({action:'link'})});
  const response = await worker.fetch(request, {marker:'env'}, {marker:'ctx'});
  const result = await response.json();
  assert.ok(!Object.keys(result.headers).some(name => name.startsWith('oai-authenticated-user-')));
  assert.equal(result.headers.origin, 'https://jogo.example.com');
  assert.equal(result.headers.cookie, '__Host-tufi-session=fixture');
  assert.equal(result.method, 'POST');
  assert.equal(result.body, JSON.stringify({action:'link'}));
  assert.equal(result.env, 'env');
  assert.equal(result.ctx, 'ctx');
} finally {
  await fs.rm(directory, {recursive:true, force:true});
}
console.log('Portabilidade: configuração validada, preservação de arquivos e isolamento de identidade aprovados.');
