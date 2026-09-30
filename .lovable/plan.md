# Capacitor Android e GPS em segundo plano

## O que será feito

- Configurar o Capacitor para abrir `https://frutaaoquadrado.lovable.app` como o aplicativo Android **Fruta²**, usando o identificador `com.fruta2.gerenciador`.
- Adicionar o projeto Android ao repositório com ícones, permissões de localização em primeiro e segundo plano e notificação persistente durante o expediente.
- Substituir o rastreamento comum do navegador pelo rastreamento nativo no APK, mantendo o comportamento atual no navegador.
- Salvar cada coordenada no banco externo enquanto o expediente estiver aberto, inclusive com o aplicativo em segundo plano ou a tela bloqueada, e interromper o serviço ao encerrar o expediente.
- Solicitar as permissões necessárias no Android e informar claramente quando o acesso à localização ou às notificações estiver bloqueado.
- Criar uma ação no GitHub para compilar o APK e disponibilizá-lo como artefato para download.
- Validar a compilação da aplicação, o projeto Android e o fluxo existente da tela de expediente.

## Detalhes técnicos

- Usar Capacitor 7 e `@capacitor-community/background-geolocation`, compatíveis entre si.
- Ativar a ponte Android legada exigida pelo módulo para evitar a interrupção após alguns minutos em segundo plano.
- Usar requisição HTTP nativa para gravar as coordenadas, evitando a limitação de rede da tela web em segundo plano.
- O rastreamento nativo exibirá uma notificação contínua do Android enquanto estiver ativo; isso é obrigatório pelo sistema operacional.
- O APK gerado pela automação será de teste, instalável diretamente. Uma versão assinada para loja exigirá posteriormente um certificado de distribuição.
