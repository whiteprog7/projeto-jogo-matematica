> v0.12.1-beta: seleção de traje confirmada pela gravação, indicação de envio e erro no guarda-roupa. Consultas antigas não substituem uma seleção já confirmada.
>
> **Cópia para outro domínio ou TV Box:** comece em [docs/PORTABILIDADE.md](docs/PORTABILIDADE.md). O código completo usa servidor e banco; o HTML offline é treino separado com seis mundos. Contas existentes e segredos não estão no repositório.

> v0.5.0-beta: login por e-mail confirmado, confirmação de endereço e redefinição de senha. Envio real depende de Resend e remetente autorizado; veja [configuração e limites](docs/RECUPERACAO_EMAIL.md).

> v0.10.0-beta: cada um dos sete mundos ganhou uma abertura narrativa própria, apresentada pelo mascote Tufi aprovado pelo responsável. A história pode ser lida em voz alta pelo navegador antes de iniciar a missão.

# Tufi e o Enigma dos Números

Implementação web funcional baseada nos documentos fornecidos. React, TypeScript, Vite/Vinext, API server-side e D1/SQLite. Consulte `docs/DECISOES.md` para correções e limites da entrega.

## Executado nesta versão

- Seis regiões, cinco questões por missão, questões parametrizadas, feedback explicativo, desafio final e resultado.
- Perfil com nome de aventura, histórico persistente, retomada de missão por até 24 horas, melhor pontuação por região e nove equipamentos com bônus pedagógicos.
- Entrada em turmas por código; criação de turmas e consultas de professor protegidas no servidor por papel aprovado e vínculo com a turma.
- Ranking por turma/região, no máximo uma linha por estudante, melhor resultado; opção de desempenho exige pelo menos 80% de acertos.
- Histórico individual e exportações CSV; impressão formatada permite salvar PDF pelo navegador.
- Treino separado em `/offline.html`, disponível offline após carregamento/preparação; histórico local sem sincronização ou validade oficial.
- Teclado/setas, preferências de som e animação, respeito a movimento reduzido e layout responsivo.
- Abertura narrativa exclusiva para cada mundo, com o Tufi em cena, botão para rever a história e narração opcional em português quando o navegador oferece síntese de voz.

## Rodar e verificar

Use Node 24 para os testes que utilizam `node:sqlite`. O gerenciador adotado é pnpm, indicado no package.json e no lockfile.

- `pnpm install`
- `pnpm run db:generate` após alterar o schema (migrations já incluídas).
- `pnpm run build`
- Para banco local: `node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fat_kinsey_walden.sql` uma única vez em um banco vazio.
- `pnpm run dev` no ambiente de desenvolvimento compatível. O login usa sessão própria por cookie seguro. Configure os segredos de autenticação no runtime para testar login; testes em memória não usam credenciais reais.
- `node tests/game.mjs`: integração da API em SQLite em memória com identidade controlada apenas no processo de teste. Nenhum bypass de desenvolvimento existe nas rotas de produção.
- `pnpm exec tsc --noEmit`

## Administração de contas

O painel `/admin` mostra o login e o e-mail confirmado das contas, permite bloquear alunos e professores, alterar papel, atribuir turma, redefinir senhas, excluir perfis, criar/editar turmas, reatribuir professor, girar código de entrada e consultar históricos. A senha atual nunca é recuperável; a redefinição cria uma senha temporária exibida uma única vez, revoga sessões e remove tokens de recuperação. A exclusão remove a conta, as sessões, os tokens, o progresso e as partidas. Alterações são registradas em auditoria; o painel mostra as 100 mais recentes.

A página inicial apresenta Aluno, Professor e Administrador; `/admin` abre a mesma entrada com Administrador selecionado. A escolha é apenas de interface: as APIs consultam sessão e permissões no servidor. O único administrador é o perfil configurado em `ADMIN_PROFILE_ID`, preservando o histórico do proprietário. O identificador de acesso administrativo deve ser fornecido diretamente ao responsável pelo jogo. Não há cadastro ou promoção pública de administradores.

O cadastro de alunos/professores gera um ID `TF-…`, salva o papel selecionado e libera o acesso imediatamente. O administrador ainda pode bloquear uma conta ou alterar seu papel. Uma conta anterior pode ser vinculada a ID/senha somente após autenticação da identidade antiga pelo dispatcher; informar um e-mail não vincula contas.

