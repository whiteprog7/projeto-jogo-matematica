import {createHmac, pbkdf2Sync, randomBytes, randomUUID} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function portablePasswordHash(password, pepper, salt) {
  if (typeof password !== 'string' || typeof pepper !== 'string' || !pepper || !/^[a-f0-9]{64}$/.test(salt)) {
    throw new Error('Parâmetros inválidos para gerar o verificador de senha.');
  }
  // Match lib/auth.ts exactly: the 64-character salt is encoded as UTF-8,
  // not decoded from hex, and PBKDF2 receives the raw HMAC bytes.
  const material = createHmac('sha256', Buffer.from(pepper, 'utf8')).update(Buffer.from(password, 'utf8')).digest();
  const hash = pbkdf2Sync(material, Buffer.from(salt, 'utf8'), 100000, 32, 'sha256').toString('hex');
  return `v1$${salt}$${hash}`;
}

export function generatePortableSecrets(destination) {
  // Refuse an existing directory, including symlinks. A repeated run must not
  // silently replace the pepper or administrative identity of an installation.
  mkdirSync(destination, {mode: 0o700});
  const password = randomBytes(18).toString('base64url');
  const pepper = randomBytes(32).toString('hex');
  const secrets = {
    AUTH_PEPPER: pepper,
    ADMIN_PROFILE_ID: randomUUID(),
    ADMIN_PASSWORD_HASH: portablePasswordHash(password, pepper, randomBytes(32).toString('hex')),
  };
  const secretsPath = path.join(destination, 'secrets.json');
  const instructionsPath = path.join(destination, 'LEIA-PRIMEIRO.txt');
  writeFileSync(secretsPath, JSON.stringify(secrets, null, 2) + '\n', {encoding: 'utf8', flag: 'wx', mode: 0o600});
  writeFileSync(instructionsPath, [
    'TUFI — ACESSO PRIVADO DE UMA INSTALAÇÃO NOVA',
    '',
    'Use estes valores somente em um banco novo, sem contas ou progresso importados.',
    'Não substitua os segredos de uma instalação existente por estes valores.',
    'A migração de contas exige preservar o AUTH_PEPPER e a identidade administrativa da origem.',
    '',
    'ID administrativo: ADM-0001',
    `Senha administrativa: ${password}`,
    '',
    'Guarde esta pasta em local privado. Não a envie ao GitHub, ao diretório público do site nem a um ZIP de distribuição.',
    'secrets.json contém os três segredos iniciais para importar no Worker de destino:',
    'pnpm exec wrangler secret bulk portable-private/secrets.json --config wrangler.portable.json',
    '',
    'O comando acima deve ser executado na raiz da cópia do projeto e na sua conta de hospedagem.',
    'O banco, o domínio e os serviços de e-mail ainda precisam ser configurados conforme docs/PORTABILIDADE.md.',
    'Este gerador não se conecta ao site, não modifica bancos e não altera senhas de contas existentes.',
    '',
  ].join('\n'), {encoding: 'utf8', flag: 'wx', mode: 0o600});
  return {secretsPath, instructionsPath};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0] !== '--new-installation') {
      throw new Error('Somente para banco novo: node scripts/generate-portable-secrets.mjs --new-installation. Não use para migrar contas existentes.');
    }
    const destination = fileURLToPath(new URL('../portable-private/', import.meta.url));
    const result = generatePortableSecrets(destination);
    console.log(`Criado: ${result.secretsPath}`);
    console.log(`Criado: ${result.instructionsPath}`);
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'portable-private já existe. Nenhum segredo existente foi sobrescrito.' : error.message);
    process.exitCode = 1;
  }
}
