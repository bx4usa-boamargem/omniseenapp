import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Initialize i18n before rendering
import i18n from "./i18n";

// Verify i18n loaded correctly
console.log('[main] i18n ready:', i18n.isInitialized);
console.log('[main] Current language:', i18n.language);
console.log('[main] Translation test:', i18n.t('landing.manifesto.headline'));

createRoot(document.getElementById("root")!).render(<App />);
