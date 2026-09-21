# Atualizar Dashboard da Matriz e Representantes

## Objetivo
Reorganizar o painel da Matriz em indicadores operacionais e financeiros, incluir dois gráficos gerenciais e ampliar a gestão e o acompanhamento de representantes, sem remover os fluxos atuais de pedidos diretos e expediente/rotas.

## Implementação

### Dashboard da Matriz
- Substituir os indicadores atuais por dois blocos claramente identificados:
  - **Operacional:** faturamento total; pedidos pendentes com quantidade e valor; pedidos agendados com quantidade e valor; alertas de estoque baixo.
  - **Financeiro:** vendas a pagar/em aberto e boletos a receber.
- Calcular os indicadores a partir das vendas e do estoque do modo de demonstração, respeitando os status atuais de entrega e pagamento.
- Adicionar os gráficos **Produtos Mais Vendidos** e **Vendas por Cidade / Representante**, com estados vazios quando ainda não houver vendas.

### Representantes
- Ampliar a edição para nome, e-mail, status Ativo/Inativo e cidades atribuídas.
- Manter o convite e a busca atuais.
- Adicionar filtros de desempenho por data inicial e final, com atualização ao buscar.
- Exibir a tabela de desempenho com Nome, E-mail, Cidades, Status, Horas Trabalhadas, Itens Vendidos e Valor Bruto Vendido.
- Calcular horas a partir dos expedientes encerrados no período e vendas pelos dados atuais do representante.

### Preservação dos fluxos
- Manter as ações e acessos existentes da Matriz para Registro de Pedidos Diretos, Meu Expediente e Mapa de Rotas.
- Não alterar a rota interna de nenhuma tela existente.

## Validação
- Conferir os cálculos com dados de demonstração e testar edição/status de representante.
- Verificar filtros de data e tabelas em computador e celular.
- Confirmar que pedidos diretos e expediente/rotas continuam acessíveis.
