# Tufi — cópia do projeto, outro domínio e TV Box

Guia de portabilidade do código desta entrega. A aplicação completa usa React/Vinext, Cloudflare Workers e banco D1. O treino em arquivo HTML é uma modalidade separada e reduzida.

## O que existe em cada modalidade

| Recurso | Jogo completo com servidor e banco | Arquivo de treino offline |
| --- | --- | --- |
| Seis mundos iniciais | Sim | Exercícios livres |
| Sétimo mundo, pistas e desbloqueio | Sim | Não |
| Histórias e skins do Tufi | Sim | Não |
| Equipamentos e poderes | Sim | Não |
| Contas, turmas, professor e administrador | Sim | Não |
| XP, ranking e histórico oficial | Sim | Não |
| Histórico no aparelho | Banco do servidor | Até 100 treinos no navegador |
| Internet durante o uso | Necessária para servidor na nuvem; dispensável em rede local preparada | Dispensável depois de copiar o HTML |

A cópia do código inclui conteúdo, artes, lógica, APIs, estrutura do banco, migrações e testes. Não equivale automaticamente a uma cópia das contas atuais. Dados do servidor e segredos de autenticação precisam de transferência separada. O pacote não deve incluir senhas, chaves de serviços, cookies ou arquivos de estado do ambiente de desenvolvimento.

## Pastas importantes

- `app/`, `components/`, `hooks/` e `lib/`: interface, regras do jogo e APIs.
- `public/`: cenários, mascote, skins, fontes e arquivos públicos.
- `db/` e `drizzle/`: definição e migrações do banco, inclusive trajes e troca de senha obrigatória.
- `scripts/`, `build/` e `vendor/`: preparação da aplicação e dependências incorporadas com suas licenças.
- `dist/server/` e `dist/client/`: aplicação compilada, quando incluída no pacote.
- `public/offline.html`: treino autocontido para abrir sem servidor.
- `.env.example`: nomes das configurações; nenhum valor real deve acompanhar a entrega.

`dist/client/` sozinho não contém o jogo completo. Uma hospedagem que aceita apenas HTML/PHP não executa as APIs deste projeto. Copiar a aplicação para outro servidor Node exige adaptar o runtime `cloudflare:workers` e a camada D1; essa adaptação não está implícita neste pacote.

## Preparação do projeto

Em um computador compatível, use Node 24 e a versão de pnpm indicada em `package.json` e no lockfile. Abra o terminal na raiz da cópia extraída:

```sh
pnpm install --frozen-lockfile
pnpm run build
node tests/auth.mjs
node tests/game.mjs
node tests/offline.mjs
node tests/portable.mjs
node tests/portable-secrets.mjs
node tests/portable-secrets.mjs
pnpm exec tsc --noEmit
```

As dependências precisam de internet para a instalação inicial. O `node_modules` de outra máquina não é uma instalação portátil: contém componentes dependentes do sistema e da arquitetura. O comando `install:ci` do projeto foi preparado para um ambiente Linux específico; em uma cópia independente, prefira `pnpm install --frozen-lockfile`.

## Hospedar em uma conta Cloudflare própria

O caminho compatível com a arquitetura atual é publicar o Worker e os arquivos estáticos na sua conta Cloudflare, usando um D1 próprio. O `database_id` com zeros em `dist/server/wrangler.json` é apenas um marcador local. Não o use como banco de produção.

Conecte a conta com `pnpm exec wrangler login` e crie o banco com `pnpm exec wrangler d1 create tufi-jogo`. Copie o UUID retornado e gere a configuração na raiz:

```sh
node scripts/configure-portable.mjs --database-id UUID-REAL-DO-SEU-D1 --database-name tufi-jogo --worker-name tufi-jogo --origin https://jogo.seudominio.com
```

