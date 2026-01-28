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
  generatePage: (request: GenerateLandingPageRequest) => Promise<LandingPage | null>;
  createPagePlaceholder: (blogId: string, templateType: string) => Promise<{ id: string } | null>;
  generatePageContent: (pageId: string, request: GenerateLandingPageRequest) => Promise<boolean>;
  savePage: (page: Partial<LandingPage> & { blog_id: string }) => Promise<LandingPage | null>;
  updatePage: (id: string, updates: Partial<LandingPage>) => Promise<boolean>;
  deletePage: (id: string) => Promise<boolean>;
  publishPage: (id: string) => Promise<boolean>;
  unpublishPage: (id: string) => Promise<boolean>;
  duplicatePage: (id: string) => Promise<LandingPage | null>;
  archivePage: (id: string) => Promise<boolean>;
  unarchivePage: (id: string) => Promise<boolean>;
  analyzeSEO: (id: string) => Promise<any>;
  fixSEO: (id: string, fixTypes?: string[]) => Promise<any>;
  regeneratePage: (id: string) => Promise<LandingPageData | null>;
}

// Fallback placeholder images (internal storage URLs)
const FALLBACK_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=1200&h=600&fit=crop',
  service: 'https://images.unsplash.com/photo-1581092160607-ee67d3958e78?w=600&h=400&fit=crop',
  local: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=600&fit=crop',
  process: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
  materials: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=600&h=400&fit=crop',
  challenge: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
};

