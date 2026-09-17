# Tufi — 0.1.0-beta

Jogo educativo de matemática para alunos do 6º ano.

Base do jogo: regiões, missões, turmas, ranking e histórico.

Consulte [o histórico de versões](CHANGELOG.md) e [a organização do projeto](docs/ORGANIZACAO.md).


Implementação web funcional baseada nos documentos fornecidos. React, TypeScript, Vite/Vinext, API server-side e D1/SQLite. Consulte `docs/DECISOES.md` para correções e limites da entrega.

## Executado nesta versão

- Seis regiões, cinco questões por missão, questões parametrizadas, feedback explicativo, desafio final e resultado.
- Perfil com nome de aventura, histórico persistente, retomada de missão por até 24 horas, melhor pontuação por região e quatro equipamentos visuais.
- Entrada em turmas por código; criação de turmas e consultas de professor protegidas no servidor por lista de identidades autorizadas.
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
- `pnpm run dev` no ambiente de desenvolvimento compatível. A autenticação hospedada vem do dispatcher Sites; o servidor local não simula login real.
- `node tests/game.mjs`: integração da API em SQLite em memória com identidade controlada apenas no processo de teste. Nenhum bypass de desenvolvimento existe nas rotas de produção.
- `pnpm exec tsc --noEmit`

## Autorização de professor

`TEACHER_IDS` é uma variável exclusivamente de servidor: lista separada por vírgulas dos IDs de usuários da plataforma cuja função de professor foi previamente confirmada pela escola. Padrão vazio, sem concessão automática. Configure pela gestão de ambiente do Site, nunca por parâmetro do cliente. A escola deve verificar quem é professor por um procedimento institucional, e não apenas aceitar um número de RG ou domínio de e-mail.

A publicação inicial é privada e não está aberta à escola. O responsável precisa definir quem poderá acessar e providenciar as identidades autorizadas antes de uso escolar. A existência da rota não significa que um professor esteja configurado.

## Assets e tecnologia

`public/world.webp` é cenário original gerado para esta implementação. Não representa o mascote ou logo oficiais. As imagens e o modelo 3D citados no README original não foram anexados. Não foram inventados substitutos oficiais.

Esta versão web não implementa Babylon.js, modelos animados de Tufi, APK nativo para TV Box, Gmail institucional, senhas próprias ou RG/RA. O runtime hospedado usa Workers e D1; Nginx e Node/Express não são requisitos deste runtime. Um backend Node e integração escolar são trabalhos de implantação separados, não recursos já concluídos.

O treino offline e o jogo hospedado usam o mesmo gerador, publicado em `public/offline-content.js`; regenere esse arquivo a partir de `lib/content.ts` quando editar as questões. Nunca inclua resultados do treino no ranking oficial.

## Limites dos testes

Build, tipagem e testes de API/lógica executados. Não houve teste visual em navegador, teste em hardware TV Box real, validação da impressão em cada navegador, teste de Service Worker offline em aparelho real ou validação WebMCP em um contexto suportado. Conteúdo precisa de revisão pedagógica antes de uso institucional. Os 3.000 casos do gerador verificam estrutura, alternativas distintas e limites do gabarito, não certificam automaticamente a adequação curricular.