No login, o servidor identifica o tipo real da conta pelo ID ou e-mail confirmado. A escolha visual entre Aluno, Professor e Administrador não impede o acesso de uma credencial válida. Senhas temporárias usam caracteres alfanuméricos para facilitar a cópia e o formulário encerra tentativas que ultrapassem 15 segundos, permitindo tentar novamente.

`AUTH_PEPPER`, `ADMIN_PASSWORD_HASH` e `ADMIN_PROFILE_ID` são segredos de runtime geridos no Sites. A senha administrativa não está no código, banco, cliente ou arquivos de configuração; seu verificador fica no segredo. Outras senhas têm salt aleatório e PBKDF2-HMAC-SHA256 (100.000 iterações compatíveis com Workers), com pré-processamento HMAC usando pepper separado do banco. Alterar o pepper exige planejar a redefinição de todos os verificadores.

Sessões usam tokens aleatórios de 256 bits, com digest armazenado no banco, validade de 8 horas e cookie `__Host-tufi-session` HttpOnly, Secure, SameSite=Lax. Logout revoga a sessão. POSTs de autenticação/administração exigem origem correspondente. Tentativas de login têm limite por IP e identificador. Bloqueio e papel são consultados novamente nas operações protegidas. As rotas não usam bypass de desenvolvimento. A recuperação por e-mail foi implementada na v0.5.0-beta e depende da configuração do remetente. Consulte `docs/RECUPERACAO_EMAIL.md`.

O endereço permanece público e compartilhável, conforme solicitado; dados e operações do jogo exigem login. O treino offline continua público e seus resultados não valem para o ranking oficial.

## Bônus dos equipamentos

Os treze equipamentos conquistados com XP têm efeitos pedagógicos durante as missões. Além da Pulseira, Mochila, Compasso e Insígnia, esta versão adiciona o Cristal de Proteção (checklist de raciocínio), a Ampulheta Mágica (resolução em três passos), o Mapa Antigo (estratégia da região), a Poção de Revisão (exemplo resolvido) e a Chave Dourada (elimina duas alternativas incorretas). Os bônus de eliminação são validados e registrados no servidor, inclusive quando a missão é retomada.

## O Sétimo Sinal

O Reino da Divisibilidade é uma expansão secreta do conteúdo de 6º ano. Ele só aparece depois que o aluno abre os seis portais conhecidos, alcança 2.600 XP nesses mundos e resolve pelo menos cinco enigmas na Fortaleza. As últimas missões da Fortaleza apresentam pistas narrativas antes da revelação. O novo mundo trabalha múltiplos, divisores, critérios de divisibilidade e números primos, com missão, guardião, ranking, histórico, Livro do Explorador e relatórios do professor.

## Correção do treino offline

O documento é autocontido e gerado por `node scripts/build-offline.mjs`, também executado pelo build normal. `/api/practice` serve o treino e `?download=1` entrega o HTML para abrir em `file://` sem rede ou login. `/offline.html` continua como endereço compatível.

O Service Worker v2 não espera downloads na instalação, remove o cache v1, usa rede primeiro e guarda somente HTML validado do treino. Não intercepta APIs do jogo/administração nem páginas de login. Falhas de preparação têm prazo e orientação para baixar; não ficam aguardando indefinidamente. O treino também tolera armazenamento negado ou corrompido e cliques duplicados. As cópias baixadas são locais e não podem ser revogadas à distância.

Testes: `node tests/auth.mjs`, `node tests/game.mjs`, `node tests/offline.mjs` e `pnpm exec tsc --noEmit`. O teste offline executa o script completo num DOM simulado e as rotinas de cache num contexto simulado; não substitui validação em navegador/TV Box real.

## Assets e tecnologia

`public/world.webp` é cenário original gerado para esta implementação. `public/tufi-story-mascot.png` é uma interpretação visual criada a partir do guia de identidade e aprovada pelo responsável para as aberturas narrativas; não substitui o arquivo-fonte oficial citado na documentação, que não foi anexado.

Esta versão web não implementa Babylon.js, modelos animados de Tufi, APK nativo para TV Box, Gmail institucional, RG/RA. O runtime hospedado usa Workers e D1; Nginx e Node/Express não são requisitos deste runtime. Um backend Node e integração escolar são trabalhos de implantação separados, não recursos já concluídos.

O treino offline e o jogo hospedado usam o gerador de `lib/content.ts`; o build regenera o documento autocontido. Nunca inclua resultados do treino no ranking oficial.

