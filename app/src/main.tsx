import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/industry.css';
import './styles/app.css';
import App from './App';
import { StoreProvider } from './state/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