Substitua o UUID e o domínio pelos seus valores. Esse comando não publica nada e se recusa a sobrescrever uma configuração existente. O `wrangler.portable.json` fica fora de `dist/`, para que um novo build não o apague. A configuração gerada segue esta estrutura:

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tufi-jogo-matematica",
  "main": "portable-worker.mjs",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "no_bundle": true,
  "rules": [{"type": "ESModule", "globs": ["**/*.js", "**/*.mjs"]}],
  "assets": {"directory": "dist/client"},
  "d1_databases": [{
    "binding": "DB",
    "database_name": "tufi-jogo",
    "database_id": "PREENCHA-O-ID-DO-SEU-D1",
    "migrations_dir": "drizzle"
  }],
  "vars": {"APP_ORIGIN": "https://jogo.seudominio.com"},
  "routes": [{"pattern": "jogo.seudominio.com", "custom_domain": true}]
}
```

Para uma instalação nova, aplique as migrações:

```sh
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.portable.json
```

O Custom Domain requer o domínio na conta Cloudflare apropriada. A configuração usa o Worker como origem, com DNS/certificado geridos pela plataforma. Veja a [documentação de domínio próprio](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### Autenticação e valores de ambiente

| Nome | Função | Transferência |
| --- | --- | --- |
| `AUTH_PEPPER` | Protege os verificadores de senha | Preserve o mesmo valor ao migrar contas existentes |
| `ADMIN_PROFILE_ID` | Define a única identidade administradora | Preserve ao migrar o histórico do administrador |
| `ADMIN_PASSWORD_HASH` | Verificador inicial da senha administrativa | Deve ser gerado com o mesmo pepper; não é a senha em texto |
| `APP_ORIGIN` | Origem HTTPS usada em links por e-mail | Altere para o novo domínio, sem caminho |
| `RESEND_API_KEY` | Envio de confirmação e recuperação por e-mail | Configure sua chave de envio |
| `EMAIL_FROM` | Remetente autorizado no provedor | Configure seu remetente verificado |

Para uma instalação nova, em um banco vazio e sem contas importadas, gere as credenciais iniciais:

```sh
node scripts/generate-portable-secrets.mjs --new-installation
pnpm exec wrangler secret bulk portable-private/secrets.json --config wrangler.portable.json
```

O gerador cria `portable-private/secrets.json` com os três segredos iniciais e `portable-private/LEIA-PRIMEIRO.txt` com ID `ADM-0001` e uma senha administrativa aleatória de 24 caracteres. Ele não imprime os valores nem modifica o site ou banco. Se a pasta já existir, recusa a execução para preservar as credenciais anteriores. Leia o arquivo privado e guarde-o com segurança. Esses arquivos não acompanham o ZIP público do jogo.

**Ao migrar contas existentes, não execute esse gerador nem importe seus novos segredos:** preserve o pepper e a identidade administrativa da origem. Você pode inserir os valores corretos de forma interativa no Worker de destino:

```sh
pnpm exec wrangler secret put AUTH_PEPPER --config wrangler.portable.json
pnpm exec wrangler secret put ADMIN_PROFILE_ID --config wrangler.portable.json
pnpm exec wrangler secret put ADMIN_PASSWORD_HASH --config wrangler.portable.json
pnpm exec wrangler secret put RESEND_API_KEY --config wrangler.portable.json
pnpm exec wrangler secret put EMAIL_FROM --config wrangler.portable.json
```

Não publique esses valores em Git, no ZIP de distribuição ou no código do navegador. Consulte a [documentação de segredos do Worker](https://developers.cloudflare.com/workers/configuration/secrets/). `APP_ORIGIN` pode ficar em `vars`; configure o mesmo valor durante a geração de links do treino quando aplicável.

O formato do verificador administrativo é `v1$salt$hash`. O código em `lib/auth.ts` aplica HMAC-SHA256 com o pepper e depois PBKDF2-SHA256 com 100.000 iterações. `scripts/generate-portable-secrets.mjs` usa esse mesmo formato, incluindo a codificação UTF-8 do salt hexadecimal. Um SHA-256 simples ou senha em texto não funciona.

O login comum por ID/senha é da própria aplicação. A vinculação de uma identidade antiga pelo ChatGPT é específica do ambiente Sites. O ponto de entrada `portable-worker.mjs` remove os cabeçalhos `oai-authenticated-user-*` antes de chamar o jogo, impedindo que um visitante declare uma identidade antiga em um servidor independente. Preserve esse ponto de entrada no deploy próprio. Contas existentes com ID/senha continuam usando a autenticação própria; a vinculação legada pelo ChatGPT não está disponível fora do Sites.

Depois do banco e das configurações, valide o build e publique:

```sh
pnpm exec wrangler deploy --dry-run --config wrangler.portable.json
pnpm exec wrangler deploy --config wrangler.portable.json
```

Faça uma verificação no novo endereço: cadastro, login, administrador, turma, missão, seleção de traje e nova senha temporária. A publicação em outra conta/domínio não foi executada apenas por preparar este pacote.

## Transferir as contas e o progresso atuais

Os dados estão no banco remoto, não dentro de `public/` nem do repositório. É necessário obter um backup SQL completo da origem por um acesso administrativo autorizado. O projeto hospedado pelo Sites pode não aparecer como banco na sua conta Cloudflare pessoal: nesse caso, os comandos da sua conta não exportam os dados do Sites.

Quando você possui acesso ao D1 de origem, a exportação oficial é:

```sh
pnpm exec wrangler d1 export BANCO_ORIGEM --remote --output backup-tufi.sql
```

Importe o SQL em um D1 vazio de destino:

```sh
pnpm exec wrangler d1 execute DB --remote --file backup-tufi.sql --config wrangler.portable.json
```

O backup inclui estrutura e dados: não aplique novamente todas as migrações iniciais sobre as tabelas já importadas. Confira a versão do schema e o histórico de migrações antes de futuras atualizações. Referência: [importação e exportação D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

Preserve `profiles`, `accounts`, `classes`, `runs` e `audit` para manter identidades, vínculos, resultados e registros. As tabelas `sessions`, `email_tokens` e `auth_limits` também fazem parte do schema, mas sessões e links antigos devem ser revogados no destino para iniciar a mudança de domínio com novo login. Faça essa limpeza somente no banco de destino, depois do backup, por operação administrativa controlada.

Sem o pepper original, os hashes de senha exportados não podem autenticar as senhas atuais. Nesse caso, será necessário configurar o novo segredo e redefinir as senhas. Não existe recuperação da senha em texto a partir do banco. A preservação de contas deve ser declarada concluída somente depois de importar o backup, configurar os valores corretos e testar os acessos.

## Rodar localmente com o jogo completo

É possível usar o runtime local do Wrangler em um computador compatível, com banco local e configurações próprias. Isso é diferente de instalar um APK na TV Box. Crie uma cópia da configuração acima sem `routes`, mantenha o binding `DB`, use um arquivo de segredos local ignorado pelo Git e inicialize um banco vazio:

```sh
pnpm exec wrangler d1 migrations apply DB --local --persist-to .wrangler/state --config wrangler.portable.json
pnpm exec wrangler dev --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8787 --config wrangler.portable.json
```

Para a instalação local nova, após gerar as credenciais, transforme o JSON em `.dev.vars` na raiz (não envie esse arquivo ao Git):

```sh
node --input-type=module -e "import fs from 'node:fs'; const values=JSON.parse(fs.readFileSync('portable-private/secrets.json','utf8')); fs.writeFileSync('.dev.vars',Object.entries(values).map(([k,v])=>k+'='+JSON.stringify(v)).join(String.fromCharCode(10))+String.fromCharCode(10),{flag:'wx'});"
```

O arquivo contém valores privados. Preserve-o na instalação local; para e-mail local, os valores opcionais do provedor precisam ser configurados também.

Use sempre o mesmo caminho de persistência. Faça backups próprios do banco local; a cópia remota não se sincroniza automaticamente com ele. O login exige `AUTH_PEPPER`, a administração exige configuração administrativa e os e-mails exigem acesso ao serviço externo. O jogo e seu banco locais podem funcionar sem internet após a instalação e a configuração, enquanto o serviço de e-mail continuará dependendo da rede.

Para uma TV Box acessar esse computador pela rede, será preciso um endereço local alcançável e HTTPS confiável no aparelho. O cookie `__Host-tufi-session` é `Secure`; servir simplesmente `http://192.168...` não constitui uma instalação correta do login. Configure um proxy HTTPS no computador, preserve a origem recebida e use certificado confiável para o nome escolhido. Não remova a proteção do cookie para contornar isso. O comando padrão `pnpm start` escuta apenas `127.0.0.1` e não cria esse acesso de rede por conta própria.

