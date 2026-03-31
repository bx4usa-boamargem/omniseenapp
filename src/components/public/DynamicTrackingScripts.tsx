import { useEffect } from "react";

interface TrackingConfig {
  ga_id?: string;
  gtm_id?: string;
  meta_pixel_id?: string;
  google_ads_id?: string;
}

interface DynamicTrackingScriptsProps {
  trackingConfig?: TrackingConfig | null;
  scriptHead?: string | null;
  scriptBody?: string | null;
}

export function DynamicTrackingScripts({
  trackingConfig,
  scriptHead,
  scriptBody,
}: DynamicTrackingScriptsProps) {
  useEffect(() => {
    const addedScripts: HTMLScriptElement[] = [];
    const addedElements: HTMLElement[] = [];

    // Helper to add script to head
    const addScript = (src: string, async = true): HTMLScriptElement => {
      const script = document.createElement("script");
      script.src = src;
      script.async = async;
      document.head.appendChild(script);
      addedScripts.push(script);
      return script;
    };

    // Helper to add inline script
    const addInlineScript = (
      content: string,
      location: "head" | "body" = "head"
    ): HTMLScriptElement => {
      const script = document.createElement("script");
      script.innerHTML = content;
      if (location === "head") {
        document.head.appendChild(script);
      } else {
        document.body.appendChild(script);
      }
      addedScripts.push(script);
      return script;
    };

    // Google Analytics 4
    if (trackingConfig?.ga_id) {
      addScript(`https://www.googletagmanager.com/gtag/js?id=${trackingConfig.ga_id}`);
      addInlineScript(`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${trackingConfig.ga_id}');
      `);
    }

    // Google Tag Manager (sem usar insertBefore para evitar crashes de DOM)
    if (trackingConfig?.gtm_id) {
      addInlineScript(`
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
      `);
      addScript(`https://www.googletagmanager.com/gtm.js?id=${trackingConfig.gtm_id}`);

      // GTM noscript fallback (append é suficiente)
      try {
        const noscript = document.createElement("noscript");
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.googletagmanager.com/ns.html?id=${trackingConfig.gtm_id}`;
        iframe.height = "0";
        iframe.width = "0";
        iframe.style.display = "none";
        iframe.style.visibility = "hidden";
        noscript.appendChild(iframe);
        document.body.appendChild(noscript);
        addedElements.push(noscript);
      } catch (e) {
        console.warn('[DynamicTrackingScripts] GTM noscript skipped:', e);
      }
    }

    // Meta Pixel (Facebook/Instagram) (sem usar insertBefore)
    if (trackingConfig?.meta_pixel_id) {
      addInlineScript(`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${trackingConfig.meta_pixel_id}');
        fbq('track', 'PageView');
      `);
      addScript('https://connect.facebook.net/en_US/fbevents.js');

      // Meta Pixel noscript
      try {
        const noscript = document.createElement("noscript");
        const img = document.createElement("img");
        img.height = 1;
        img.width = 1;
        img.style.display = "none";
        img.src = `https://www.facebook.com/tr?id=${trackingConfig.meta_pixel_id}&ev=PageView&noscript=1`;
        noscript.appendChild(img);
        document.body.appendChild(noscript);
        addedElements.push(noscript);
      } catch (e) {
        console.warn('[DynamicTrackingScripts] Meta noscript skipped:', e);
      }
    }

    // Google Ads
    if (trackingConfig?.google_ads_id) {
      addScript(`https://www.googletagmanager.com/gtag/js?id=${trackingConfig.google_ads_id}`);
      addInlineScript(`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${trackingConfig.google_ads_id}');
      `);
    }

    const ALLOWED_SCRIPT_DOMAINS = [
      "googletagmanager.com",
      "google-analytics.com",
      "connect.facebook.net",
      "facebook.com",
      "snap.licdn.com",
      "analytics.tiktok.com",
      "cdn.jsdelivr.net",
    ];

    const isAllowedScriptSrc = (src: string): boolean => {
      try {
        const url = new URL(src);
        return ALLOWED_SCRIPT_DOMAINS.some((d) => url.hostname.endsWith(d));
      } catch {
        return false;
      }
    };

    const parseCustomScripts = (
      raw: string,
      location: "head" | "body"
    ) => {
      const container = document.createElement("div");
      container.innerHTML = raw;
      Array.from(container.children).forEach((child) => {
        if (child instanceof HTMLScriptElement) {
          if (child.src && !isAllowedScriptSrc(child.src)) {
            console.warn("[DynamicTrackingScripts] Blocked script src:", child.src);
            return;
          }
          const script = document.createElement("script");
          script.innerHTML = child.innerHTML;
          if (child.src) script.src = child.src;
          if (child.async) script.async = true;
          const target = location === "head" ? document.head : document.body;
          target.appendChild(script);
          addedScripts.push(script);
        }
      });
    };

    if (scriptHead) {
      parseCustomScripts(scriptHead, "head");
    }

    if (scriptBody) {
      parseCustomScripts(scriptBody, "body");
    }

    // Cleanup on unmount - defensive to prevent removeChild crashes
    return () => {
      addedScripts.forEach((script) => {
        try {
          if (script.parentNode && document.contains(script)) {
            script.parentNode.removeChild(script);
          }
        } catch (e) {
          console.warn('[DynamicTrackingScripts] Script cleanup skipped:', e);
        }
      });
      addedElements.forEach((element) => {
        try {
          if (element.parentNode && document.contains(element)) {
            element.parentNode.removeChild(element);
          }
        } catch (e) {
          console.warn('[DynamicTrackingScripts] Element cleanup skipped:', e);
        }
      });
    };
  }, [trackingConfig, scriptHead, scriptBody]);

  return null;
}