import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/Toast';

import './styles/base.css';
import './styles/bazm.css';
import './styles/delish-admin.css';
import './styles/client.css';
import './styles/kitchen.css';
import './styles/waiter.css';
import './styles/glass.css';
import './styles/auth.css';
import './styles/panels.css';
import './styles/menu.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* future bayroqlari — React Router v7 xatti-harakatiga oldindan
        o'tamiz, shu bilan konsoldagi ogohlantirishlar ham yo'qoladi */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
