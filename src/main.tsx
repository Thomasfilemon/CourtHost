import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/i18n';
import './styles.css';
import { App } from './app/App';

// Entry point: find the container from index.html and mount the React app.
// StrictMode enables helpful development checks; it doesn't change the database.
const container = document.getElementById('root');
if (!container) throw new Error('Missing root container in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
