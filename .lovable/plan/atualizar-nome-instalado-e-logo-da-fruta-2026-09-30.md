# Atualizar nome instalado e logo da Fruta²

## Objetivo
Padronizar o nome instalado como “Fruta²” e aplicar o logo anexado em todos os pontos visuais solicitados.

## Implementação
- Criar o manifesto de instalação com `name` e `short_name` definidos como “Fruta²”.
- Gerar os ícones de instalação, atalho e Apple a partir do logo anexado, com tamanhos adequados.
- Substituir o logo usado no login e na barra lateral pela imagem anexada em alta resolução.
- Atualizar o favicon e as referências no cabeçalho do aplicativo.
- Validar a instalação, o carregamento das imagens e as telas em computador e celular.

## Detalhes técnicos
- A imagem principal será servida pelos ativos do projeto; os ícones pequenos ficarão no diretório público, como exigido pelos navegadores.
- Será adicionada apenas a instalação pela tela inicial, sem modo offline ou cache de páginas.
