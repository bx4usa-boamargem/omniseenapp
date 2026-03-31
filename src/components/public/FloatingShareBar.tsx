import { useState, useEffect } from "react";
import { Facebook, Twitter, Linkedin, MessageCircle, Link2, Instagram, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Social networks registered by the blog owner */
export interface BlogSocialNetworks {
  facebook?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
}

interface FloatingShareBarProps {
  url: string;
  title: string;
  description?: string;
  articleId: string;
  blogId: string;
  primaryColor?: string;
  /** Social networks registered by the blog owner.
   *  Only share buttons for platforms where a URL/handle is set will be shown.
   *  If undefined/null, all platforms are shown (backwards-compatible). */
  socialNetworks?: BlogSocialNetworks | null;
}

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

// TikTok icon (not in lucide-react)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.22 8.22 0 0 0 4.81 1.54V6.78a4.85 4.85 0 0 1-1.05-.09z" />
  </svg>
);

export const FloatingShareBar = ({
  url,
  title,
  articleId,
  blogId,
  primaryColor,
  socialNetworks,
}: FloatingShareBarProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const trackShare = async (platform: string) => {
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-analytics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "share",
            articleId,
            blogId,
            sessionId: getSessionId(),
            data: { sharePlatform: platform },
          }),
        }
      );
    } catch (err) {
      console.error("Failed to track share:", err);
    }
  };

  const handleShare = (platform: string) => {
    trackShare(platform);
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`📰 ${title}\n\nLeia o artigo completo:\n${url}`)}`,
      instagram: `https://www.instagram.com/`, // Instagram doesn't support direct share links — open profile
      youtube: socialNetworks?.youtube || `https://www.youtube.com/`,
      tiktok: `https://www.tiktok.com/`,
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!", {
        description: "O link do artigo foi copiado para a área de transferência.",
      });
    } else {
      window.open(shareUrls[platform], "_blank", "width=600,height=400");
    }
  };

  // Determine which share buttons to display
  // If socialNetworks is provided (even with all null), only show those with a value.
  // If socialNetworks is undefined/null (not configured), show ALL sharing platforms.
  const hasNetworkConfig = socialNetworks != null;

  const allButtons = [
    {
      platform: "facebook",
      icon: Facebook,
      label: "Facebook",
      active: !hasNetworkConfig || !!socialNetworks?.facebook,
    },
    {
      platform: "twitter",
      icon: Twitter,
      label: "X (Twitter)",
      active: !hasNetworkConfig || !!socialNetworks?.twitter,
    },
    {
      platform: "linkedin",
      icon: Linkedin,
      label: "LinkedIn",
      active: !hasNetworkConfig || !!socialNetworks?.linkedin,
    },
    {
      platform: "whatsapp",
      icon: MessageCircle,
      label: "WhatsApp",
      // WhatsApp share is always shown when registered OR when no config set
      active: !hasNetworkConfig || !!socialNetworks?.whatsapp,
    },
    {
      platform: "instagram",
      icon: Instagram,
      label: "Instagram",
      active: hasNetworkConfig && !!socialNetworks?.instagram,
    },
    {
      platform: "youtube",
      icon: Youtube,
      label: "YouTube",
      active: hasNetworkConfig && !!socialNetworks?.youtube,
    },
    {
      platform: "tiktok",
      icon: TikTokIcon,
      label: "TikTok",
      active: hasNetworkConfig && !!socialNetworks?.tiktok,
    },
    {
      platform: "copy",
      icon: Link2,
      label: "Copiar link",
      active: true, // Always show copy link
    },
  ].filter((b) => b.active);

  const buttonStyle = primaryColor
    ? { "--hover-color": primaryColor } as React.CSSProperties
    : {};

  return (
    <>
      {/* Desktop - Fixed left sidebar */}
      <div
        className={cn(
          "fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-2 transition-all duration-300",
          isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full"
        )}
      >
        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl p-2 shadow-lg">
          <p className="text-[10px] text-muted-foreground text-center mb-1.5 uppercase tracking-wider font-medium">
            Compartilhar
          </p>
          {allButtons.map(({ platform, icon: Icon, label }) => (
            <Button
              key={platform}
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
              style={buttonStyle}
              onClick={() => handleShare(platform)}
              title={label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          ))}
        </div>
      </div>

      {/* Mobile - Fixed bottom bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 lg:hidden transition-all duration-300",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="bg-background/95 backdrop-blur-sm border-t border-border/50 px-4 py-3 shadow-lg">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-1">Compartilhar:</span>
            {allButtons.map(({ platform, icon: Icon, label }) => (
              <Button
                key={platform}
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                style={buttonStyle}
                onClick={() => handleShare(platform)}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

/** Inline share section rendered inside the article page (below content) */
export const InlineShareSection = ({
  url,
  title,
  articleId,
  blogId,
  primaryColor,
  socialNetworks,
}: FloatingShareBarProps) => {
  const trackShare = async (platform: string) => {
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-analytics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "share",
            articleId,
            blogId,
            sessionId: getSessionId(),
            data: { sharePlatform: platform },
          }),
        }
      );
    } catch (err) {
      console.error("Failed to track share:", err);
    }
  };

  const handleShare = (platform: string) => {
    trackShare(platform);
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`📰 ${title}\n\nLeia o artigo completo:\n${url}`)}`,
      instagram: socialNetworks?.instagram || `https://www.instagram.com/`,
      youtube: socialNetworks?.youtube || `https://www.youtube.com/`,
      tiktok: `https://www.tiktok.com/`,
    };

    if (platform === "copy") {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!", {
        description: "O link do artigo foi copiado para a área de transferência.",
      });
    } else {
      window.open(shareUrls[platform], "_blank", "width=600,height=400");
    }
  };

  const hasNetworkConfig = socialNetworks != null;

  const shareButtons = [
    { platform: "facebook", label: "Facebook", active: !hasNetworkConfig || !!socialNetworks?.facebook },
    { platform: "twitter", label: "X (Twitter)", active: !hasNetworkConfig || !!socialNetworks?.twitter },
    { platform: "linkedin", label: "LinkedIn", active: !hasNetworkConfig || !!socialNetworks?.linkedin },
    { platform: "whatsapp", label: "WhatsApp", active: !hasNetworkConfig || !!socialNetworks?.whatsapp },
    { platform: "instagram", label: "Instagram", active: hasNetworkConfig && !!socialNetworks?.instagram },
    { platform: "youtube", label: "YouTube", active: hasNetworkConfig && !!socialNetworks?.youtube },
    { platform: "tiktok", label: "TikTok", active: hasNetworkConfig && !!socialNetworks?.tiktok },
  ].filter((b) => b.active);

  if (shareButtons.length === 0) return null;

  const accentColor = primaryColor || "#2563eb";

  return (
    <div className="mt-10 pt-8 border-t border-border/60">
      <p className="text-center text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        Compartilhe este artigo
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {shareButtons.map(({ platform, label }) => (
          <button
            key={platform}
            onClick={() => handleShare(platform)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => handleShare("copy")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border/60 text-foreground hover:bg-muted/50 transition-colors active:scale-95"
        >
          <Link2 className="h-4 w-4" />
          Copiar link
        </button>
      </div>
    </div>
  );
};
