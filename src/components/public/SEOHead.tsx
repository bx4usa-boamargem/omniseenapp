import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SEOHeadProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article";
  articlePublishedTime?: string;
  articleAuthor?: string;
  canonicalUrl?: string;
  keywords?: string[];
  faq?: { question: string; answer: string }[];
  favicon?: string;
}

export const SEOHead = ({
  title,
  description,
  ogImage,
  ogType = "website",
  articlePublishedTime,
  articleAuthor,
  canonicalUrl,
  keywords,
  faq,
  favicon,
}: SEOHeadProps) => {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.title = title;

    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    updateMetaTag("description", description);
    if (keywords?.length) {
      updateMetaTag("keywords", keywords.join(", "));
    }

    updateMetaTag("og:title", title, true);
    updateMetaTag("og:description", description, true);
    updateMetaTag("og:type", ogType, true);
    if (ogImage) updateMetaTag("og:image", ogImage, true);
    if (canonicalUrl) updateMetaTag("og:url", canonicalUrl, true);

    const ogLocale = i18n.language === 'en' ? 'en_US' : 'pt_BR';
    updateMetaTag("og:locale", ogLocale, true);

    updateMetaTag("twitter:card", "summary_large_image");
    updateMetaTag("twitter:title", title);
    updateMetaTag("twitter:description", description);
    if (ogImage) updateMetaTag("twitter:image", ogImage);

    if (ogType === "article" && articlePublishedTime) {
      updateMetaTag("article:published_time", articlePublishedTime, true);
    }
    if (ogType === "article" && articleAuthor) {
      updateMetaTag("article:author", articleAuthor, true);
    }

    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!canonicalElement) {
        canonicalElement = document.createElement("link");
        canonicalElement.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalElement);
      }
      canonicalElement.setAttribute("href", canonicalUrl);
    }

    // Favicon handling
    if (favicon) {
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.setAttribute("rel", "icon");
        faviconLink.setAttribute("type", "image/png");
        document.head.appendChild(faviconLink);
      }
      faviconLink.setAttribute("href", favicon);
      
      // Also set apple-touch-icon for iOS
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement("link");
        appleTouchIcon.setAttribute("rel", "apple-touch-icon");
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.setAttribute("href", favicon);
    }

    const existingHreflangs = document.querySelectorAll('link[hreflang]');
    existingHreflangs.forEach(el => el.remove());

    const existingSchema = document.querySelector('script[type="application/ld+json"]');
    if (existingSchema) existingSchema.remove();

    const schemas: object[] = [];

    if (ogType === "article") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        image: ogImage,
        datePublished: articlePublishedTime,
        inLanguage: i18n.language,
        author: { "@type": "Person", name: articleAuthor },
      });
    }

    if (faq?.length) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      });
    }

    if (schemas.length > 0) {
      const schemaScript = document.createElement("script");
      schemaScript.type = "application/ld+json";
      schemaScript.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
      document.head.appendChild(schemaScript);
    }

    return () => {
      const schema = document.querySelector('script[type="application/ld+json"]');
      if (schema) schema.remove();
    };
  }, [title, description, ogImage, ogType, articlePublishedTime, articleAuthor, canonicalUrl, keywords, faq, favicon, i18n.language]);

  return null;
};
