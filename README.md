# Fruta² - Gerenciador Ecosystem

Preciso de um controle de estoque

recebo as mercadorias e as dou entrada no sistema, o sistema deve ter uma váriavel para o valor de entrada e para o valor de saída, e uma forma de registrar a saída dos produtos.

O sistema também deve calcular o lucro bruto por produto e o valor total do estoque.

Deve ter um relatorio de produtos com baixa quantidade em estoque.

Quando eu registrar as saídas, deve haver no relatório de vendas, qual valor devo retornar ao meu fornecedor

As vendas deverão ser regitradas com as seguintes informações: produto, quantidade, cliente, e deve ser etiquetada como pago ou a pagar. O relatório de vendas do valor a retornar deve considerar as duas modalidades na incrementação do valor.

Deve haver um cadastro de clientes com dados básicos: Nome, Telefone e endereço. Os clientes poderão ser buscados pelo nome na lista de clientes e quando selecionados o sistema deve exibir suas informações cadastradas e seu histórico de compras

Permita que o login seja feito com uma conta google e dê poder de admin para o usuário allissonfilo@gmail.com, sem restrições para operar no banco de dados

para facilitar o registro de entrada, quero ter um painel com todos os produtos que vendo, com a opçãpo de cadastrar ou remover produtos da lista e de customizar as variáveis de valor de entrada e saída. Assim na hora que vou lançar as entradas, preciso preencher menos dados, agilizando o processo.

Para facilitar, já vou mandar a lista dos produtos com seus respectivos valores de entrada e saída.

também quero que no painel de registro de saída haja um campo para editar o valor de saída daquela venda específica, para o caso de algum cliente obter um valor promocional ou desconto, de modo que o balanço corresponda à realidade. Esse campo de edição do valor de saído no registro da saída deve ser preenchido automaticamente com o valor predefinio, na variável de valor de saída, mas poderá ser alterado se eu quiser

Já deixe na lista de produtos registrados os produtos abaixo com seus respectivos valores de entrada e saída

Valores de entrada:
Abacaxi R$ 13,00

Abacaxi com Hortelã R$ 14,00

Acerola R$ 14,00

Acerola com Laranja R$ 15,00

Amora R$ 25,00

Caju R$ 14,00

Cupuaçú R$ 23,00 

Frutas Amarelas R$ 18,00

Frutas Vermelhas R$ 25,00

Goiaba R$ 12,00

Graviola R$ 23,00

Limão R$ 12,00

Mamão com Laranja R$ 14,00

Manga R$ 14,00

Maracujá R$ 23,00

Maracujá com Morango R$ 23,00

Melancia R$ 12,00

Melão R$ 15,00

Morango R$ 18,00

Tamarindo R$ 18,00

Uva R$ 18,00

Abacaxi Fruta R$ 13,00

Maracujá com Semente R$ 23,00

Morango Fruta R$ 15,00

Pão de queijo R$ 20,00 

Valores de saída:
Abacaxi R$ 18,00

Abacaxi com Hortelã R$ 20,00

Acerola R$ 20,00

Acerola com Laranja R$ 21,00

Amora R$ 35,00

Caju R$ 20,00

Cupuaçú R$ 30,00

Frutas Amarelas R$ 25,00

Frutas Vermelhas R$ 30,00

Goiaba R$ 18,00

Graviola R$ 30,00

Limão R$ 18,00

Mamão com Laranja R$ 20,00

Manga R$ 20,00

Maracujá R$ 30,00

Maracujá com Morango R$ 30,00

Melancia R$ 18,00

Melão R$ 20,00

Morango R$ 25,00

Tamarindo R$ 25,00

Uva R$ 25,00

Abacaxi Fruta R$ 20,00

Maracujá com Semente R$ 30,00

Morango Fruta R$ 20,00

Pão de Queijo R$ 25,00

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://frutaaoquadrado.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f0e852aa-0981-4d73-8581-e87cd71c93b6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
