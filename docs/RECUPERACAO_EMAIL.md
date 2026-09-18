# Login e recuperação por e-mail — v0.5.0-beta

O usuário pode entrar por ID ou por um e-mail confirmado. Endereços da rede estadual, escola e empresa são recomendados; pessoais também são aceitos. Um domínio institucional não concede papel de professor ou administrador.

## Fluxos

- Cadastro: nome, senha, ID gerado e e-mail recomendado. O cadastro continua pendente até aprovação do administrador. Se o envio estiver indisponível, o cadastro por ID permanece utilizável e a tela explica como vincular o endereço depois.
- Conta existente: no perfil, informar e-mail e senha atual para solicitar um vínculo. A caixa postal recebe um link válido por 30 minutos; confirmar exige a senha da conta solicitante. Só endereços confirmados passam a funcionar como login e recuperação.
- Esqueci minha senha: informar e-mail confirmado; a resposta pública é genérica, sem revelar se o endereço existe. O link vale por 20 minutos, é de uso único e permite escolher uma senha nova. O envio pode falhar no provedor; a mensagem não confirma entrega na caixa postal.
- Troca de e-mail: o endereço anterior permanece válido até a confirmação do novo. Confirmar o novo endereço revoga sessões e links pendentes.
- Recuperação administrativa: o proprietário primeiro vincula um e-mail autenticado pela senha atual. Após a redefinição, o verificador no banco substitui o segredo inicial; a senha antiga do ambiente deixa de autenticar. A identidade do administrador continua definida exclusivamente por ADMIN_PROFILE_ID.

## Configuração necessária para envio real

O fluxo está implementado com a API HTTP do Resend, mas depende de configuração externa. Na entrega inicial desta versão não há conta Resend conectada, chave de envio nem remetente verificado configurados.

Configure no ambiente do Sites:

- `APP_ORIGIN`: origem HTTPS exata do site, sem caminho adicional.
- `RESEND_API_KEY`: chave secreta com permissão de envio.
- `EMAIL_FROM`: remetente de um domínio verificado na conta do provedor.

Depois, publique uma versão para aplicar as variáveis. Não coloque valores secretos no repositório. O endereço do destinatário pode ser institucional, empresarial ou pessoal; isso é independente do domínio remetente que precisa ser autorizado. Um remetente de testes do provedor não substitui um domínio verificado para enviar a todos os usuários.

Referência: https://resend.com/docs/api-reference/emails/send-email

## Proteções e limites

Tokens aleatórios de 256 bits, digest no banco, expiração, consumo atômico, verificação de origem nas requisições e limites de tentativas. Links usam fragmento para que o token não seja enviado no caminho da requisição inicial; a página remove o fragmento após a leitura e não executa confirmação nem redefinição por GET. Nenhum token ou senha é retornado na resposta pública ou registrado em logs.

Redefinir a senha revoga sessões e outros links em uma transação. Emitir uma sessão após login exige que o verificador de senha não tenha mudado. Confirmação e recuperação não aprovam nem desbloqueiam perfis. Contas antigas não recebem e-mail confirmado automaticamente a partir do campo de contato legado.

Sem e-mail confirmado e sem a senha atual, não há recuperação automática. Não existe integração de login Google/Microsoft/OAuth nesta versão: e-mail é um identificador da conta local.

## Verificação

`node tests/auth.mjs` testa os handlers reais e substitui somente o transporte de e-mail por um serviço simulado. Cobre login por e-mail confirmado, expiração, reutilização, troca de endereço, revogação de sessões, preservação de permissões, administrador, links inválidos e falhas do provedor. Não atesta entrega em caixas de entrada reais; isso exige configurar o remetente e testar o provedor.
