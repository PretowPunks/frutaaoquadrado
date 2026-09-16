# ATIVAR MODO DEMO LOCAL (MOCK MÍNIMO):

Preciso destravar o carregamento do app e testar as telas de Matriz e Representante sem dependência externa do Supabase.

Aplique as seguintes alterações simples:

1. AUTENTICAÇÃO MOCK E LOGIN SELETO:

   - Substitua a conexão externa de login por dois botões simples na tela '/login': "Entrar como Matriz" e "Entrar como Representante".

   - Armazene o perfil logado no localStorage para manter a sessão ao recarregar a página (F5).

   - Ao deslogar, limpe a sessão do localStorage e redirecione para '/login'.

2. DADOS E PERMISSÕES NO LOCALSTORAGE:

   - Crie um arquivo com dados simulados básicos (catálogo de produtos, 2 clientes de teste e o cadastro dos representantes com suas cidades atribuídas).

   - Bloqueie as rotas por perfil: 

     * Matriz: Acesso completo.

     * Representante: Acesso restrito APENAS às páginas 'Expediente', 'Consulta de Produtos' e 'Cadastro/Consulta de Clientes' (filtrados pelas cidades atribuídas).

3. DESATIVE SUPABASE:

   - Desative chamadas HTTP e inicializações síncronas do Supabase que estão quebrando a renderização inicial.

Mantenha a alteração simples e direta para não quebrar a estrutura existente.