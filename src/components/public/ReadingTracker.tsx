import { useEffect, useRef, useMemo } from "react";
import { SectionTracker } from "./SectionTracker";

interface ReadingTrackerProps {
  articleId: string;
  blogId: string;
}

export const ReadingTracker = ({ articleId, blogId }: ReadingTrackerProps) => {
  const sessionId = useRef(crypto.randomUUID());
  const maxScrollRef = useRef(0);
  const sentMilestonesRef = useRef<Set<number>>(new Set());
  const sentFunnelMilestonesRef = useRef<Set<number>>(new Set());
  const scrollPositionsRef = useRef<number[]>([]);
  const startTimeRef = useRef(Date.now());
  const ctaObserverRef = useRef<IntersectionObserver | null>(null);
  const ctaViewedRef = useRef(false);

  const visitorId = useMemo(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const stored = localStorage.getItem("visitor_id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("visitor_id", newId);
    return newId;
  }, []);

  const getTrafficSource = () => {
    if (typeof window === "undefined") return "direct";
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer;

    if (params.get("utm_source")) return "campaign";
    if (referrer.includes("google") || referrer.includes("bing") || referrer.includes("yahoo")) return "organic";
    if (referrer.includes("facebook") || referrer.includes("twitter") || referrer.includes("linkedin") || referrer.includes("instagram")) return "social";
    if (referrer && !referrer.includes(window.location.hostname)) return "referral";
    return "direct";
  };

  const getDeviceInfo = () => {
    if (typeof window === "undefined") return { device: "desktop", browser: "Other" };
    const ua = navigator.userAgent;
    const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
    let browser = "Other";
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";
    return { device, browser };
  };

  const sendEvent = async (type: string, data: Record<string, unknown> = {}) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const deviceInfo = getDeviceInfo();

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          articleId,
          blogId,
          sessionId: sessionId.current,
          visitorId,
          data: {
            source: getTrafficSource(),
            utmSource: params.get("utm_source"),
            utmMedium: params.get("utm_medium"),
            utmCampaign: params.get("utm_campaign"),
            ...deviceInfo,
            ...data,
          },
        }),
      });
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  };

  const sendFunnelEvent = async (eventType: string, eventData: Record<string, unknown> = {}) => {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "funnel_event",
          articleId,
          blogId,
          sessionId: sessionId.current,
          visitorId,
          data: {
            funnelEvent: eventType,
            funnelData: eventData,
          },
        }),
      });
    } catch (error) {
      console.error("Error tracking funnel event:", error);
    }
  };

  // Send pageview and page_enter funnel event on mount
  useEffect(() => {
    sendEvent("pageview");
    sendFunnelEvent("page_enter");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track scroll depth with funnel milestones
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      if (scrollPercent > maxScrollRef.current) {
        maxScrollRef.current = scrollPercent;

        // Original scroll milestones for article_analytics
        const milestones = [25, 50, 60, 75, 100];
        for (const milestone of milestones) {
          if (scrollPercent >= milestone && !sentMilestonesRef.current.has(milestone)) {
            sentMilestonesRef.current.add(milestone);
            sendEvent("scroll", { scrollDepth: milestone });
            
            // Track conversion_visibility at 60%+ (qualified read)
            if (milestone >= 60 && !sentMilestonesRef.current.has(-1)) {
              sentMilestonesRef.current.add(-1);
              sendFunnelEvent("conversion_visibility");
            }
          }
        }

        // Funnel milestones
        const funnelMilestones = [25, 50, 75, 100];
        for (const milestone of funnelMilestones) {
          if (scrollPercent >= milestone && !sentFunnelMilestonesRef.current.has(milestone)) {
            sentFunnelMilestonesRef.current.add(milestone);
            sendFunnelEvent(`scroll_${milestone}`);
          }
        }

        // Granular scroll positions for heatmap (every 5%)
        const currentBucket = Math.floor(scrollPercent / 5) * 5;
        if (!scrollPositionsRef.current.includes(currentBucket)) {
          scrollPositionsRef.current.push(currentBucket);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track CTA visibility and clicks
  useEffect(() => {
    const observeCTA = () => {
      const ctaElements = document.querySelectorAll('[data-cta="true"], .cta-banner');
      
      ctaObserverRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !ctaViewedRef.current) {
              ctaViewedRef.current = true;
              sendFunnelEvent("cta_view");
            }
          });
        },
        { threshold: 0.5 }
      );

      ctaElements.forEach((el) => {
        ctaObserverRef.current?.observe(el);
        
        // Track clicks - both as funnel event and conversion_intent
        el.addEventListener("click", () => {
          sendFunnelEvent("cta_click");
          sendFunnelEvent("conversion_intent"); // High-value conversion
        });
      });
    };

    // Wait for DOM to be ready
    setTimeout(observeCTA, 1000);

    return () => {
      ctaObserverRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track related article clicks
  useEffect(() => {
    const handleRelatedClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href*="/blog/"]');
      if (link && link.closest('.related-articles')) {
        sendFunnelEvent("related_click", { url: (link as HTMLAnchorElement).href });
      }
    };

    document.addEventListener("click", handleRelatedClick);
    return () => document.removeEventListener("click", handleRelatedClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendEvent("time", { timeOnPage: seconds });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send final event and scroll positions on unmount
  useEffect(() => {
    return () => {
      const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      
      // Send scroll positions for heatmap
      if (scrollPositionsRef.current.length > 0) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "scroll_granular",
            articleId,
            blogId,
            sessionId: sessionId.current,
            visitorId,
            data: {
              scrollPositions: scrollPositionsRef.current,
            },
          }),
        });
      }

      sendEvent("leave", {
        timeOnPage: seconds,
        scrollDepth: maxScrollRef.current,
        readPercentage: maxScrollRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SectionTracker
      articleId={articleId}
      blogId={blogId}
      sessionId={sessionId.current}
      visitorId={visitorId}
    />
  );
};
