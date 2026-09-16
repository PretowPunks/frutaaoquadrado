# Reajustar módulos do representante e clientes

## Objetivo
Limitar o representante a **Expediente**, **Produtos** e **Clientes**, com pedidos agendados dentro do cliente, sem acesso visual ou operacional a estoque. Vincular representantes a uma ou mais cidades e restringir sua carteira de clientes a essas cidades.

## Alterações na aplicação

### 1. Acesso e navegação por perfil
- Mostrar ao representante somente **Expediente**, **Produtos** e **Clientes** no menu.
- Bloquear também o acesso por endereço direto às telas administrativas, vendas, repasses, entradas, transferências, rotas e painel, redirecionando o representante para **Expediente**.
- Manter todas as telas atuais disponíveis para a Matriz.
- Remover do Expediente do representante os blocos de estoque e venda rápida, preservando jornada, consentimento e GPS.

### 2. Catálogo para o representante
- Exibir o catálogo central da Matriz em modo somente leitura.
- Mostrar nome e preço de venda, sem quantidade em estoque, custo, alerta de estoque, edição, exclusão, exportação ou reposição inteligente.
- Manter a gestão completa de produtos e estoque para a Matriz.

### 3. Clientes e pedidos agendados
- Atualizar o cadastro com campos obrigatórios: nome, telefone, CPF/CNPJ, rua, número, bairro e cidade.
- Aplicar máscaras brasileiras de telefone e CPF/CNPJ, além de validar os dados antes de salvar.
- Exibir endereço estruturado, documento, cidade e responsável pelo cadastro na consulta da Matriz.
- Incluir no cliente selecionado a ação de registrar pedido agendado, com produto do catálogo da Matriz, quantidade, preço e data de entrega.
- O pedido do representante será criado sempre como agendado e não baixará estoque. A Matriz continuará responsável por confirmar/processar a venda; somente essa confirmação fará a baixa no estoque central.

### 4. Cidades de atuação
- Adicionar cidades de atuação em texto livre no convite do representante, permitindo uma ou várias cidades.
- Permitir que a Matriz edite as cidades de representantes já convidados.
- Restringir no banco e na interface o representante a cadastrar e consultar somente clientes cuja cidade esteja em sua lista atribuída.
- Na consulta geral da Matriz, permitir busca e identificação clara por cidade e representante responsável.

## Banco de dados e segurança
- Acrescentar ao cliente os campos de CPF/CNPJ e endereço estruturado, preservando o campo de endereço antigo para compatibilidade com registros existentes.
- Acrescentar a lista de cidades ao convite do representante.
- Substituir as permissões amplas atuais por regras específicas: representante lê o catálogo central; administra apenas clientes próprios de cidades autorizadas; cria e consulta apenas os próprios pedidos agendados; não altera estoque ou vendas concluídas.
- Ajustar os gatilhos de vendas para não baixar/devolver estoque em pedidos agendados e efetuar a baixa somente quando a Matriz concluir o pedido.
- Preservar dados antigos; as novas obrigatoriedades serão aplicadas a novos cadastros sem apagar registros existentes.

## Verificação
- Testar Matriz e Representante separadamente, incluindo tentativa de acesso direto a telas bloqueadas.
- Validar máscaras, campos obrigatórios e bloqueio de cidade não atribuída.
- Confirmar que pedido agendado não altera estoque e que sua conclusão pela Matriz altera o estoque uma única vez.
- Conferir visualização geral de clientes com cidade e representante, além de funcionamento em tela de celular.
- Validar compilação, erros em execução e regras de segurança do banco.
