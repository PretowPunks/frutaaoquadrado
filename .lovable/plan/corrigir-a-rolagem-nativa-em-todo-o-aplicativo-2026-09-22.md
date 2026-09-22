# Corrigir a rolagem nativa em todo o aplicativo

## Objetivo
Eliminar os bloqueios de rolagem global e fazer todas as telas rolarem pela janela, com comportamento consistente no touchpad, roda do mouse e toque.

## Alterações
- Remover de `html` e `body` as regras que ocultam o excesso horizontal ou desativam o comportamento vertical nativo.
- Manter altura mínima suficiente para a página e habilitar rolagem suave sem capturar eventos de toque ou ponteiro.
- Ajustar a hierarquia flex do painel principal para crescer conforme o conteúdo, sem transformar o conteúdo central em uma área de rolagem própria.
- Remover do `<main>` qualquer configuração de excesso que interfira na rolagem natural da janela, preservando a adaptação das telas e tabelas.

## Validação
- Conferir o painel e abas longas em desktop e celular.
- Testar rolagem por touchpad, roda do mouse e gesto de toque.
- Confirmar que o menu lateral continua funcional e que não foi criado deslocamento horizontal indevido.
- Verificar o estado final de compilação e erros em execução.
