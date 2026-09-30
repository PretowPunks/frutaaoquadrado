# Login Google por Deep Link no Android

## O que será feito

- Completar as permissões Android de localização, execução contínua, notificações, internet e tela bloqueada.
- Registrar o endereço `com.fruta2.gerenciador://auth` na atividade principal para devolver o login Google ao aplicativo.
- Adicionar os recursos nativos do Capacitor para abrir o navegador e receber o retorno do login.
- No Android, iniciar o Google OAuth sem redirecionamento automático, abrir a autorização no navegador e concluir a sessão ao receber o Deep Link.
- Na web, preservar o redirecionamento Google atual.
- Sincronizar o projeto Android e validar tipos, formatação e compilação disponível no ambiente.

## Detalhes técnicos

- O retorno aceitará tanto tokens no fragmento quanto `code` para troca PKCE, cobrindo os formatos suportados pela autenticação.
- O ouvinte do Deep Link será removido ao desmontar o provedor para evitar duplicidade.
- O esquema personalizado também precisa estar autorizado nas configurações de URL do projeto externo para o provedor aceitar o retorno.