O sistema operacional e a arquitetura da TV Box precisam ser conhecidos antes de prometer que o runtime do servidor pode ser instalado nela. Não há APK nativo neste projeto. Um navegador no aparelho pode acessar a instalação HTTPS; executar Node/Wrangler diretamente no aparelho depende de compatibilidade ainda a verificar.

## Treino offline na TV Box

Copie `public/offline.html` para o aparelho, por USB ou outro meio disponível. Extraia o ZIP antes de abrir o arquivo em um navegador que execute JavaScript. Escolha a região e inicie o treino. O arquivo contém o necessário para as questões; a opção de voltar à aventura exige acesso ao servidor do jogo.

As setas percorrem controles e o botão OK/Enter pode acioná-los quando o navegador do aparelho oferece navegação por foco. Se o controle não funcionar adequadamente, use teclado ou mouse compatível. Nenhum teste em hardware TV Box específico é presumido.

O histórico pertence ao navegador e ao arquivo/origem; permissões do navegador podem impedir a gravação. Limpar os dados do navegador pode apagar os treinos. Esse histórico não sincroniza com alunos, turmas, XP ou ranking. O sétimo mundo, as skins e os equipamentos ficam no jogo completo com servidor.

## Como conferir a cópia recebida

Confira o manifesto do ZIP e seus hashes, quando fornecidos. O conjunto de código, arquivos públicos, migrações e instruções permite reconstruir a aplicação. Os valores secretos, um backup real do banco e a configuração do novo domínio são itens separados; não devem ser apresentados como incluídos se não foram efetivamente exportados e entregues. Guarde backups privados fora de pastas públicas e fora do repositório do código.
