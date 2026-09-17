# Organização do projeto

- `app/`: telas React e rotas da API.
- `lib/`: regras matemáticas, progressão, autenticação e treino offline conforme a versão.
- `components/` e `hooks/`: componentes de interface e hooks.
- `db/` e `drizzle/`: schema e migrações do banco; não contêm dados de usuários.
- `public/`: imagens e arquivos públicos do jogo.
- `scripts/`, `build/` e `vendor/`: ferramentas de execução, compilação e dependências distribuídas com suas licenças.
- `tests/`: verificações automatizadas disponíveis em cada versão.
- `docs/`: decisões e documentação.

## Versões

`main` recebe o código atual. As branches `versoes/v0.1.0-beta` a `versoes/v0.4.0-beta` preservam quatro etapas reais do desenvolvimento. Para uma nova alteração, crie uma branch a partir de `main`, revise e integre o resultado antes de identificar a próxima versão. Não sobrescreva as branches históricas.

## Executar

Consulte o README da versão. Use Node 24 e pnpm, com versões fixadas no projeto. Execute `pnpm install`, `pnpm run build` e os testes disponíveis. A aplicação utiliza Workers e D1: abrir somente um HTML não substitui o servidor, as migrações e a configuração de autenticação. O treino offline é uma exceção autocontida.

## Configuração

O identificador privado de implantação foi removido de `.openai/hosting.json`; o arquivo mantém apenas os tipos de bindings. Configure seu próprio projeto de hospedagem. `.env.example` contém somente nomes e valores vazios. Segredos reais, banco em uso, contas e credenciais de administrador não são enviados ao GitHub. Clonar este código não concede acesso administrativo ao jogo publicado.

## Publicação

Este repositório armazena o código. Não há publicação automática configurada no GitHub. O site existente permanece no endereço já compartilhado, sem mudanças causadas por esta importação.