## Limites dos testes

Build, tipagem e testes de API/lógica executados. Não houve teste visual em navegador, teste em hardware TV Box real, validação da impressão em cada navegador, teste de Service Worker offline em aparelho real ou validação WebMCP em um contexto suportado. Conteúdo precisa de revisão pedagógica antes de uso institucional. Os 3.000 casos do gerador verificam estrutura, alternativas distintas e limites do gabarito, não certificam automaticamente a adequação curricular.

## Evolução da aventura

A implementação agora inclui guia textual Tufi, missões narrativas em cinco etapas (duas missões e um guardião por região), dicas e revisão de erros sem pontos adicionais, desbloqueio sequencial validado no servidor, conquistas derivadas de resultados e Livro do Explorador. Regiões previamente visitadas são preservadas. Não houve migração de schema para esses recursos: os indicadores são derivados de `runs`.

O professor acompanha XP/portais por turma, erros por conteúdo/questão e evolução na amostra recente. Novas opções de fonte, som e animações são preferências locais. O site permanece compartilhável por link conforme autorização posterior do proprietário, com autenticação/aprovação obrigatória para recursos online protegidos.

## Equipamentos e trajes — v0.11.0-beta

Novos equipamentos: Caderno do Explorador (2.900 XP), Lente dos Enigmas (3.000 XP), Régua dos Múltiplos (3.200 XP) e Orbe do Sétimo Sinal (3.500 XP). Oferecem rascunho por questão, ampliação e destaque dos números, tabela de múltiplos de 2 a 12 e a combinação dessas três ferramentas. Não alteram a pontuação oficial.

O Guarda-roupa, em Equipamentos, mantém o Explorador clássico e adiciona Cartógrafo das Trilhas (1.500 XP) e Guardião dos Cristais (3.000 XP). O traje é salvo no perfil separadamente do equipamento e aparece nas histórias, nos guias e nos desafios. A migração 0004 adiciona apenas a coluna outfit com padrão 0, preservando histórico e equipamentos. [Artes e prompts](docs/TUFI_TRAJES_PROMPTS.md).

Teste de navegador: com o servidor local ativo e Playwright disponível, execute `node tests/game.mjs --browser`. `PLAYWRIGHT_MODULE` pode apontar para o módulo instalado e `PLAYWRIGHT_CHANNEL=msedge` usa Edge. O teste intercepta apenas o transporte HTTP e exercita a API real com SQLite isolado, sem alterar contas reais. Inclui 35 desafios, persistência de trajes, bônus, limites de XP e telas de celular.

## Redefinição de senha — v0.11.1-beta

A janela de redefinição mostra o ID de acesso junto da senha temporária. A cópia confirma sucesso, tenta uma alternativa quando o navegador restringe a área de transferência e orienta a cópia manual quando necessário. Gerar uma nova senha invalida a anterior e as sessões existentes. O administrador também libera o contador de tentativas do ID e do e-mail confirmado daquela conta, preservando os limites de IP e das demais contas.

Validação: `node tests/auth.mjs` cobre bloqueio, redefinições repetidas, aliases e revogação. Com a prévia local e Playwright disponíveis, `node tests/auth.mjs --browser` exercita geração, cópia e login em conta e banco isolados, incluindo permissões de cópia negadas.

## Senhas dos alunos — v0.12.0-beta

O painel do professor mostra o ID de acesso e permite gerar uma senha temporária somente para alunos das suas turmas. A autorização é revalidada na gravação, inclusive quando o aluno muda de turma durante a solicitação. A operação fica no registro administrativo, sem armazenar a senha em texto nesse registro.

Novas senhas temporárias emitidas pelo administrador ou professor exigem uma senha própria no primeiro acesso. A sessão permite apenas consultar a conta, sair e trocar a senha até concluir essa etapa. A troca pede a senha atual, uma nova senha de 10 a 128 caracteres e confirmação; invalida sessões e links anteriores, preservando ID, turma e progresso. Configurações também permite alterar a senha posteriormente. Contas existentes continuam funcionando; a migração 0005 adiciona apenas o indicador de troca obrigatória com padrão 0.

Os testes de autenticação incluem isolamento entre professores/turmas, aluno transferido durante a solicitação, contas bloqueadas, troca obrigatória após recarga e invalidação da senha temporária. O teste de navegador usa as rotas reais em banco isolado para percorrer professor → senha temporária → aluno → senha própria → novo login.
