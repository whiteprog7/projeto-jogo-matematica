> Registro historico acumulado. Trechos antigos descrevem o estado de cada etapa; consulte README.md e CHANGELOG.md para a versao atual.

# Revisão de coerência — Tufi

Esta revisão acompanha a implementação e não substitui silenciosamente os anexos de origem.

| Problema nos materiais | Decisão implementada |
|---|---|
| README afirma que existem frontend, backend, OAuth e imagens, mas os anexos não incluem esses arquivos | Reconstrução funcional e README baseado no código entregue; recursos externos ausentes ficam declarados |
| Funcionamento offline e ranking seguro sem autoridade de servidor | Treino offline separado, local e sem sincronização para ranking; resultados oficiais são criados e corrigidos pelo servidor |
| Menor tempo com “maioria dos acertos” sem regra objetiva | Mínimo de 4/5 acertos na visão de desempenho; mais acertos precedem menor tempo; comparar só a mesma região |
| Pontuação acumulada pode premiar repetição infinita | XP total soma apenas o melhor resultado de cada região; relatório do professor identifica tentativas separadamente |
| Três vidas podem encerrar a aprendizagem antes do feedback | Missão com cinco etapas, sem expulsão por erro; explicação após cada resposta e nova tentativa da missão |
| Professor pode se vincular a qualquer turma | Identidade autorizada no servidor cria a própria turma; apenas alunos vinculados são acessíveis; histórico de outra turma não é exposto |
| Nome como identificador de login causa colisões | Identidade estável da plataforma e nome de aventura editável, sem depender de nome único |
| RG, RA ou domínio de e-mail tratados como prova automática de papel escolar | Não coletar RG/RA nesta versão; acesso de professor exige autorização institucional independente |
| Recompensas podem alterar acertos ou favorecer competição | Equipamentos apenas visuais, sem revelar respostas, multiplicar pontos ou pular perguntas |
| Rankings misturam alunos/questões de contextos diferentes | Ranking restrito à turma e região; ranking geral entre salas não foi ativado nesta entrega |
| Realismo 3D obrigatório sem dados do hardware nem modelo oficial | Cenário ilustrado leve e interface de jogo; Babylon/modelo oficial pendentes, sem afirmar fidelidade ao mascote ausente |
| Nginx/Express tratados como requisito universal | Implementação hospedada com React/TypeScript/Vite e API Worker + D1; implantação Node/Nginx não foi realizada |
| CSV/PDF citados sem caminho de implementação | Download CSV com neutralização de prefixos de fórmula e impressão com folha de estilo; PDF é salvo pelo navegador |
| Retentativa de rede pode duplicar acertos | Atualização condicional de etapa; reenvio da etapa já concluída retorna resultado persistido |
| Troca de turma pode transferir resultados indevidamente | Cada missão registra turma de origem; nova turma não recebe resultados antigos |

## Regras de produto

1. Seis regiões disponíveis para prática livre. Domínio é registrado a partir de 80% de acertos; não bloqueia o estudante que precisa revisar outro conteúdo.
2. Cada missão contém cinco questões geradas; o quinto desafio é apresentado como desafio do guardião. Não há um sistema completo de exploração 3D ou chefes modelados nesta versão.
3. Cada acerto vale 100 pontos. XP entre 0 e 3.000, pela soma dos melhores resultados nas seis regiões. Equipamentos em 0, 400, 1.200 e 2.400 XP.
4. Gabarito da questão atual é revelado apenas após responder. A correção oficial não recebe pontuação do cliente. Isso reduz manipulação direta, mas não é prova contra todo uso de automação ou ajuda externa.
5. Tempo é duração real da missão, incluindo leitura de feedback e pausas. Não há cronômetro regressivo nem exigência de responder rápido. O ranking de desempenho prioriza acertos.
6. Histórico limitado às 200 missões mais recentes na interface. Treino local mantém os últimos 100 resultados. Não há política automática de exclusão de registros oficiais nesta versão.
7. Perfil do aluno contém nome de aventura e vínculo de turma. A autenticação é da plataforma; não há criação/armazenamento de senha própria nem login Google nesta entrega.

## Pendências concretas de implantação escolar

- Receber `tufi_mascote_ds.png`, `LogoTufi_Madi_.png` e modelo GLB com animações/licenças para representação fiel.
- Validar nome do jogo, arte e questões com a escola. As perguntas atuais cobrem uma amostra dos conteúdos, não todo o currículo anual.
- Configurar identidades autorizadas de professores e política de acesso ao Site; a publicação inicial permanece privada ao proprietário.
- Definir e implementar integração institucional Google conforme plataforma/domínios/credenciais fornecidos. Não apresentar essa integração como pronta.
- Testar TV Box real, versão do navegador, controle, memória, WebGL, Service Worker, impressão e perda de conexão.
- Definir retenção, exclusão e gestão de turmas para operação institucional. A aplicação atual não oferece painel administrativo para essas rotinas.

## Validação executada

- Compilação da aplicação.
- Tipagem TypeScript.
- Testes automatizados da API com SQLite: identidade ausente, elevação indevida de professor, consulta de outro aluno, permissão de turma, resposta duplicada, pontuação, persistência, troca de turma e elegibilidade de ranking.
- 3.000 questões geradas com verificações estruturais e alternativas distintas.
- Inspeção da migração SQL e da imagem do cenário.
- Sem QA de navegador, hardware ou WebMCP; suporte WebMCP é opcional e só expõe leitura do progresso já visível.
