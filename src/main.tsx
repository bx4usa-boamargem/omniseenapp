import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
const CHUNK_RELOAD_KEY = "chunk_error_reload";

const isPreviewOrDevHost = () => {
  const host = window.location.hostname;
  return (
    import.meta.env.DEV ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
};

const isAuthRoute = (pathname: string) =>
  pathname.startsWith("/login") ||
  pathname.startsWith("/signup") ||
  pathname.startsWith("/auth") ||
  pathname.startsWith("/reset-password");

const isProtectedEntryRoute = (pathname: string) =>
  pathname === "/" || pathname.startsWith("/client") || pathname.startsWith("/app") || pathname.startsWith("/admin");

function BootScreen({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '28rem', borderRadius: '1rem', border: '1px solid #2a2a3a', background: '#14141f', padding: '2rem', textAlign: 'center' }}>
        <div style={{ margin: '0 auto 1.25rem', height: '3rem', width: '3rem', borderRadius: '50%', border: '4px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.5rem' }}>{title}</h1>
        <p style={{ fontSize: '0.875rem', color: '#71717a' }}>{description}</p>
        {actions}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const renderBootScreen = (title: string, description: string, actions?: React.ReactNode) => {
  root.render(<BootScreen title={title} description={description} actions={actions} />);
};

window.addEventListener("error", (event) => {
  const isChunkError =
    event.message?.includes("Failed to fetch dynamically imported module") ||
    event.message?.includes("ChunkLoadError") ||
    event.message?.includes("Loading chunk") ||
    event.message?.includes("Importing a module script failed");

  if (!isChunkError) return;

  if (isPreviewOrDevHost()) {
    console.warn("[ChunkLoadError] Ignoring auto-reload in preview/dev to avoid boot loops.");
    return;
  }

  console.warn("[ChunkLoadError] Detected stale cache, clearing and reloading...");

  if ("caches" in window) {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
    window.location.reload();
  }
});

window.addEventListener("load", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

renderBootScreen("Carregando aplicação", "Inicializando autenticação e rotas...");

try {
  window.requestAnimationFrame(() => {
    root.render(<App />);
  });
} catch (error) {
  console.error("[AppBoot] Failed to initialize app:", error);

  if (isProtectedEntryRoute(window.location.pathname) && !isAuthRoute(window.location.pathname)) {
    window.history.replaceState({}, "", "/login");
  }

  renderBootScreen(
    "Não foi possível iniciar o app",
    "Houve uma falha ao inicializar a aplicação. Você pode abrir o login ou recarregar a página.",
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        type="button"
        onClick={() => window.location.assign("/login")}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Ir para login
      </button>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
      >
        Recarregar
      </button>
    </div>
  );
}