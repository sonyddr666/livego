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

Não configure `GEMINI_API_KEY` nem `VITE_GEMINI_API_KEY` em deploys do frontend.
Variáveis expostas pelo Vite são compiladas no bundle público do navegador.

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

O Render executa `npm run build` e serve a aplicação na porta configurada pelo
arquivo `render.yaml`. A chave Gemini deve ser fornecida por cada usuário na
interface; ela não deve ser cadastrada como variável do serviço frontend.
