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

  try {
    const { data, error } = await supabase.functions.invoke("generate-image", {
      body: {
        prompt: `Photorealistic professional photography, ${prompt}, natural lighting, high detail, no text, no logos, no cartoon, no 3D, no anime.`,
        context,
        articleTitle: pageTitle,
        articleTheme: pageTitle,
        user_id: userId,
        blog_id: blogId,
      },
    });

    if (error) throw error;

    if (data?.publicUrl) return data.publicUrl as string;

    if (data?.imageBase64) {
      return await uploadImageToStorage(data.imageBase64 as string, fileName, "article-images");
    }
  } catch (err) {
    console.error(`[ImagePipeline] Generation failed for ${context}, falling back to Unsplash:`, err);
    // Fallback para Unsplash usando o prompt simplificado
    const query = encodeURIComponent(prompt.split(',')[0]);
    return `https://source.unsplash.com/featured/?${query},professional,service`;
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
    `Professional, realistic hero photograph for a service landing page.\nCompany: ${companyName}\nService: ${services}${city}\nHeadline: ${title}\nContext: ${subtitle}\n\nRequirements:\n- Realistic photography, natural lighting\n- Modern, clean composition\n- No text, no logos, no watermarks\n- 16:9 aspect ratio`
  );
}

function buildServiceDetailPrompt(detail: any, profile?: any): string {
  const companyName = profile?.company_name || "empresa";
  const services = profile?.services || profile?.niche || "serviços";
  const city = profile?.city ? ` em ${profile.city}` : "";

  return (
    detail.image_prompt ||
    `Professional realistic photo illustrating "${detail.title}".\nCompany: ${companyName}\nIndustry: ${services}${city}\n\nRequirements:\n- Realistic photography\n- No text, no logos, no watermarks\n- Editorial quality, clean composition\n- 16:9 aspect ratio`
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      // 1. GERAÇÃO DO JSON ESTRUTURAL
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: request,
      });

      if (error || !data.success) {
        console.error("[useLandingPages] Edge Function Error:", error || data?.error);
        throw new Error(data?.error || "IA generation failed");
      }
      
      const pageData = data.page_data;
      
      // Inicializar URLs como null para evitar erros de render
      if (pageData.hero) pageData.hero.image_url = null;
      if (Array.isArray(pageData.services)) {
        pageData.services = pageData.services.map((s: any) => ({ ...s, image_url: null }));
      }

      toast.info("Geração de Imagens Fotográficas em andamento...");

      // 2. RESOLUÇÃO DE IMAGENS (Pipeline idêntico ao Artigo)
      // Resolve Hero - Usando prompt limpo e curto
      if (pageData.hero?.image_prompt) {
        try {
          const { data: heroImg } = await supabase.functions.invoke("generate-image", {
            body: {
              prompt: pageData.hero.image_prompt,
              context: 'hero',
              blog_id: request.blog_id,
              user_id: user.id
            }
          });
          if (heroImg?.publicUrl) pageData.hero.image_url = heroImg.publicUrl;
        } catch (e) {
          console.warn("[Pipeline] Hero image resolution failed, continuing...");
        }
      }

      // Resolve Service Cards
      if (Array.isArray(pageData.services)) {
        for (let i = 0; i < pageData.services.length; i++) {
          if (pageData.services[i].image_prompt) {
            try {
              const { data: svcImg } = await supabase.functions.invoke("generate-image", {
                body: {
                  prompt: pageData.services[i].image_prompt,
                  context: `service_${i}`,
                  blog_id: request.blog_id,
                  user_id: user.id
                }
              });
              if (svcImg?.publicUrl) pageData.services[i].image_url = svcImg.publicUrl;
            } catch (e) {
              console.warn(`[Pipeline] Service ${i} image resolution failed, continuing...`);
            }
          }
        }
      }

      // 3. PERSISTÊNCIA OBRIGATÓRIA ANTES DO RENDER
      // Usar um slug robusto e único
      const timestamp = Date.now();
      const baseSlug = (pageData.hero?.headline || "lp")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const finalSlug = `${baseSlug}-${timestamp}`;

      const insertPayload: any = {
        blog_id: request.blog_id,
        title: pageData.hero?.headline || "Nova Super Página",
        slug: finalSlug,
        page_data: pageData,
        status: 'published',
        published_at: new Date().toISOString()
      };

      // Só adiciona user_id se o usuário estiver autenticado, 
      // mas o trigger no banco já vai cuidar disso como fallback.
      if (user?.id) {
        insertPayload.user_id = user.id;
      }

      console.log("[Pipeline] Attempting final insert with user_id resolution:", insertPayload);

      const { data: savedPage, error: saveError } = await supabase
        .from("landing_pages")
        .insert([insertPayload])
        .select()
        .single();

      if (saveError) {
        console.error("[Pipeline] Save Error Detail:", saveError);
        // Fallback: Tenta inserir sem user_id explicitamente (confiando no trigger/default do banco)
        if (saveError.message.includes('user_id')) {
          console.info("[Pipeline] Retrying insert without explicit user_id field...");
          const { user_id, ...payloadWithoutUser } = insertPayload;
          const { data: retryData, error: retryError } = await supabase
            .from("landing_pages")
            .insert([payloadWithoutUser])
            .select()
            .single();
          
          if (retryError) throw new Error(`Database save failed after retry: ${retryError.message}`);
        } else {
          throw new Error(`Database save failed: ${saveError.message}`);
        }
      }

      toast.success("Super Página gerada e publicada!");
      return pageData;
    } catch (err: any) {
      console.error("[useLandingPages] CRITICAL FAILURE:", err);
      toast.error(err.message || "Falha na criação da Super Página");
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

        if (!user) throw new Error("Usuário não autenticado");

        // Garantir que page_data seja um objeto limpo antes de enviar
        const cleanPageData = typeof page.page_data === 'string' 
          ? JSON.parse(page.page_data) 
          : JSON.parse(JSON.stringify(page.page_data || {}));

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
          user_id: user.id,
          title: page.title || "Nova Landing Page",
          slug,
          page_data: cleanPageData, // Enviar como objeto puro para o SDK do Supabase
          status: page.status || "draft",
          seo_title: page.seo_title || page.title,
          seo_description: page.seo_description || "",
          template_type: page.template_type || "service_page",
          generation_source: page.generation_source || "ai",
        };

        console.log("[useLandingPages] Attempting save with data:", insertData);

        const { data, error } = await supabase
          .from("landing_pages")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error("[useLandingPages] Supabase Insert Error:", error);
          throw error;
        }

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

      const { data: profile } = await supabase
        .from("business_profile")
        .select("company_name, services, niche, city")
        .eq("blog_id", blogId)
        .maybeSingle();

      let mutated = false;
      const nextData: LandingPageData = JSON.parse(JSON.stringify(pageData));

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

      const updatePayload: Record<string, unknown> = {
        featured_image_url: featuredImageUrl,
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (mutated) updatePayload.page_data = nextData as any;

      const { error } = await supabase.from("landing_pages").update(updatePayload).eq("id", id);

      if (error) throw error;

      setPages((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: "published" as const,
                published_at: new Date().toISOString(),
                featured_image_url: featuredImageUrl || undefined,
              }
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