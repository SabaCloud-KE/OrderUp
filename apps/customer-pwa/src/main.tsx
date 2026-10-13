import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from '@orderup/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Customer PWA defaults to dark (nightclub) but respects system/user pref */}
    <ThemeProvider defaultTheme="dark">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
