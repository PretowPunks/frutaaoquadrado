# Consolidar a gestão de estoque da Matriz

## Resultado
- A navegação da Matriz terá uma única opção **Estoque**, mantendo internamente o endereço atual `/produtos`.
- As telas separadas de **Entradas** e **Repasses** deixarão de existir.
- A tela **Estoque** manterá o catálogo e os saldos atuais e receberá o fluxo de entrada de vários produtos em um único lote.

## Alterações
1. Remover os links de Entradas e Repasses da barra lateral e renomear visualmente Produtos para Estoque no perfil da Matriz.
2. Excluir as rotas exclusivas de Entradas e Repasses e o componente usado somente pela área de repasses, removendo também trechos de comprovantes sem outros usos.
3. Incorporar em Estoque o botão **+ Registrar Entrada de Lote** e um modal com:
   - seleção de produto;
   - quantidade e valor unitário de entrada;
   - inclusão e remoção de linhas;
   - subtotal por item e total do lote;
   - gravação conjunta em `stock_entries`, aproveitando o comportamento mockado que atualiza os saldos.
4. Após o registro, limpar o formulário, fechar o modal e recarregar a listagem para mostrar os novos saldos.
5. Manter o catálogo disponível ao representante apenas para consulta, sem exibir o controle de entrada de lote.

## Validação
- Confirmar que não restaram links ou rotas para Entradas/Repasses.
- Testar o registro de um lote com múltiplos produtos e conferir a atualização dos saldos no estoque local.
- Validar a tela em largura de computador e celular, além da compilação do projeto.

## Detalhes técnicos
- A rota `/produtos` será preservada; somente o texto exibido será alterado para **Estoque** na visão da Matriz.
- A gravação continuará usando o cliente mock existente e `localStorage`, sem trocar contratos das chamadas atuais.
