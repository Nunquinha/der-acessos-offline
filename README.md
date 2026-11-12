# DER — Acessos em campo (preparação offline)

**Estado: implementação local; não publicada; sincronização NÃO conectada ao sistema atual. Não distribuir para operadores ainda.** Nenhum cadastro de produção foi alterado. O aplicativo mostra esse aviso e não tenta transmitir enquanto `config.endpoint` for `null`.

## O que foi implementado

- Aplicativo instalável com formulário, logo DER e crédito de Vinicius Vaz Vieira.
- Arquivos necessários em cache para reabrir sem conexão depois da preparação inicial online.
- Rascunho automático com fotos em IndexedDB; registro e limpeza do rascunho na mesma transação.
- Vários acessos independentes no dispositivo, três fotos obrigatórias, compressão JPEG até 2048 pixels.
- Rodovias 79 → 079, 97 → 097 e ramais; GPS, coordenadas manuais e link do Maps.
- Duplicidade local em até 5 m no mesmo lado, sem depender da rodovia.
- Fila serial de envio, exclusão entre abas, nova tentativa com o mesmo identificador e estado enviado somente mediante confirmação explícita do servidor.
- Cadastros e fotos permanecem no dispositivo após falhas. Conflitos de duplicidade ficam separados para conferência.

## Pendências obrigatórias antes de liberar

1. Recuperar o código atual do Apps Script pelo editor conectado. A cópia local `../Codigo.gs` pertence ao CCO e não deve ser utilizada para esta integração.
2. Conectar um endpoint HTTPS ao MESMO fluxo de salvamento do levantamento atual, preservando os controles de fotos, duplicidade, exclusão lógica e consulta administrativa.
3. O endpoint precisa gravar `clientId` e protocolo de forma durável e atômica junto ao cadastro. Repetições do mesmo ID devem devolver o protocolo original. Se a conexão cair depois de gravar, não pode surgir outro acesso nem outra cópia das fotos. Cache temporário não é suficiente para essa garantia.
4. Validar os três slots e o conteúdo real das imagens no servidor, todos os campos e o limite de 5 MB por foto. Conferir 5 m no mesmo lado contra a base central sob bloqueio de concorrência. Coordenadas de operadores diferentes só podem ser confrontadas quando houver conexão.
5. Configurar CORS para o endereço publicado; conferir a leitura real da confirmação no navegador. Não usar `mode: no-cors`, que esconderia a confirmação.
6. Configurar o endpoint em `config.js` somente depois de testar esse contrato. Não apontar diretamente para o `/exec` atual sem verificar seu suporte: não foi possível inspecionar o código atual nesta sessão.
7. Publicar em HTTPS no GitHub Pages e testar no celular: instalar com sinal, ativar modo avião, fechar e reabrir, cadastrar vários acessos, reiniciar o navegador, recuperar fotos, voltar o sinal, interromper um envio depois da gravação e conferir um único protocolo na base. Testar também quota cheia, imagem grande, permissão GPS negada e duplicatas concorrentes.

## Contrato de integração implementado pelo cliente

POST com `Content-Type: text/plain;charset=UTF-8`, corpo JSON:

```json
{"version":1,"clientId":"uuid-estavel","capturedAt":"ISO-8601","data":{"responsavel":"...","natureza":"...","municipio":"...","rodovia":"079","km":"12,500","lado":"Direito","latitude":-23,"longitude":-48,"maps":"https://www.google.com/maps/search/?api=1&query=-23,-48","observacoes":"..."},"photos":[{"slot":0,"mimeType":"image/jpeg","base64":"..."},{"slot":1,"mimeType":"image/jpeg","base64":"..."},{"slot":2,"mimeType":"image/jpeg","base64":"..."}]}
```

Resposta de gravação (ou repetição idempotente): `{"ok":true,"clientId":"uuid-estavel","protocol":"AC-..."}`. Conflito físico: `{"ok":false,"code":"DUPLICATE"}`. Outras falhas preservam o registro pendente. Um HTTP 200 sozinho não é confirmação. Um endpoint que só permite escrever não deve expor consultas, exportações, permissões administrativas ou exclusões.

## GitHub Pages

É necessário criar uma conta no GitHub pelo próprio usuário. Para esta opção de hospedagem, colocar SOMENTE os arquivos da pasta `publicacao/` do pacote em um novo repositório. Não enviar dados, fotos reais, segredos, cópias do Apps Script ou os arquivos do CCO. Nas configurações do repositório: Pages → Deploy from a branch → main / root. O endereço publicado deve continuar o mesmo entre atualizações para preservar o armazenamento instalado em cada aparelho.

Nenhuma conta foi criada e nenhum repositório foi publicado nesta sessão. O pacote não tem dependências externas de execução. A área administrativa permanece no sistema atual.

## Limites de operação

- A primeira abertura e a instalação precisam de conexão. O link antigo do Apps Script não passa a abrir offline por causa destes arquivos.
- O envio ocorre com o aplicativo aberto quando volta a conexão; sistemas móveis podem suspender páginas em segundo plano.
- GPS pode funcionar sem dados móveis, mas depende do aparelho e das condições. Não é possível garantir precisão de 5 m, nem mover a posição automaticamente para o eixo.
- Fotos e pendências pertencem ao navegador e ao aparelho usados. Não limpar dados, navegar em modo privado nem desinstalar com pendências. O pedido de armazenamento persistente pode ser recusado pelo navegador.
- Atualizações do cache aguardam o fechamento das abas. Ao alterar arquivos estáticos, incrementar a versão do cache em `sw.js`. Não apagar nem recriar o IndexedDB nas atualizações.

## Verificação local

`node --test tests/core.test.mjs` verifica regras de validação, confirmação, repetição de envio e integridade do pacote (10 testes passaram). `node --check app.js`, `node --check storage.js`, `node --check core.js` e `node --check sw.js` verificam a sintaxe. Não requer instalação de dependências. Testes no navegador/celular, IndexedDB real, compressão de imagem e integração ponta a ponta ainda não foram realizados, pois o controle do Chrome não respondeu.
