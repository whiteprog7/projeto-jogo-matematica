import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function portableConfig(args) {
  const allowed = new Set(['database-id', 'database-name', 'worker-name', 'origin']);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const option = args[i]?.replace(/^--/, '');
    if (!args[i]?.startsWith('--') || !allowed.has(option) || values[option] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error(`Argumento inválido ou repetido: ${args[i] || '(vazio)'}`);
    }
    values[option] = args[i + 1];
  }
  for (const option of allowed) if (!values[option]) throw new Error(`Falta --${option}.`);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(values['database-id']) || values['database-id'] === '00000000-0000-4000-8000-000000000000') {
    throw new Error('Use o UUID real do banco D1 de destino.');
  }
  for (const option of ['database-name', 'worker-name']) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(values[option])) throw new Error(`--${option} aceita de 1 a 63 letras minúsculas, números e hífens internos.`);
  }
  let origin;
  try {origin = new URL(values.origin);} catch {throw new Error('Informe --origin como https://jogo.seudominio.com.');}
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.port || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(origin.hostname)) {
    throw new Error('--origin deve ser uma origem HTTPS de domínio, sem caminho, porta, credenciais ou parâmetros.');
  }
  return {
    $schema: './node_modules/wrangler/config-schema.json',
    name: values['worker-name'],
    main: 'portable-worker.mjs',
    compatibility_date: '2026-05-15',
    compatibility_flags: ['nodejs_compat'],
    no_bundle: true,
    rules: [{type: 'ESModule', globs: ['**/*.js', '**/*.mjs']}],
    assets: {directory: 'dist/client'},
    d1_databases: [{binding: 'DB', database_name: values['database-name'], database_id: values['database-id'], migrations_dir: 'drizzle'}],
    vars: {APP_ORIGIN: origin.origin},
    routes: [{pattern: origin.hostname, custom_domain: true}],
  };
}

export function writePortableConfig(config, destination) {
  writeFileSync(destination, JSON.stringify(config, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) {
      console.log('node scripts/configure-portable.mjs --database-id UUID --database-name tufi-jogo --worker-name tufi-jogo --origin https://jogo.seudominio.com');
    } else {
      const destination = fileURLToPath(new URL('../wrangler.portable.json', import.meta.url));
      writePortableConfig(portableConfig(process.argv.slice(2)), destination);
      console.log('Criado wrangler.portable.json. Confira os dados antes de publicar. Nenhum banco ou domínio foi alterado.');
    }
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'wrangler.portable.json já existe. Preserve sua configuração; o arquivo não foi sobrescrito.' : error.message);
    process.exitCode = 1;
  }
}
