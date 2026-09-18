> v0.5.0-beta: login por e-mail confirmado, confirmação de endereço e redefinição de senha. Envio real depende de Resend e remetente autorizado; veja [configuração e limites](docs/RECUPERACAO_EMAIL.md).

# Tufi e o Enigma dos Números

Implementação web funcional baseada nos documentos fornecidos. React, TypeScript, Vite/Vinext, API server-side e D1/SQLite. Consulte `docs/DECISOES.md` para correções e limites da entrega.

## Executado nesta versão

- Seis regiões, cinco questões por missão, questões parametrizadas, feedback explicativo, desafio final e resultado.
- Perfil com nome de aventura, histórico persistente, retomada de missão por até 24 horas, melhor pontuação por região e quatro equipamentos visuais.
- Entrada em turmas por código; criação de turmas e consultas de professor protegidas no servidor por papel aprovado e vínculo com a turma.
- Ranking por turma/região, no máximo uma linha por estudante, melhor resultado; opção de desempenho exige pelo menos 80% de acertos.
- Histórico individual e exportações CSV; impressão formatada permite salvar PDF pelo navegador.
- Treino separado em `/offline.html`, disponível offline após carregamento/preparação; histórico local sem sincronização ou validade oficial.
- Teclado/setas, preferências de som e animação, respeito a movimento reduzido e layout responsivo.

## Rodar e verificar

Use Node 24 para os testes que utilizam `node:sqlite`. O gerenciador adotado é pnpm, indicado no package.json e no lockfile.

- `pnpm install`
- `pnpm run db:generate` após alterar o schema (migrations já incluídas).
- `pnpm run build`
- Para banco local: `node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fat_kinsey_walden.sql` uma única vez em um banco vazio.
- `pnpm run dev` no ambiente de desenvolvimento compatível. O login usa sessão própria por cookie seguro. Configure os segredos de autenticação no runtime para testar login; testes em memória não usam credenciais reais.
- `node tests/game.mjs`: integração da API em SQLite em memória com identidade controlada apenas no processo de teste. Nenhum bypass de desenvolvimento existe nas rotas de produção.
- `pnpm exec tsc --noEmit`

## Administração e autorização

O painel `/admin` permite aprovar/bloquear alunos e professores, alterar papel, atribuir turma, criar/editar turmas, reatribuir professor, girar código de entrada e consultar históricos. Alterações são registradas em auditoria; o painel mostra as 100 mais recentes. Não há exclusão definitiva de pessoas ou resultados.

A página inicial apresenta Aluno, Professor e Administrador; `/admin` abre a mesma entrada com Administrador selecionado. A escolha é apenas de interface: as APIs consultam sessão e permissões no servidor. O único administrador é o perfil configurado em `ADMIN_PROFILE_ID`, preservando o histórico do proprietário. Login administrativo: `adm123` ou `ADM-0001`. Não há cadastro ou promoção pública de administradores.

O cadastro de alunos/professores gera um ID `TF-…` e uma senha própria; o perfil nasce `pending`, mesmo se o cliente enviar campos de aprovação. O administrador precisa aprovar o papel e pode bloquear o acesso. O painel permite pesquisar por nome ou ID. Uma conta anterior pode ser vinculada a ID/senha somente após autenticação da identidade antiga pelo dispatcher; informar um e-mail não vincula contas. Nenhum histórico é removido.

`AUTH_PEPPER`, `ADMIN_PASSWORD_HASH` e `ADMIN_PROFILE_ID` são segredos de runtime geridos no Sites. A senha administrativa não está no código, banco, cliente ou arquivos de configuração; seu verificador fica no segredo. Outras senhas têm salt aleatório e PBKDF2-HMAC-SHA256 (100.000 iterações compatíveis com Workers), com pré-processamento HMAC usando pepper separado do banco. Alterar o pepper exige planejar a redefinição de todos os verificadores.

Sessões usam tokens aleatórios de 256 bits, com digest armazenado no banco, validade de 8 horas e cookie `__Host-tufi-session` HttpOnly, Secure, SameSite=Lax. Logout revoga a sessão. POSTs de autenticação/administração exigem origem correspondente. Tentativas de login têm limite por IP e identificador. Bloqueio e papel são consultados novamente nas operações protegidas. As rotas não usam bypass de desenvolvimento. A recuperação por e-mail foi implementada na v0.5.0-beta e depende da configuração do remetente. Consulte `docs/RECUPERACAO_EMAIL.md`.

O endereço permanece público e compartilhável, conforme solicitado; dados e operações do jogo exigem login e aprovação. O treino offline continua público e seus resultados não valem para o ranking oficial. Cadastros pendentes veem apenas ID e situação na entrada.

## Correção do treino offline

O documento é autocontido e gerado por `node scripts/build-offline.mjs`, também executado pelo build normal. `/api/practice` serve o treino e `?download=1` entrega o HTML para abrir em `file://` sem rede ou login. `/offline.html` continua como endereço compatível.

O Service Worker v2 não espera downloads na instalação, remove o cache v1, usa rede primeiro e guarda somente HTML validado do treino. Não intercepta APIs do jogo/administração nem páginas de login. Falhas de preparação têm prazo e orientação para baixar; não ficam aguardando indefinidamente. O treino também tolera armazenamento negado ou corrompido e cliques duplicados. As cópias baixadas são locais e não podem ser revogadas à distância.

Testes: `node tests/auth.mjs`, `node tests/game.mjs`, `node tests/offline.mjs` e `pnpm exec tsc --noEmit`. O teste offline executa o script completo num DOM simulado e as rotinas de cache num contexto simulado; não substitui validação em navegador/TV Box real.

## Assets e tecnologia

`public/world.webp` é cenário original gerado para esta implementação. Não representa o mascote ou logo oficiais. As imagens e o modelo 3D citados no README original não foram anexados. Não foram inventados substitutos oficiais.

Esta versão web não implementa Babylon.js, modelos animados de Tufi, APK nativo para TV Box, Gmail institucional, RG/RA. O runtime hospedado usa Workers e D1; Nginx e Node/Express não são requisitos deste runtime. Um backend Node e integração escolar são trabalhos de implantação separados, não recursos já concluídos.

O treino offline e o jogo hospedado usam o gerador de `lib/content.ts`; o build regenera o documento autocontido. Nunca inclua resultados do treino no ranking oficial.

## Limites dos testes

Build, tipagem e testes de API/lógica executados. Não houve teste visual em navegador, teste em hardware TV Box real, validação da impressão em cada navegador, teste de Service Worker offline em aparelho real ou validação WebMCP em um contexto suportado. Conteúdo precisa de revisão pedagógica antes de uso institucional. Os 3.000 casos do gerador verificam estrutura, alternativas distintas e limites do gabarito, não certificam automaticamente a adequação curricular.

## Evolução da aventura

A implementação agora inclui guia textual Tufi, missões narrativas em cinco etapas (duas missões e um guardião por região), dicas e revisão de erros sem pontos adicionais, desbloqueio sequencial validado no servidor, conquistas derivadas de resultados e Livro do Explorador. Regiões previamente visitadas são preservadas. Não houve migração de schema para esses recursos: os indicadores são derivados de `runs`.

O professor acompanha XP/portais por turma, erros por conteúdo/questão e evolução na amostra recente. Novas opções de fonte, som e animações são preferências locais. O site permanece compartilhável por link conforme autorização posterior do proprietário, com autenticação/aprovação obrigatória para recursos online protegidos.
