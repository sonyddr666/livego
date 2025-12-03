<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally or deploy on Render.

View your app in AI Studio: https://ai.studio/apps/drive/13-QH5f5wa14SBfs42fc92ovZSdxFnhxE

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy on Render

Clique no botão abaixo para fazer deploy automático no Render usando o arquivo `render.yaml` deste repositório:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sonyddr666/livego&config=render.yaml)

No painel do Render, crie a variável de ambiente:
- `GEMINI_API_KEY` → sua chave da API Gemini

O Render vai rodar o build com `npm run build` e servir o app com `npm run preview` na porta 10000.