// Generate a single image with retry logic and internal fallback
async function generateImageWithRetry(
  prompt: string,
  context: string,
  blogId: string,
  userId: string,
  maxRetries: number = 2
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ProImagePipeline] Attempt ${attempt} for ${context}`);
      
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt,
          context,
          blog_id: blogId,
          user_id: userId,
        },
      });

      if (!error && data?.publicUrl) {
        console.log(`[ProImagePipeline] ✅ ${context} resolved on attempt ${attempt}`);
        return data.publicUrl;
      }
      
      console.warn(`[ProImagePipeline] Attempt ${attempt} failed for ${context}:`, error);
    } catch (e) {
      console.warn(`[ProImagePipeline] Exception on attempt ${attempt} for ${context}:`, e);
    }
  }
  
  // Return appropriate fallback based on context
  const fallbackKey = context.includes('hero') ? 'hero' 
    : context.includes('service') ? 'service'
    : context.includes('challenge') ? 'challenge'
    : context.includes('local') ? 'local'
    : context.includes('inspection') ? 'process'
    : context.includes('materials') ? 'materials'
    : 'service';
  
  console.log(`[ProImagePipeline] ⚠️ Using fallback for ${context}`);
  return FALLBACK_IMAGES[fallbackKey as keyof typeof FALLBACK_IMAGES];
}

// Resolve all 15+ images for PRO template
async function resolveAllProImages(
  pageData: any,
  blogId: string,
  userId: string
): Promise<{ data: any; resolved: number; failed: number }> {
  const prompts: Array<{ key: string; path: string[]; prompt: string }> = [];

  // Extract all 15 image prompts
  // 1. Hero (1)
  if (pageData.hero?.image_prompt && !pageData.hero?.image_url) {
    prompts.push({ 
      key: 'hero', 
      path: ['hero', 'image_url'], 
      prompt: pageData.hero.image_prompt 
    });
  }

  // 2. Service Cards (4)
  pageData.service_cards?.forEach((card: any, i: number) => {
    if (card.image_prompt && !card.image_url) {
      prompts.push({ 
        key: `service_${i}`, 
        path: ['service_cards', String(i), 'image_url'], 
        prompt: card.image_prompt 
      });
    }
  });

  // 3. Deep Dives (4 = 2x2)
  pageData.deep_dives?.forEach((dive: any, i: number) => {
    if (dive.hero_image_prompt && !dive.hero_image_url) {
      prompts.push({ 
        key: `dive_${i}_hero`, 
        path: ['deep_dives', String(i), 'hero_image_url'], 
        prompt: dive.hero_image_prompt 
      });
    }
    if (dive.side_image_prompt && !dive.side_image_url) {
      prompts.push({ 
        key: `dive_${i}_side`, 
        path: ['deep_dives', String(i), 'side_image_url'], 
        prompt: dive.side_image_prompt 
      });
    }
  });

  // 4. Local Context (4 = 1 hero + 3 challenges)
  if (pageData.local_context?.hero_image_prompt && !pageData.local_context?.hero_image_url) {
    prompts.push({ 
      key: 'local_hero', 
      path: ['local_context', 'hero_image_url'], 
      prompt: pageData.local_context.hero_image_prompt 
    });
  }
  pageData.local_context?.challenges?.forEach((c: any, i: number) => {
    if (c.image_prompt && !c.image_url) {
      prompts.push({ 
        key: `challenge_${i}`, 
        path: ['local_context', 'challenges', String(i), 'image_url'], 
        prompt: c.image_prompt 
      });
    }
  });

  // 5. Inspection Process (1)
  if (pageData.inspection_process?.image_prompt && !pageData.inspection_process?.image_url) {
    prompts.push({ 
      key: 'inspection', 
      path: ['inspection_process', 'image_url'], 
      prompt: pageData.inspection_process.image_prompt 
    });
  }

  // 6. Materials (1)
  if (pageData.materials_quality?.image_prompt && !pageData.materials_quality?.image_url) {
    prompts.push({ 
      key: 'materials', 
      path: ['materials_quality', 'image_url'], 
      prompt: pageData.materials_quality.image_prompt 
    });
  }

  console.log(`[ProImagePipeline] Starting resolution of ${prompts.length} images...`);

  let resolved = 0;
  let failed = 0;
  const nextData = JSON.parse(JSON.stringify(pageData));

  // Process in batches of 4 for performance
  const batchSize = 4;
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    
    toast.info(`Gerando imagens ${i + 1}-${Math.min(i + batchSize, prompts.length)} de ${prompts.length}...`);
    
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const url = await generateImageWithRetry(p.prompt, p.key, blogId, userId);
        return { key: p.key, path: p.path, url };
      })
    );

    // Apply results to data
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.url) {
        const { path, url } = result.value;
        
        // Navigate to the correct nested property
        let target: any = nextData;
        for (let j = 0; j < path.length - 1; j++) {
          const key = path[j];
          if (!target[key]) target[key] = {};
          target = target[key];
        }
        target[path[path.length - 1]] = url;
        resolved++;
      } else {
        failed++;
      }
    }
  }

  console.log(`[ProImagePipeline] Complete: ${resolved} resolved, ${failed} failed`);
  return { data: nextData, resolved, failed };
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

  // ============================================================
  // EARLY REDIRECT PATTERN: Create placeholder with status "generating"
  // ============================================================
  const createPagePlaceholder = useCallback(async (
    blogId: string, 
    templateType: string
  ): Promise<{ id: string } | null> => {
    console.log("[CLICK][GEN_PAGE] createPagePlaceholder iniciado", {
      timestamp: new Date().toISOString(),
      blogId,
      templateType,
    });

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      console.log("[AUTH][GEN_PAGE]", {
        userId: user?.id,
        email: user?.email,
        expiresAt: session?.expires_at,
        authError: authError?.message,
      });

      if (!user) {
        console.error("[AUTH][GEN_PAGE] User null - sessão expirada");
        toast.error("Sessão expirada. Faça login novamente.");
        return null;
      }

      // Validate blog ownership
      const { data: blogData, error: blogError } = await supabase
        .from('blogs')
        .select('user_id')
        .eq('id', blogId)
        .single();

      console.log("[BLOG][GEN_PAGE]", {
        blogOwnerId: blogData?.user_id,
        currentUserId: user.id,
        match: blogData?.user_id === user.id,
        blogError: blogError?.message,
      });

      const timestamp = Date.now();

      console.log("[INSERT][GEN_PAGE] Attempting insert...", { 
        blogId, 
        userId: user.id, 
        templateType,
        slug: `super-pagina-${timestamp}`,
        status: "generating",
      });

      const { data, error } = await supabase
        .from("landing_pages")
        .insert({
          blog_id: blogId,
          user_id: user.id,
          title: "Nova Super Página",
          slug: `super-pagina-${timestamp}`,
          status: "generating",
          page_data: { template: templateType },
          template_type: templateType,
          generation_source: 'ai',
        })
        .select("id")
        .single();

      if (error) {
        console.error("[INSERT-ERROR][GEN_PAGE]", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        toast.error(`Erro ao criar página: ${error.message}`);
        return null;
      }

      console.log("[INSERT-SUCCESS][GEN_PAGE]", { pageId: data.id });
      return data;
    } catch (err: any) {
      console.error("[EXCEPTION][GEN_PAGE]", err);
      toast.error(err.message || "Erro inesperado ao criar página");
      return null;
    }
  }, []);

  // ============================================================
  // EARLY REDIRECT PATTERN: Generate content for existing placeholder
  // ============================================================
  const generatePageContent = useCallback(async (
    pageId: string,
    request: GenerateLandingPageRequest
  ): Promise<boolean> => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      toast.info("Gerando estrutura da página...");
      
      // 1. Generate structure via Edge Function
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: request,
      });

      if (error || !data.success) {
        throw new Error(data?.error || "IA generation failed");
      }
      
      let pageData = data.page_data;
      const isPro = pageData.template === 'service_authority_pro_v1';
      
      // 2. Image resolution
      if (isPro) {
        toast.info("Gerando 15+ imagens fotográficas profissionais...");
        const imageResult = await resolveAllProImages(pageData, request.blog_id, user.id);
        pageData = imageResult.data;
      } else {
        if (pageData.hero?.image_prompt) {
          const heroUrl = await generateImageWithRetry(
            pageData.hero.image_prompt, 'hero', request.blog_id, user.id
          );
          pageData.hero.image_url = heroUrl;
        }
        if (Array.isArray(pageData.services)) {
          for (let i = 0; i < pageData.services.length; i++) {
            if (pageData.services[i].image_prompt) {
              const svcUrl = await generateImageWithRetry(
                pageData.services[i].image_prompt, `service_${i}`, request.blog_id, user.id
              );
              pageData.services[i].image_url = svcUrl;
            }
          }
        }
      }

      // 3. Update placeholder with complete content
      const { error: updateError } = await supabase
        .from("landing_pages")
        .update({
          title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
          page_data: pageData,
          template_type: pageData.template || request.template_type || 'service_authority_v1',
          status: 'published',
          published_at: new Date().toISOString(),
          seo_title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
          seo_description: data.seo_description || pageData.hero?.subheadline || "",
          seo_keywords: data.seo_keywords || [],
        })
        .eq("id", pageId);

      if (updateError) throw updateError;

      toast.success(isPro ? "🎉 Super Página PRO criada!" : "Super Página gerada!");
      return true;
    } catch (err: any) {
      console.error("[generatePageContent] Error:", err);
      
      // Mark as draft on failure
      await supabase
        .from("landing_pages")
        .update({ status: 'draft' })
        .eq("id", pageId);
      
      toast.error(err.message || "Falha na geração");
      return false;
    } finally {
      setGenerating(false);
    }
  }, []);

  const generatePage = useCallback(async (request: GenerateLandingPageRequest): Promise<LandingPage | null> => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      
      toast.info("Gerando estrutura da página...");
      
      // 1. GERAÇÃO DO JSON ESTRUTURAL
      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: request,
      });

      if (error || !data.success) {
        console.error("[useLandingPages] Edge Function Error:", error || data?.error);
        throw new Error(data?.error || "IA generation failed");
      }
      
      let pageData = data.page_data;
      const isPro = pageData.template === 'service_authority_pro_v1';
      
      // 2. RESOLUÇÃO DE IMAGENS
      if (isPro) {
        // PRO template: resolve all 15 images with pipeline
        toast.info("Gerando 15+ imagens fotográficas profissionais...");
        const imageResult = await resolveAllProImages(pageData, request.blog_id, user.id);
        pageData = imageResult.data;
        console.log(`[generatePage] PRO images: ${imageResult.resolved} resolved, ${imageResult.failed} failed`);
      } else {
        // Standard template: resolve hero + services only
        if (pageData.hero?.image_prompt) {
          try {
            const heroUrl = await generateImageWithRetry(
              pageData.hero.image_prompt, 
              'hero', 
              request.blog_id, 
              user.id
            );
            pageData.hero.image_url = heroUrl;
          } catch (e) {
            console.warn("[Pipeline] Hero image failed");
          }
        }

        if (Array.isArray(pageData.services)) {
          for (let i = 0; i < pageData.services.length; i++) {
            if (pageData.services[i].image_prompt) {
              try {
                const svcUrl = await generateImageWithRetry(
                  pageData.services[i].image_prompt,
                  `service_${i}`,
                  request.blog_id,
                  user.id
                );
                pageData.services[i].image_url = svcUrl;
              } catch (e) {
                console.warn(`[Pipeline] Service ${i} image failed`);
              }
            }
          }
        }
      }

      // 3. PERSISTÊNCIA
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
        user_id: user.id,
        title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
        slug: data.slug || finalSlug,
        page_data: pageData,
        template_type: pageData.template || request.template_type || 'service_authority_v1',
        status: 'published',
        published_at: new Date().toISOString(),
        seo_title: data.seo_title || pageData.hero?.headline || "Nova Super Página",
        seo_description: data.seo_description || pageData.hero?.subheadline || "",
        seo_keywords: data.seo_keywords || [],
        generation_source: 'ai',
      };

      console.log("[Pipeline] Saving page to database...");

      const { data: savedPage, error: saveError } = await supabase
        .from("landing_pages")
        .insert([insertPayload])
        .select()
        .single();

      if (saveError) {
        console.error("[Pipeline] Save Error:", saveError);
        throw new Error(`Database save failed: ${saveError.message}`);
      }

      toast.success(isPro 
        ? "🎉 Super Página PRO criada com sucesso!" 
        : "Super Página gerada e publicada!"
      );
      
      return savedPage as unknown as LandingPage;
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const cleanPageData = typeof page.page_data === 'string' 
          ? JSON.parse(page.page_data) 
          : JSON.parse(JSON.stringify(page.page_data || {}));

        const slug = page.slug || page.title
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `page-${Date.now()}`;

        const insertData = {
          blog_id: page.blog_id,
          user_id: user.id,
          title: page.title || "Nova Landing Page",
          slug,
          page_data: cleanPageData,
          status: page.status || "draft",
          seo_title: page.seo_title || page.title,
          seo_description: page.seo_description || "",
          template_type: page.template_type || cleanPageData.template || "service_page",
          generation_source: page.generation_source || "ai",
        };

        const { data, error } = await supabase
          .from("landing_pages")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        toast.success("Landing page salva!");
        await fetchPages(page.blog_id);
        return data as unknown as LandingPage;
      } catch (error: any) {
        console.error("[useLandingPages] Save error:", error);
        if (error.code === "23505") {
          toast.error("Já existe uma página com esse slug.");
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
      if (updates.seo_title !== undefined) updateData.seo_title = updates.seo_title;
      if (updates.seo_description !== undefined) updateData.seo_description = updates.seo_description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.featured_image_url !== undefined) updateData.featured_image_url = updates.featured_image_url;

      if (updates.page_data !== undefined) {
        const cleanData = typeof updates.page_data === 'string' 
          ? JSON.parse(updates.page_data) 
          : JSON.parse(JSON.stringify(updates.page_data));
        
        Object.keys(cleanData).forEach(key => {
          if (cleanData[key] === undefined || cleanData[key] === null) {
            delete cleanData[key];
          }
        });
        
        updateData.page_data = cleanData;
      }

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
      const { error } = await supabase
        .from("landing_pages")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setPages((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "published" as const, published_at: new Date().toISOString() } : p
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
        .update({ status: "draft", updated_at: new Date().toISOString() })
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

  const duplicatePage = useCallback(async (id: string): Promise<LandingPage | null> => {
    try {
      const { data: original, error: fetchError } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !original) throw fetchError || new Error("Page not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const newSlug = `${original.slug}-copy-${Date.now()}`;
      const newPage = {
        blog_id: original.blog_id,
        user_id: user.id,
        title: `${original.title} (cópia)`,
        slug: newSlug,
        page_data: original.page_data,
        status: "draft",
        seo_title: original.seo_title,
        seo_description: original.seo_description,
        seo_keywords: original.seo_keywords,
        template_type: original.template_type,
        generation_source: "duplicate",
      };

      const { data, error } = await supabase
        .from("landing_pages")
        .insert([newPage])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as LandingPage;
    } catch (error) {
      console.error("[useLandingPages] Duplicate error:", error);
      toast.error("Erro ao duplicar página");
      return null;
    }
  }, []);

  const archivePage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("landing_pages")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: "archived" as const } : p)));
      toast.success("Página arquivada");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Archive error:", error);
      toast.error("Erro ao arquivar página");
      return false;
    }
  }, []);

  const unarchivePage = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("landing_pages")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: "draft" as const } : p)));
      toast.success("Página restaurada");
      return true;
    } catch (error) {
      console.error("[useLandingPages] Unarchive error:", error);
      toast.error("Erro ao restaurar página");
      return false;
    }
  }, []);

  const analyzeSEO = useCallback(async (id: string): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke("analyze-landing-page-seo", {
        body: { landing_page_id: id },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[useLandingPages] Analyze SEO error:", error);
      toast.error("Erro ao analisar SEO");
      return null;
    }
  }, []);

  const fixSEO = useCallback(async (id: string, fixTypes?: string[]): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke("fix-landing-page-seo", {
        body: { 
          landing_page_id: id,
          fix_types: fixTypes || ["title", "meta", "content", "keywords"]
        },
      });

      if (error) throw error;
      
      const fixesApplied = data?.fixes_applied || [];
      if (fixesApplied.length > 0) {
        toast.success(`SEO otimizado: ${fixesApplied.join(', ')}`);
      } else {
        toast.info("Nenhuma otimização necessária");
      }
      return data;
    } catch (error) {
      console.error("[useLandingPages] Fix SEO error:", error);
      toast.error("Erro ao corrigir SEO");
      return null;
    }
  }, []);

  const regeneratePage = useCallback(async (id: string): Promise<LandingPageData | null> => {
    setGenerating(true);
    try {
      const { data: existingPage, error: fetchError } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !existingPage) throw new Error("Landing page not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("business_profile")
        .select("*")
        .eq("blog_id", existingPage.blog_id)
        .single();

      const pageDataObj = existingPage.page_data as Record<string, unknown> | null;
      const currentTemplate = (pageDataObj?.template as string) || existingPage.template_type || "service_authority_v1";
      
      console.log(`[regeneratePage] Regenerating page ${id} with template ${currentTemplate}`);
      toast.info("Regenerando conteúdo da página...");

      const { data, error } = await supabase.functions.invoke("generate-landing-page", {
        body: {
          blog_id: existingPage.blog_id,
          company_name: profile?.company_name,
          niche: profile?.niche,
          city: profile?.city,
          services: profile?.services?.split(',').map((s: string) => s.trim()),
          phone: profile?.whatsapp || "",
          template_type: currentTemplate
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Regeneration failed");
      }

      let newPageData = data.page_data;
      const isPro = currentTemplate === 'service_authority_pro_v1';

      // Resolve images for PRO template
      if (isPro) {
        toast.info("Regenerando imagens fotográficas...");
        const imageResult = await resolveAllProImages(newPageData, existingPage.blog_id, user.id);
        newPageData = imageResult.data;
      }

      const { error: updateError } = await supabase
        .from("landing_pages")
        .update({
          page_data: newPageData,
          title: data.seo_title || newPageData.hero?.headline || existingPage.title,
          seo_title: data.seo_title || newPageData.hero?.headline,
          seo_description: data.seo_description || "",
          seo_keywords: data.seo_keywords || [],
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Página regenerada com sucesso!");
      return newPageData;
    } catch (error) {
      console.error("[useLandingPages] Regenerate error:", error);
      toast.error("Erro ao regenerar página");
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    pages,
    loading,
    generating,
    saving,
    fetchPages,
    generatePage,
    createPagePlaceholder,
    generatePageContent,
    savePage,
    updatePage,
    deletePage,
    publishPage,
    unpublishPage,
    duplicatePage,
    archivePage,
    unarchivePage,
    analyzeSEO,
    fixSEO,
    regeneratePage,
  };
}
