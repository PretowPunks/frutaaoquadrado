# Pedido agendado com múltiplos itens

## Objetivo

Permitir que o representante monte um único pedido com vários produtos antes de finalizar, mantendo o fluxo atual dentro do cliente selecionado e o armazenamento local de demonstração.

## Alterações

- Manter produto, quantidade/embalagem e preço unitário como campos de inclusão de item.
- Adicionar a ação **+ Adicionar ao Pedido**, validando os campos antes de incluir o produto na lista temporária.
- Exibir os itens adicionados com produto, quantidade, valor unitário, subtotal e ação de remover.
- Calcular e mostrar o valor total acumulado em tempo real.
- Exigir cliente, data de entrega e pelo menos um item para habilitar a finalização.
- Ao clicar em **Finalizar Pedido**, registrar todos os itens de uma vez, vinculados ao mesmo cliente e à mesma data de entrega.
- Limpar os itens temporários e os campos após a conclusão.

## Detalhes técnicos

- Concentrar a alteração na tela existente de Clientes/Pedidos.
- Usar estado local React para o carrinho temporário.
- Enviar os itens em uma única inserção no adaptador local, sem alterar a estrutura atual do histórico de vendas.
- Preservar a regra atual: pedidos agendados não reduzem o estoque até serem concluídos pela Matriz.
- Validar o fluxo no perfil Representante e conferir a adaptação em tela estreita.
