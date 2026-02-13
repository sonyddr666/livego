import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import ChatApp from './chat/ChatApp';
import Area51Page from './pages/Area51Page';
import SegredoDoChefPage from './pages/SegredoDoChefPage';
import CofreDoEmojiPage from './pages/CofreDoEmojiPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const normalizePath = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const currentPath = normalizePath(window.location.pathname);

const routeElement = (() => {
  if (currentPath === '/chat' || currentPath.startsWith('/chat/')) return <ChatApp />;
  if (currentPath === '/area-51') return <Area51Page />;
  if (currentPath === '/segredo-do-chef') return <SegredoDoChefPage />;
  if (currentPath === '/cofre-do-emoji') return <CofreDoEmojiPage />;
  return <App />;
})();

root.render(
  <React.StrictMode>
    <I18nProvider>
      {routeElement}
    </I18nProvider>
  </React.StrictMode>
);
