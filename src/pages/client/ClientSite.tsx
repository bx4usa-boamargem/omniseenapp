import { useEffect, useState, useCallback } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Globe, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCanonicalBlogUrl, getBlogUrl } from '@/utils/blogUrl';
import { MiniSiteEditor } from '@/components/client/minisite/MiniSiteEditor';
import { MiniSitePreview } from '@/components/client/minisite/MiniSitePreview';
import { ContactButton } from '@/components/client/minisite/sections/ContactButtonsSection';
import { sanitizeContactValue } from '@/lib/contactLinks';

export default function ClientSite() {
  const { blog, refetch } = useBlog();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copied, setCopied] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoNegativeUrl, setLogoNegativeUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [logoBackgroundColor, setLogoBackgroundColor] = useState<string | null>(null);
  const [logoNegativeBackgroundColor, setLogoNegativeBackgroundColor] = useState<string | null>(null);
  const [layoutTemplate, setLayoutTemplate] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [showSearch, setShowSearch] = useState(true);
  const [headerCtaText, setHeaderCtaText] = useState('');
  const [headerCtaUrl, setHeaderCtaUrl] = useState('');
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerDescription, setBannerDescription] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState<string | null>(null);
  const [bannerOverlayOpacity, setBannerOverlayOpacity] = useState(50);
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [footerText, setFooterText] = useState('');
  const [showCategoriesFooter, setShowCategoriesFooter] = useState(true);
  const [contactButtons, setContactButtons] = useState<ContactButton[]>([]);
  // Brand display mode: 'text' or 'image'
  const [brandDisplayMode, setBrandDisplayMode] = useState<'text' | 'image'>('text');

  // Load blog data
  useEffect(() => {
    if (!blog) return;

    setCompanyName(blog.name || '');
    setCity((blog as any).city || '');
    setLogoUrl(blog.logo_url || '');
    setLogoNegativeUrl(blog.logo_negative_url || '');
    setFaviconUrl(blog.favicon_url || '');
    setLayoutTemplate((blog as any).layout_template || 'modern');
    setPrimaryColor(blog.primary_color || '#6366f1');
    setSecondaryColor(blog.secondary_color || '#8b5cf6');
    setShowSearch((blog as any).show_search ?? true);
    setHeaderCtaText((blog as any).header_cta_text || '');
    setHeaderCtaUrl((blog as any).header_cta_url || '');
    setBannerEnabled(blog.banner_enabled || false);
    setBannerTitle(blog.banner_title || '');
    setBannerDescription(blog.banner_description || '');
    setBannerImageUrl(blog.banner_image_url || '');
    setBannerBackgroundColor((blog as any).hero_background_color || null);
    setBannerOverlayOpacity((blog as any).banner_overlay_opacity ?? 50);
    setLogoBackgroundColor((blog as any).logo_background_color || null);
    setLogoNegativeBackgroundColor((blog as any).logo_negative_background_color || null);
    setCtaText(blog.cta_text || '');
    setCtaUrl(blog.cta_url || '');
    setBrandDescription(blog.brand_description || '');
    setFooterText(blog.footer_text || '');
    setShowCategoriesFooter((blog as any).show_categories_footer ?? true);
    // Load brand display mode
    setBrandDisplayMode(((blog as any).brand_display_mode as 'text' | 'image') || 'text');

    // Fetch contact buttons
    const fetchButtons = async () => {
      const { data } = await supabase
        .from('blog_contact_buttons')
        .select('*')
        .eq('blog_id', blog.id)
        .order('sort_order');

      if (data) {
        setContactButtons(data.map(b => ({
          id: b.id,
          button_type: b.button_type as ContactButton['button_type'],
          label: b.label || '',
          value: b.value,
          whatsapp_message: (b as any).whatsapp_message || '',
          email_subject: (b as any).email_subject || '',
        })));
      }
      setLoading(false);
    };

    fetchButtons();
  }, [blog]);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasChanges || !blog?.id) return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        // Update blog
        const { error: blogError } = await supabase
          .from('blogs')
          .update({
            name: companyName,
            city: city,
            logo_url: logoUrl,
            logo_negative_url: logoNegativeUrl,
            favicon_url: faviconUrl,
            logo_background_color: logoBackgroundColor,
            logo_negative_background_color: logoNegativeBackgroundColor,
            layout_template: layoutTemplate,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            show_search: showSearch,
            header_cta_text: headerCtaText,
            header_cta_url: headerCtaUrl,
            banner_enabled: bannerEnabled,
            banner_title: bannerTitle,
            banner_description: bannerDescription,
            banner_image_url: bannerImageUrl,
            hero_background_color: bannerBackgroundColor,
            banner_overlay_opacity: bannerOverlayOpacity,
            cta_text: ctaText,
            cta_url: ctaUrl,
            brand_description: brandDescription,
            footer_text: footerText,
            show_categories_footer: showCategoriesFooter,
            brand_display_mode: brandDisplayMode,
          })
          .eq('id', blog.id);

        if (blogError) throw blogError;

        // Update contact buttons
        await supabase
          .from('blog_contact_buttons')
          .delete()
          .eq('blog_id', blog.id);

        if (contactButtons.length > 0) {
          const buttonsToInsert = contactButtons.map((btn, index) => ({
            blog_id: blog.id,
            button_type: btn.button_type,
            label: btn.label || null,
            value: sanitizeContactValue(btn.button_type, btn.value),
            whatsapp_message: btn.whatsapp_message || null,
            email_subject: btn.email_subject || null,
            sort_order: index,
          }));

          await supabase
            .from('blog_contact_buttons')
            .insert(buttonsToInsert);
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Error saving:', error);
        toast.error('Erro ao salvar');
        setSaveStatus('idle');
      }
      setHasChanges(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasChanges, blog?.id, companyName, city, logoUrl, logoNegativeUrl, faviconUrl, logoBackgroundColor, logoNegativeBackgroundColor, layoutTemplate, primaryColor, secondaryColor, showSearch, headerCtaText, headerCtaUrl, bannerEnabled, bannerTitle, bannerDescription, bannerImageUrl, bannerBackgroundColor, bannerOverlayOpacity, ctaText, ctaUrl, brandDescription, footerText, showCategoriesFooter, contactButtons, brandDisplayMode]);

  // Mark as changed
  const markChanged = useCallback(() => setHasChanges(true), []);

  // URL helpers - canonical for display/copy, navigable for opening
  const getBlogUrlSafe = () => blog ? getCanonicalBlogUrl(blog) : '';
  const openSite = () => {
    if (!blog) return;
    // Use getBlogUrl which returns environment-aware URL (preview uses /blog/slug)
    const url = getBlogUrl(blog);
    if (url) window.open(url, '_blank');
  };
  const copyBlogUrl = () => {
    const url = getBlogUrlSafe();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Meu Mini-Site</h1>
            <p className="text-sm text-muted-foreground">{getBlogUrlSafe()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={copyBlogUrl} variant="outline" size="icon" title="Copiar link">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button onClick={openSite} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Abrir Site
          </Button>
        </div>
      </div>

      {/* Public URL Banner */}
      <div className="px-4 py-3 bg-primary/5 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Seu blog está disponível em:</span>
          <a 
            href={getBlogUrlSafe()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary font-mono hover:underline"
          >
            {getBlogUrlSafe()}
          </a>
        </div>
        <Button onClick={copyBlogUrl} variant="ghost" size="sm" className="gap-1">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor - Left (Light Theme Forced) */}
        <div className="w-[45%] overflow-y-auto p-6 border-r bg-white">
          <div className="text-gray-900">
            <MiniSiteEditor
            companyName={companyName}
            city={city}
            logoUrl={logoUrl}
            logoNegativeUrl={logoNegativeUrl}
            faviconUrl={faviconUrl}
            logoBackgroundColor={logoBackgroundColor}
            logoNegativeBackgroundColor={logoNegativeBackgroundColor}
            layoutTemplate={layoutTemplate}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            showSearch={showSearch}
            headerCtaText={headerCtaText}
            headerCtaUrl={headerCtaUrl}
            bannerEnabled={bannerEnabled}
            bannerTitle={bannerTitle}
            bannerDescription={bannerDescription}
            bannerImageUrl={bannerImageUrl}
            bannerBackgroundColor={bannerBackgroundColor}
            bannerOverlayOpacity={bannerOverlayOpacity}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            brandDescription={brandDescription}
            footerText={footerText}
            showCategoriesFooter={showCategoriesFooter}
            contactButtons={contactButtons}
            brandDisplayMode={brandDisplayMode}
            userId={user?.id || ''}
            saveStatus={saveStatus}
            onCompanyNameChange={(v) => { setCompanyName(v); markChanged(); }}
            onCityChange={(v) => { setCity(v); markChanged(); }}
            onLogoUrlChange={(v) => { setLogoUrl(v); markChanged(); }}
            onLogoNegativeUrlChange={(v) => { setLogoNegativeUrl(v); markChanged(); }}
            onFaviconUrlChange={(v) => { setFaviconUrl(v); markChanged(); }}
            onLogoBackgroundColorChange={(v) => { setLogoBackgroundColor(v); markChanged(); }}
            onLogoNegativeBackgroundColorChange={(v) => { setLogoNegativeBackgroundColor(v); markChanged(); }}
            onLayoutChange={(v) => { setLayoutTemplate(v); markChanged(); }}
            onPrimaryColorChange={(v) => { setPrimaryColor(v); markChanged(); }}
            onSecondaryColorChange={(v) => { setSecondaryColor(v); markChanged(); }}
            onShowSearchChange={(v) => { setShowSearch(v); markChanged(); }}
            onHeaderCtaTextChange={(v) => { setHeaderCtaText(v); markChanged(); }}
            onHeaderCtaUrlChange={(v) => { setHeaderCtaUrl(v); markChanged(); }}
            onBannerEnabledChange={(v) => { setBannerEnabled(v); markChanged(); }}
            onBannerTitleChange={(v) => { setBannerTitle(v); markChanged(); }}
            onBannerDescriptionChange={(v) => { setBannerDescription(v); markChanged(); }}
            onBannerImageUrlChange={(v) => { setBannerImageUrl(v || ''); markChanged(); }}
            onBannerBackgroundColorChange={(v) => { setBannerBackgroundColor(v); markChanged(); }}
            onBannerOverlayOpacityChange={(v) => { setBannerOverlayOpacity(v); markChanged(); }}
            onCtaTextChange={(v) => { setCtaText(v); markChanged(); }}
            onCtaUrlChange={(v) => { setCtaUrl(v); markChanged(); }}
            onBrandDescriptionChange={(v) => { setBrandDescription(v); markChanged(); }}
            onFooterTextChange={(v) => { setFooterText(v); markChanged(); }}
            onShowCategoriesFooterChange={(v) => { setShowCategoriesFooter(v); markChanged(); }}
            onContactButtonsChange={(v) => { setContactButtons(v); markChanged(); }}
            onBrandDisplayModeChange={(v) => { setBrandDisplayMode(v); markChanged(); }}
            />
          </div>
        </div>

        {/* Preview - Right */}
        <div className="w-[55%] bg-muted/30">
          <MiniSitePreview
            blogId={blog?.id || ''}
            companyName={companyName}
            description={blog?.description || ''}
            logoUrl={logoUrl}
            logoNegativeUrl={logoNegativeUrl}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            showSearch={showSearch}
            headerCtaText={headerCtaText}
            headerCtaUrl={headerCtaUrl}
            bannerEnabled={bannerEnabled}
            bannerTitle={bannerTitle}
            bannerDescription={bannerDescription}
            bannerImageUrl={bannerImageUrl}
            bannerOverlayOpacity={bannerOverlayOpacity}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            brandDescription={brandDescription}
            footerText={footerText}
            showCategoriesFooter={showCategoriesFooter}
            contactButtons={contactButtons}
            brandDisplayMode={brandDisplayMode}
          />
        </div>
      </div>
    </div>
  );
}