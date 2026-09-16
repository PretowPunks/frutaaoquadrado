# Corrigir navegação e autenticação

## Objetivo
Impedir a tela de erro ao entrar, sair ou atualizar a aplicação, garantindo que páginas privadas só sejam abertas após a sessão e a permissão estarem resolvidas.

## Implementação
- Tornar o estado de autenticação previsível, com uma única inicialização de sessão, descarte seguro de respostas antigas e limpeza imediata de sessão/permissão no logout.
- Mover a decisão de acesso do efeito posterior à renderização para a rota protegida, exibindo carregamento enquanto sessão e perfil ainda estão sendo verificados.
- Redirecionar usuários sem sessão diretamente para `/login`, sem montar telas privadas nem disparar consultas durante o logout.
- Sincronizar entrada e saída com o roteador e limpar dados em memória antes do redirecionamento, evitando conteúdo antigo e novas consultas sem autenticação.
- Ajustar a tela de login para aguardar a autenticação completa antes de seguir para a página inicial.

## Validação
- Testar atualização direta em uma página privada com sessão válida.
- Testar atualização e acesso privado sem sessão.
- Testar login e logout completos, incluindo o botão voltar após sair.
- Confirmar ausência da tela “This page didn't load”, loops e erros no navegador.
