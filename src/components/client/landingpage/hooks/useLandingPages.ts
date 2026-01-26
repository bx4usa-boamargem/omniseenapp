import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadImageToStorage } from "@/utils/imageUtils";
import { LandingPageData, LandingPage, GenerateLandingPageRequest } from "../types/landingPageTypes";

interface UseLandingPagesReturn {
  pages: LandingPage[];
  loading: boolean;
  generating: boolean;
  saving: boolean;
  fetchPages: (blogId: string) => Promise<void>;
  generatePage: (request: GenerateLandingPageRequest) => Promise<LandingPageData | null>;
  savePage: (page: Partial<LandingPage> & { blog_id: string }) => Promise<LandingPage | null>;
  updatePage: (id: string, updates: Partial<LandingPage>) => Promise<boolean>;
  deletePage: (id: string) => Promise<boolean>;
  publishPage: (id: string) => Promise<boolean>;
  unpublishPage: (id: string) => Promise<boolean>;
}

async function generateLandingPageImage(params: {
  prompt: string;
  context: string;
  pageTitle: string;
  userId?: string;
  blogId?: string;
  fileName: string;
}): Promise<string | null> {
  const { prompt, context, pageTitle, userId, blogId, fileName } = params;

  const { data, error } = await supabase.functions.invoke("generate-image", {
    body: {
      prompt,
      context,
      articleTitle: pageTitle,
      articleTheme: pageTitle,
      user_id: userId,
      blog_id: blogId,
    },
  });

  if (error) {
    console.error("[useLandingPages] generate-image error:", error);
    return null;
  }

  if (data?.publicUrl) return data.publicUrl as string;

  if (data?.imageBase64) {
    return await uploadImageToStorage(data.imageBase64 as string, fileName, "article-images");
  }

  return null;
}

function buildHeroPrompt(pageData: LandingPageData, profile?: any): string {
  const companyName = profile?.company_name || "empresa";
  const services = profile?.services || profile?.niche || "serviços";
  const city = profile?.city ? ` em ${profile.city}` : "";

  const title = pageData.hero?.title || "";
  const subtitle = pageData.hero?.subtitle || "";

  return (
    pageData.hero?.background_image_prompt ||
    `Professional, realistic hero photograph for a service landing page.
Company: ${companyName}
Service: ${services}${city}
Headline: ${title}
Context: ${subtitle}

Requirements:
- Realistic photography, natural lighting
- Modern, clean composition
- No text, no logos, no watermarks
- 16:9 aspect ratio`
  );
}

function buildServiceDetailPrompt(detail: any, profile?: any): string {
  const companyName = profile?.company_name || "empresa";
  const services = profile?.services || profile?.niche || "serviços";
  const city = profile?.city ? ` in ${profile.city}` : "";

  return (
    detail.image_prompt ||
    `Professional realistic photo illustrating "${detail.title}".
Company: ${companyName}
Industry: ${services}${city}

Requirements:
- Realistic photography
- No text, no logos, no watermarks
- Editorial quality, clean composition
- 16:9 aspect ratio`
  );
}

