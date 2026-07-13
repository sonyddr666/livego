import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './App';
import { I18nProvider } from './i18n';
import ChatApp from './chat/ChatApp';
import LandingPage from './pages/LandingPage';
import Area51Page from './pages/Area51Page';
import SegredoDoChefPage from './pages/SegredoDoChefPage';
import CofreDoEmojiPage from './pages/CofreDoEmojiPage';
import { APP_VERSION } from './config/version';

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

if (currentPath === '/app' || currentPath.startsWith('/app/')) {
  document.title = 'LIVEGO App — Voice AI';
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
}

const chunkRecoveryKey = `livego_chunk_recovery_${APP_VERSION}`;
let chunkReloadScheduled = false;

const showChunkFailure = () => {
  const root = document.getElementById('root');
  if (!root) return;
  const isPortuguese = document.documentElement.lang.toLowerCase().startsWith('pt');
  const main = document.createElement('main');
  const section = document.createElement('section');
  const icon = document.createElement('div');
  const heading = document.createElement('h1');
  const message = document.createElement('p');
  const button = document.createElement('button');

  main.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#07080d;color:#fff;font-family:Inter,system-ui,sans-serif';
  section.style.cssText = 'max-width:440px;text-align:center';
  icon.style.cssText = 'width:56px;height:56px;margin:0 auto 24px;border-radius:18px;background:rgba(79,70,229,.16);display:flex;align-items:center;justify-content:center;color:#a5b4fc;font-size:24px';
  heading.style.cssText = 'font-size:24px;margin:0 0 12px';
  message.style.cssText = 'color:#a1a1aa;line-height:1.6;margin:0 0 24px';
  button.style.cssText = 'border:0;border-radius:999px;background:#fff;color:#000;padding:12px 22px;font-weight:700;cursor:pointer';

  icon.textContent = '↻';
  heading.textContent = isPortuguese ? 'Atualização não carregada' : 'Update could not be loaded';
  message.textContent = isPortuguese
    ? 'Recarregue a página para buscar a versão mais recente do LiveGo.'
    : 'Reload the page to get the latest version of LiveGo.';
  button.textContent = isPortuguese ? 'Recarregar página' : 'Reload page';
  button.addEventListener('click', () => window.location.reload());

  section.append(icon, heading, message, button);
  main.append(section);
  root.replaceChildren(main);
};

const recoverFromChunkError = (event?: Event) => {
  event?.preventDefault();
  if (chunkReloadScheduled) return;
  chunkReloadScheduled = true;

  if (!sessionStorage.getItem(chunkRecoveryKey)) {
    sessionStorage.setItem(chunkRecoveryKey, '1');
    window.location.reload();
    return;
  }
  showChunkFailure();
};

window.addEventListener('vite:preloadError', recoverFromChunkError);
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
  if (/dynamically imported|chunkloaderror|loading chunk|importing a module script/i.test(message)) {
    recoverFromChunkError(event);
  }
});

const appShellPaths = currentPath === '/app' || currentPath.startsWith('/app/') || currentPath.startsWith('/chat');
document.body.classList.toggle('app-shell-active', appShellPaths);

const routeElement = (() => {
  if (currentPath === '/chat' || currentPath.startsWith('/chat/')) return <ChatApp />;
  if (currentPath === '/area-51') return <Area51Page />;
  if (currentPath === '/segredo-do-chef') return <SegredoDoChefPage />;
  if (currentPath === '/cofre-do-emoji') return <CofreDoEmojiPage />;
  if (currentPath === '/app' || currentPath.startsWith('/app/')) return <App />;
  return <LandingPage />;
})();

root.render(
  <React.StrictMode>
    <I18nProvider>
      {routeElement}
    </I18nProvider>
  </React.StrictMode>
);
