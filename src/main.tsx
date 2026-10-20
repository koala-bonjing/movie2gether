import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/env'; // validate env at startup; a bad .env fails loudly here
import './index.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
