import { useEffect } from 'react';

// Placeholder IDs - replace with real values
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
const FB_PIXEL_ID = 'XXXXXXXXXXXXXXX';
const LINKEDIN_PARTNER_ID = 'XXXXXXX';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: (...args: any[]) => void;
    _linkedin_partner_id: string;
    lintrk: ((...args: any[]) => void) & { q?: any[] };
  }
}

export const TrackingScripts = () => {
  useEffect(() => {
    // Skip if already initialized or if IDs are placeholders
    if (GA_MEASUREMENT_ID.includes('XXXXXXXXXX')) {
      console.log('Tracking: GA4 ID not configured');
    } else {
      // Initialize Google Analytics 4
      const gaScript = document.createElement('script');
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      gaScript.async = true;
      document.head.appendChild(gaScript);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID);
    }

    if (FB_PIXEL_ID.includes('XXXXXXX')) {
      console.log('Tracking: Facebook Pixel ID not configured');
    } else {
      // Initialize Facebook Pixel (defensive: avoid insertBefore crashes)
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        try {
          if (s?.parentNode && (s.parentNode as ParentNode).contains(s)) {
            s.parentNode.insertBefore(t, s);
          } else {
            b.head.appendChild(t);
          }
        } catch (err) {
          console.warn('[TrackingScripts] FB pixel insertion skipped:', err);
        }
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      window.fbq('init', FB_PIXEL_ID);
      window.fbq('track', 'PageView');
    }

    if (LINKEDIN_PARTNER_ID.includes('XXXXXXX')) {
      console.log('Tracking: LinkedIn Partner ID not configured');
    } else {
      // Initialize LinkedIn Insight Tag
      window._linkedin_partner_id = LINKEDIN_PARTNER_ID;
      (function (l: any) {
        if (!l) {
          const _linkedin_data_partner_ids = [window._linkedin_partner_id];
          window.lintrk = function (a: any, b: any) {
            window.lintrk.q.push([a, b]);
          };
          window.lintrk.q = [];
        }
        const s = document.getElementsByTagName('script')[0];
        const b = document.createElement('script');
        b.type = 'text/javascript';
        b.async = true;
        b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
        try {
          if (s?.parentNode && (s.parentNode as ParentNode).contains(s)) {
            s.parentNode.insertBefore(b, s);
          } else {
            document.head.appendChild(b);
          }
        } catch (err) {
          console.warn('[TrackingScripts] LinkedIn insertion skipped:', err);
        }
      })(window.lintrk);
    }
  }, []);

  return null;
};

// Tracking helper functions
export const trackEvent = {
  signUpClick: () => {
    if (window.gtag) {
      window.gtag('event', 'sign_up_click', {
        event_category: 'engagement',
        event_label: 'CTA Click',
      });
    }
    if (window.fbq) {
      window.fbq('track', 'Lead');
    }
    if (window.lintrk) {
      window.lintrk('track', { conversion_id: 'sign_up' });
    }
  },

  demoView: () => {
    if (window.gtag) {
      window.gtag('event', 'demo_view', {
        event_category: 'engagement',
        event_label: 'Demo Modal Opened',
      });
    }
    if (window.fbq) {
      window.fbq('track', 'ViewContent', { content_name: 'Demo' });
    }
  },

  pricingView: () => {
    if (window.gtag) {
      window.gtag('event', 'pricing_view', {
        event_category: 'engagement',
        event_label: 'Pricing Section Viewed',
      });
    }
    if (window.fbq) {
      window.fbq('track', 'ViewContent', { content_name: 'Pricing' });
    }
  },
};