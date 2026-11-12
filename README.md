# DER — Levantamento de acessos com coleta offline

Aplicativo: https://nunquinha.github.io/der-acessos-offline/

Mantém o layout e as quatro etapas do Apps Script. Usa a mesma base central, pasta de fotos e gestão por e-mails autorizados. Este repositório contém somente o aplicativo público: nunca publicar cadastros, fotos reais, permissões, credenciais ou backups do servidor.

## Uso em campo

1. Abrir com sinal e aguardar **Aplicativo disponível sem internet neste celular**.
2. Android: Chrome → menu → Instalar aplicativo. iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Abrir pelo ícone uma vez com sinal antes de sair.
3. Preencher o cadastro com as três fotos obrigatórias: frontal no eixo, lado direito e lado esquerdo. Ao concluir, ele é guardado no aparelho antes da tentativa de envio.
4. Coletar outros acessos. Cada um tem seu próprio identificador e suas fotos.
5. Quando voltar o sinal, manter o aplicativo aberto até aparecer **Enviado**, com protocolo, em **Cadastros neste celular**. Há também o botão **Enviar pendentes**.

Não usar aba privada, limpar os dados do navegador ou desinstalar com pendências. O navegador pode recusar armazenamento persistente. O envio com aplicativo fechado não é garantido. GPS depende do aparelho e das condições; não move automaticamente a posição para o eixo.

## Base e permissões

O Apps Script reaproveita `registrar()`, valida os três arquivos e bloqueia duplicidade central em até 5 m no mesmo lado sob ScriptLock. Repetir um identificador devolve o protocolo original antes da verificação de distância. A comparação entre operadores só ocorre com conexão; conflitos ficam preservados no aparelho.

A gestão continua no endereço original: e-mails autorizados consultam e baixam Excel/PDF; somente o proprietário administra permissões e exclui/restaura. O endpoint público não oferece consulta ou download. Foi criada uma cópia privada da planilha, com referências às fotos originais, que permanecem na mesma pasta do Drive. A cópia da planilha não duplica os arquivos de imagem.

## Verificação em 12/11/2026

- 14 testes locais de validação, distância, confirmação e adaptador.
- 23 verificações no Apps Script sobre fotos, duplicidade e permissões, sem criar/excluir registros.
- Diagnóstico HTTP do aplicativo publicado com confirmação legível, sem cadastrar dados sintéticos em produção.
- Foto sintética de cerca de 11 MB reduzida para cerca de 1,3 MB, 1536 × 2048 pixels e orientação preservada.
- Reabertura sem rede, recuperação de rascunho e três fotos; conclusão e recuperação de dois acessos na fila isolada.
- Visual em 390 × 844, sem rolagem horizontal.

Não foi realizado teste de carga com todos os operadores nem envio de cadastro sintético à base de produção. Apps Script/Drive têm limites de serviço. Falhas mantêm itens pendentes; não há capacidade simultânea ilimitada. Conferir instalação e GPS nos aparelhos reais.

## Manutenção

`config.js` define o endpoint. JSON por POST `text/plain`; resposta confirmada deve conter `{ok:true,clientId,protocol}`. Nunca usar `no-cors`. IndexedDB guarda fotos e registros; concluir o cadastro e limpar o rascunho ocorre na mesma transação. Web Locks evita duas filas concorrentes no mesmo aparelho. Atualizações de cache aguardam fechar as abas; incrementar a versão em `sw.js`, sem apagar IndexedDB.

`?teste=local` abre banco de teste separado e desativa transmissão. Não usar em campo. Testes sem dependências: `node --test tests/core.test.mjs` e `node --check app.js`. Publicação: GitHub Pages, branch `main`.
