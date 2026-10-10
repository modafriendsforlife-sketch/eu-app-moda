import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { registerServiceWorker } from './pushNotifications';
import { setupServiceWorkerBridge } from './lib/notificationEngine';
import './index.css';

void registerServiceWorker();
setupServiceWorkerBridge();

// ─── Anti-inspection / anti-copy protection ───
// Disable right-click context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Disable common devtools keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // F12
  if (e.key === 'F12') {
    e.preventDefault();
    return;
  }
  // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (devtools)
  if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
    e.preventDefault();
    return;
  }
  // Ctrl+U (view source)
  if (e.ctrlKey && e.key.toUpperCase() === 'U') {
    e.preventDefault();
    return;
  }
  // Ctrl+Shift+K (console in Firefox)
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'K') {
    e.preventDefault();
    return;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
