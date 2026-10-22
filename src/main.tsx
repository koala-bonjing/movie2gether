import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/env'; // validate env at startup; a bad .env fails loudly here
import './index.css';
import { App } from './app/App';
import { ErrorBoundary } from './ui';

// Purge any stale PWA service workers and cache storage so WebView2 and mobile webviews always load fresh assets
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        void caches.delete(key);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
