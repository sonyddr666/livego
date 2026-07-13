<div align="center">
  <img width="1200" height="475" alt="LIVEGO" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LIVEGO

Aplicação web de voz e chat com Gemini, criada com React, TypeScript e Vite.

## Executar localmente

Pré-requisito: Node.js 20 ou mais recente.

```bash
npm ci
npm run dev
```

Abra o endereço exibido pelo Vite e informe sua chave Gemini em
`Configurações > Conta`. A chave fica apenas na sessão da aba atual e é removida
quando a sessão do navegador termina.

A raiz `/` exibe a landing page e o aplicativo fica disponível em `/app`.

Para testar localmente o endpoint de tokens em outro terminal:

```bash
npm run dev:server
```

Quando `GEMINI_API_KEY` está configurada apenas no servidor, o LiveGo solicita
um token efêmero e de uso único antes de abrir a sessão Gemini Live. Se a
variável não existir ou o limite for atingido, o app usa a chave pessoal da aba.
Não configure `VITE_GEMINI_API_KEY`: variáveis expostas pelo Vite entram no
bundle público do navegador.

## Validação

```bash
npm run check
```

O comando executa lint, verificação TypeScript e build de produção. Para gerar o
relatório local do bundle em `dist/stats.html`, use:

```bash
npm run analyze
```

## Deploy no Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sonyddr666/livego&config=render.yaml)

O Render executa `npm run build` e inicia o servidor Node com `npm start`. A
variável `GEMINI_API_KEY` é lida somente pelo servidor para provisionar tokens
temporários; ela nunca deve receber prefixo `VITE_` nem ser acessada no frontend.
