import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {generatePortableSecrets, portablePasswordHash} from '../scripts/generate-portable-secrets.mjs';

// Verify Node's derivation against the Web Crypto algorithm used by the app,
// including a non-ASCII password and UTF-8 encoding of the hexadecimal salt.
async function workerHash(password, pepper, salt) {
  const encoder = new TextEncoder();
  const hmac = await webcrypto.subtle.importKey('raw', encoder.encode(pepper), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const material = await webcrypto.subtle.sign('HMAC', hmac, encoder.encode(password));
  const key = await webcrypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  const result = await webcrypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:encoder.encode(salt), iterations:100000}, key, 256);
  return `v1$${salt}$${Buffer.from(result).toString('hex')}`;
}

const fixturePassword = 'Senha fictícia de teste';
const fixturePepper = 'pepper-ficticio-exclusivo-do-teste';
const fixtureSalt = 'abcd'.repeat(16);
assert.ok(portablePasswordHash(fixturePassword, fixturePepper, fixtureSalt) === await workerHash(fixturePassword, fixturePepper, fixtureSalt), 'O gerador deve produzir o formato reconhecido pela autenticação do jogo.');

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tufi-secrets-test-'));
try {
  const destination = path.join(temporaryRoot, 'portable-private');
  const files = generatePortableSecrets(destination);
  const original = await fs.readFile(files.secretsPath, 'utf8');
  const values = JSON.parse(original);
  const instructions = await fs.readFile(files.instructionsPath, 'utf8');
  assert.deepEqual(Object.keys(values).sort(), ['ADMIN_PASSWORD_HASH', 'ADMIN_PROFILE_ID', 'AUTH_PEPPER']);
  assert.ok(/^[a-f0-9]{64}$/.test(values.AUTH_PEPPER), 'Pepper aleatório de 32 bytes.');
  assert.ok(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values.ADMIN_PROFILE_ID), 'Identidade UUID válida.');
  assert.ok(/^v1\$[a-f0-9]{64}\$[a-f0-9]{64}$/.test(values.ADMIN_PASSWORD_HASH), 'Formato de verificador válido.');
  const password = instructions.match(/^Senha administrativa: ([A-Za-z0-9_-]{24})$/m)?.[1];
  assert.ok(password, 'Senha administrativa aleatória de 24 caracteres.');
  assert.ok(instructions.includes('ID administrativo: ADM-0001'));
  assert.ok(!original.includes(password), 'A senha em texto não deve ir para os segredos de runtime.');
  const salt = values.ADMIN_PASSWORD_HASH.split('$')[1];
  assert.ok(values.ADMIN_PASSWORD_HASH === await workerHash(password, values.AUTH_PEPPER, salt), 'A senha gerada deve autenticar com o pepper gerado.');
  assert.throws(() => generatePortableSecrets(destination), {code:'EEXIST'});
  assert.ok(await fs.readFile(files.secretsPath, 'utf8') === original, 'Nova execução não altera os segredos anteriores.');
} finally {
  // This exclusively owned test directory is below the system temporary root.
  const resolved = path.resolve(temporaryRoot);
  assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('tufi-secrets-test-'));
  await fs.rm(resolved, {recursive:true, force:true});
}
console.log('Segredos portáteis: compatibilidade com autenticação e proteção contra sobrescrita aprovadas.');