export function useLandingPages(): UseLandingPagesReturn {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPages = useCallback(async (blogId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("blog_id", blogId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Cast the data to LandingPage type
      setPages((data || []) as unknown as LandingPage[]);
    } catch (error) {
      console.error("[useLandingPages] Fetch error:", error);
      toast.error("Erro ao carregar landing pages");
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePage = useCallback(async (request: GenerateLandingPageRequest): Promise<LandingPageData | null> => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: request,
      });

      if (error) throw error;

      if (data?.success && data?.page_data) {
        toast.success("Landing page gerada com sucesso!");
        return data.page_data as LandingPageData;
      } else {
        throw new Error(data?.error || "Falha ao gerar landing page");
      }
    } catch (error: any) {
      console.error("[useLandingPages] Generate error:", error);

      if (error.message?.includes("Rate limit")) {
        toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
      } else if (error.message?.includes("Payment required")) {
        toast.error("Créditos insuficientes. Adicione créditos para continuar.");
      } else {
        toast.error("Erro ao gerar landing page");
      }
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const savePage = useCallback(
    async (page: Partial<LandingPage> & { blog_id: string }): Promise<LandingPage | null> => {
      setSaving(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Generate slug from title if not provided
        const slug =
          page.slug ||
          page.title
            ?.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") ||
          `page-${Date.now()}`;

        const insertData = {
          blog_id: page.blog_id,
          user_id: user?.id || null,
          title: page.title || "Nova Landing Page",
          slug,
          page_data: page.page_data || {},
          status: page.status || "draft",
          seo_title: page.seo_title,
          seo_description: page.seo_description,
          template_type: page.template_type || "service_page",
          generation_source: page.generation_source || "ai",
        };

        const { data, error } = await supabase.from("landing_pages").insert(insertData).select().single();

        if (error) throw error;

        toast.success("Landing page salva!");
        await fetchPages(page.blog_id);
        return data as unknown as LandingPage;
      } catch (error: any) {
        console.error("[useLandingPages] Save error:", error);

        if (error.code === "23505") {
          toast.error("Já existe uma página com esse slug. Escolha outro nome.");
        } else {
          toast.error("Erro ao salvar landing page");
        }
        return null;
      } finally {
        setSaving(false);
      }
    },
    [fetchPages]
  );

  const updatePage = useCallback(async (id: string, updates: Partial<LandingPage>): Promise<boolean> => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Copy allowed fields
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.slug !== undefined) updateData.slug = updates.slug;
      if (updates.page_data !== undefined) updateData.page_data = updates.page_data as unknown;
      if (updates.seo_title !== undefined) updateData.seo_title = updates.seo_title;
      if (updates.seo_description !== undefined) updateData.seo_description = updates.seo_description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.featured_image_url !== undefined) updateData.featured_image_url = updates.featured_image_url;

      const { error } = await supabase.from("landing_pages").update(updateData).eq("id", id);

      if (error) throw error;

      toast.success("Alterações salvas!");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Update error:", error);
      toast.error("Erro ao atualizar landing page");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const deletePage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);

      if (error) throw error;

      setPages((prev) => prev.filter((p) => p.id !== id));
      toast.success("Landing page excluída");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Delete error:", error);
      toast.error("Erro ao excluir landing page");
      return false;
    }
  }, []);

  const publishPage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: pageRow, error: pageErr } = await supabase
        .from("landing_pages")
        .select("id, blog_id, title, slug, page_data, featured_image_url")
        .eq("id", id)
        .maybeSingle();

      if (pageErr || !pageRow) throw pageErr || new Error("Landing page não encontrada");

      const blogId = pageRow.blog_id as string;
      const pageTitle = (pageRow.title as string) || "Landing Page";

      const pageData: LandingPageData =
        typeof pageRow.page_data === "string" ? JSON.parse(pageRow.page_data) : (pageRow.page_data as any);

      // Fetch business context (public table)
      const { data: profile } = await supabase
        .from("business_profile")
        .select("company_name, services, niche, city")
        .eq("blog_id", blogId)
        .maybeSingle();

      // Ensure images (hero + service details)
      let mutated = false;
      const nextData: LandingPageData = structuredClone(pageData);

      // HERO
      if (!nextData.hero?.background_image_url) {
        const heroUrl = await generateLandingPageImage({
          prompt: buildHeroPrompt(nextData, profile),
          context: "hero",
          pageTitle,
          userId: user?.id,
          blogId,
          fileName: `lp-${id}-hero-${Date.now()}.png`,
        });

        if (heroUrl) {
          nextData.hero = { ...nextData.hero, background_image_url: heroUrl };
          mutated = true;
        }
      }

      // SECTIONS (service_details)
      if (Array.isArray(nextData.service_details)) {
        const updatedDetails = [...nextData.service_details];

        for (let i = 0; i < updatedDetails.length; i++) {
          const detail = updatedDetails[i];
          if (detail?.image_url) continue;

          const sectionContext = `section_${Math.min(4, i + 1)}`;
          const sectionUrl = await generateLandingPageImage({
            prompt: buildServiceDetailPrompt(detail, profile),
            context: sectionContext,
            pageTitle,
            userId: user?.id,
            blogId,
            fileName: `lp-${id}-detail-${i + 1}-${Date.now()}.png`,
          });

          if (sectionUrl) {
            updatedDetails[i] = { ...detail, image_url: sectionUrl };
            mutated = true;
          }
        }

        nextData.service_details = updatedDetails;
      }

      const featuredImageUrl =
        (pageRow.featured_image_url as string | null) || nextData.hero?.background_image_url || null;

      const { error } = await supabase
        .from("landing_pages")
        .update({
          page_data: mutated ? (nextData as any) : undefined,
          featured_image_url: featuredImageUrl,
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setPages((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "published" as const, published_at: new Date().toISOString(), featured_image_url: featuredImageUrl || undefined }
            : p
        )
      );

      toast.success("Landing page publicada!");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Publish error:", error);
      toast.error("Erro ao publicar landing page");
      return false;
    }
  }, []);

  const unpublishPage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("landing_pages")
        .update({
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: "draft" as const } : p)));
      toast.success("Landing page despublicada");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Unpublish error:", error);
      toast.error("Erro ao despublicar landing page");
      return false;
    }
  }, []);

  return {
    pages,
    loading,
    generating,
    saving,
    fetchPages,
    generatePage,
    savePage,
    updatePage,
    deletePage,
    publishPage,
    unpublishPage,
  };
}