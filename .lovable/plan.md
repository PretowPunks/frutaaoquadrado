# Conectar ao Supabase externo

## Alterações
- Criar uma configuração própria do aplicativo para o cliente externo, usando a URL base e a chave pública fornecidas.
- Trocar todas as telas e consultas para esse cliente, sem alterar o cliente gerenciado do Lovable Cloud.
- Fazer o login Google diretamente no projeto externo, mantendo a volta para a origem atual do aplicativo.
- Verificar a conexão pública, o carregamento da tela de login e os erros de compilação.

## Observações
- A chave `sb_publishable_` é pública por definição e precisa chegar ao navegador; ela não será exibida na interface nem registrada em logs.
- O banco externo precisa conter as mesmas tabelas, políticas e funções esperadas pelo aplicativo.
- O provedor Google e as URLs de redirecionamento precisam estar configurados no projeto externo para o login funcionar.

## Detalhes técnicos
- A URL usada será `https://mgpvnewdfqmzxohtdlou.supabase.co`, sem `/rest/v1/`.
- Os imports atuais serão redirecionados para um cliente externo isolado, evitando editar arquivos gerenciados automaticamente.
