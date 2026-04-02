import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>
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

const loadApp = async (attempt = 1): Promise<{ default: React.ComponentType }> => {
  try {
    return await import("./App.tsx");
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    return loadApp(attempt + 1);
  }
};

let bootFinished = false;

renderBootScreen("Carregando aplicação", "Inicializando autenticação e rotas...");

const bootSoftRedirectMs = isPreviewOrDevHost() ? 8000 : 3000;
const bootHardTimeoutMs = isPreviewOrDevHost() ? 20000 : 5000;

const softRedirectTimer = window.setTimeout(() => {
  if (bootFinished) return;

  if (isProtectedEntryRoute(window.location.pathname) && !isAuthRoute(window.location.pathname)) {
    window.history.replaceState({}, "", "/login");
    renderBootScreen("Redirecionando para login", "A inicialização está demorando mais do que o esperado.");
  }
}, bootSoftRedirectMs);

const hardTimeout = new Promise<never>((_, reject) => {
  window.setTimeout(() => reject(new Error("APP_BOOT_TIMEOUT")), bootHardTimeoutMs);
});

Promise.race([loadApp(), hardTimeout])
  .then((module) => {
    bootFinished = true;
    clearTimeout(softRedirectTimer);
    const App = module.default;
    root.render(<App />);
  })
  .catch((error) => {
    bootFinished = true;
    clearTimeout(softRedirectTimer);
    console.error("[AppBoot] Failed to initialize app:", error);

    renderBootScreen(
      "Não foi possível iniciar o app",
      "O carregamento excedeu o tempo limite. Você pode abrir o login ou recarregar a página.",
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
  });