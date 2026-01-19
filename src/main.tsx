import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Initialize i18n before rendering
import "./i18n";

// Global handler for ChunkLoadError - forces reload when cached chunks are stale
window.addEventListener('error', (event) => {
  const isChunkError = 
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('ChunkLoadError') ||
    event.message?.includes('Loading chunk') ||
    event.message?.includes('Importing a module script failed');
  
  if (isChunkError) {
    console.warn('[ChunkLoadError] Detected stale cache, clearing and reloading...');
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Clear session storage to avoid infinite reload loops
    const reloadKey = 'chunk_error_reload';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, 'true');
      window.location.reload();
    }
  }
});

// Clear reload flag on successful load
window.addEventListener('load', () => {
  sessionStorage.removeItem('chunk_error_reload');
});

createRoot(document.getElementById("root")!).render(<App />);
