# Atualizar repasses financeiros dos representantes

## Objetivo
Adequar a tela existente de repasses ao modelo em que boletos dos clientes são recebidos pela Matriz e o lucro pertence ao representante.

## Alterações
- Calcular o lucro de cada boleto pago do representante: `(valor de venda - custo) × quantidade`.
- Usar primeiro esse lucro para abater o saldo que o representante deve à Matriz.
- Quando o lucro superar o saldo devedor, deixar apenas o excedente disponível para repasse manual por PIX ou Dinheiro.
- Exigir confirmação da Matriz antes de concluir tanto o abatimento quanto o pagamento manual.
- Adicionar “Registrar Repasse Manual” à tela atual, sem criar uma nova experiência visual.
- Exibir o histórico unificado com data, representante, lucro, forma de repasse e saldo atualizado.
- Gerar um comprovante em formato de cupom na tela após a confirmação, com opção de imprimir ou salvar como PDF.

## Implementação técnica
- Manter o fluxo simulado em estado local, com tipos e funções de persistência isolados e preparados para futura integração ao banco.
- Usar os componentes, diálogos, cartões, botões e estilos já existentes no projeto.
- Preservar o fluxo atual de repasses ao fornecedor para representantes; a nova regra será aplicada à visão da Matriz.
- Validar cálculos, confirmações, histórico, comprovante e funcionamento em telas menores.
