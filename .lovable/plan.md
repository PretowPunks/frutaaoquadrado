
# Sistema de Controle de Estoque

Vou construir um sistema completo de controle de estoque para sua polpa de frutas, com login Google, gestão de produtos, entradas, vendas, clientes e relatórios.

## Funcionalidades

**Autenticação**
- Login com Google
- Role de admin para `allissonfilo@gmail.com` (acesso irrestrito)
- Demais usuários: acesso operacional

**Catálogo de Produtos** (`/produtos`)
- Lista com os 25 produtos pré-cadastrados (valores de entrada/saída que você passou)
- Cadastrar/editar/remover produtos
- Editar valor de entrada e valor de saída

**Entradas de Estoque** (`/entradas`)
- Selecionar produto da lista, informar quantidade
- Valor de entrada preenchido automaticamente do cadastro (editável)
- Atualiza o estoque atual

**Vendas / Saídas** (`/vendas`)
- Selecionar produto, quantidade, cliente
- Valor de saída preenchido automaticamente (editável para promoção/desconto)
- Status: Pago ou A Pagar
- Reduz estoque automaticamente

**Clientes** (`/clientes`)
- Cadastro: Nome, Telefone, Endereço
- Busca por nome
- Ao selecionar: dados + histórico completo de compras

**Dashboard / Relatórios** (`/`)
- Valor total do estoque (soma quantidade × valor entrada)
- Lucro bruto por produto (vendas registradas: saída − entrada)
- Produtos com baixa quantidade (< 5 unidades, configurável)
- Relatório de vendas: valor a retornar ao fornecedor (soma do valor de entrada × quantidade vendida, considerando vendas Pagas E A Pagar)
- Lucro total realizado

## Estrutura técnica

**Banco (Lovable Cloud)**
- `profiles` — perfil do usuário (id, email, full_name)
- `user_roles` — tabela separada de roles (admin/user) com função `has_role` SECURITY DEFINER
- `products` — id, name, cost_price, sale_price, stock_quantity, low_stock_threshold
- `stock_entries` — id, product_id, quantity, unit_cost, created_at, created_by
- `customers` — id, name, phone, address, created_by
- `sales` — id, product_id, customer_id, quantity, unit_sale_price, unit_cost (snapshot), status (paid|unpaid), created_at, created_by

RLS: usuários autenticados leem/escrevem seus dados; admin tem acesso total (via `has_role`).

**Seed**: insere os 25 produtos com os valores que você forneceu.

**Frontend**
- TanStack Router com layout `_authenticated` protegendo rotas
- Páginas: Dashboard, Produtos, Entradas, Vendas, Clientes
- Sidebar de navegação
- Design limpo, profissional, com paleta verde/branco (tema fruta natural)

## Fora do escopo desta primeira versão
- Edição/exclusão de vendas e entradas já registradas (posso adicionar depois)
- Exportação PDF/Excel de relatórios
- Múltiplas unidades de medida

Confirma para eu construir?
