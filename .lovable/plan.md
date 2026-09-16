# Ativar modo de demonstração local

## Objetivo
Remover temporariamente toda dependência de conexão externa para que login, perfis e operações do Fruta² funcionem no navegador com dados simulados persistidos no próprio dispositivo.

## Implementação
- Criar uma camada local compatível com as consultas já usadas pelas telas, armazenando catálogo, estoque, entradas, vendas, clientes, representantes, jornadas, rotas, transferências e repasses no `localStorage`.
- Incluir uma carga inicial coerente para demonstração, com produtos, clientes, um perfil Administrador e um perfil Representante, preservando as regras de estoque e os vínculos por cidade.
- Trocar as telas e serviços para usar exclusivamente essa camada local; nenhuma ação de autenticação, leitura, gravação ou atualização em tempo real fará chamadas HTTP.
- Substituir o login Google por uma seleção local clara entre **Entrar como Matriz** e **Entrar como Representante**, mantendo sessão após atualizar a página.
- Preservar o bloqueio das páginas por perfil: Matriz com acesso administrativo completo e Representante somente a Expediente, Produtos e Clientes.
- Fazer entradas, vendas, pedidos agendados, transferências, exclusões e mudanças de status atualizarem os dados relacionados localmente, incluindo os ajustes de estoque esperados.
- Manter logout seguro, limpeza dos dados em memória e redirecionamento direto para `/login`.
- Identificar discretamente o ambiente como “Modo demonstração”, evitando confusão com dados de produção.

## Persistência e reset
- Os dados de demonstração permanecerão no mesmo navegador e dispositivo após recarregar ou fechar o app.
- Adicionar no login uma ação para restaurar os dados simulados iniciais, útil para repetir testes.
- Não migrar nem apagar os dados existentes na nuvem; este modo apenas deixará de acessá-los temporariamente.

## Validação
- Confirmar que não existe requisição para o serviço de dados ou autenticação durante login e uso das páginas.
- Testar login, atualização, logout e botão voltar nos dois perfis.
- Testar operações principais da Matriz e do Representante, incluindo persistência após atualização.
- Validar páginas administrativas no computador e as três páginas do Representante em tela de celular.
