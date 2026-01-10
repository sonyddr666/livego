import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import ChatApp from './chat/ChatApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isChatRoute = window.location.pathname.startsWith('/chat');
root.render(
  <React.StrictMode>
    <I18nProvider>
      {isChatRoute ? <ChatApp /> : <App />}
    </I18nProvider>
  </React.StrictMode>
);
