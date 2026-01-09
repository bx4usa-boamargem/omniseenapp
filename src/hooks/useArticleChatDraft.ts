import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ArticleData {
  title: string;
  excerpt: string;
  meta_description: string;
  content: string;
  keywords: string[];
  faq?: Array<{ question: string; answer: string }>;
  featured_image_url?: string;
}

export interface ChatDraft {
  messages: Message[];
  currentInput: string;
  isReadyToGenerate: boolean;
  generatedArticle: ArticleData | null;
}

interface UseArticleChatDraftReturn {
  draft: ChatDraft | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: (data: ChatDraft) => Promise<void>;
  clearDraft: () => Promise<void>;
  updateDraft: (data: Partial<ChatDraft>) => void;
}

const AUTO_SAVE_INTERVAL = 30000; // 30 segundos
const DEBOUNCE_DELAY = 2000; // 2 segundos debounce para mudanças frequentes

export function useArticleChatDraft(blogId: string): UseArticleChatDraftReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [draft, setDraft] = useState<ChatDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const draftRef = useRef<ChatDraft | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasChangesRef = useRef(false);

  // Manter referência atualizada
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Carregar rascunho ao montar
  useEffect(() => {
    if (!blogId || !user?.id) {
      setIsLoading(false);
      return;
    }

    const loadDraft = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_article_drafts')
          .select('*')
          .eq('blog_id', blogId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading draft:', {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint
          });
        }

        if (data) {
          const loadedDraft: ChatDraft = {
            messages: (data.messages as unknown as Message[]) || [],
            currentInput: data.current_input || '',
            isReadyToGenerate: data.is_ready_to_generate || false,
            generatedArticle: data.generated_article as unknown as ArticleData | null
          };
          setDraft(loadedDraft);
          setLastSaved(new Date(data.updated_at));
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [blogId, user?.id]);

  // Função de salvamento
  const saveDraft = useCallback(async (data: ChatDraft) => {
    if (!blogId || !user?.id) {
      console.warn('saveDraft: Missing blogId or user.id', { blogId, userId: user?.id });
      return;
    }
    
    // Validar que blogId é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(blogId)) {
      console.error('saveDraft: Invalid blogId format', { blogId });
      return;
    }
    
    // Não salvar se só tem a mensagem inicial do assistente
    if (data.messages.length <= 1 && !data.currentInput && !data.generatedArticle) {
      return;
    }

    setIsSaving(true);

    try {
      // First try to update existing draft
      const { data: existingDraft } = await supabase
        .from('chat_article_drafts')
        .select('id')
        .eq('blog_id', blogId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingDraft) {
        // Update existing
        const { error } = await supabase
          .from('chat_article_drafts')
          .update({
            messages: JSON.parse(JSON.stringify(data.messages)) as Json,
            current_input: data.currentInput,
            is_ready_to_generate: data.isReadyToGenerate,
            generated_article: data.generatedArticle ? JSON.parse(JSON.stringify(data.generatedArticle)) as Json : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDraft.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('chat_article_drafts')
          .insert({
            blog_id: blogId,
            user_id: user.id,
            messages: JSON.parse(JSON.stringify(data.messages)) as Json,
            current_input: data.currentInput,
            is_ready_to_generate: data.isReadyToGenerate,
            generated_article: data.generatedArticle ? JSON.parse(JSON.stringify(data.generatedArticle)) as Json : null
          });

        if (error) throw error;
      }

      setLastSaved(new Date());
      hasChangesRef.current = false;
    } catch (error: any) {
      console.error('Error saving draft:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });
      toast({
        variant: "destructive",
        title: "Erro ao salvar rascunho",
        description: error?.message || "Não foi possível salvar o progresso do chat."
      });
    } finally {
      setIsSaving(false);
    }
  }, [blogId, user?.id, toast]);

  // Atualizar draft com debounce
  const updateDraft = useCallback((data: Partial<ChatDraft>) => {
    setDraft(prev => {
      const updated = prev ? { ...prev, ...data } : {
        messages: data.messages || [],
        currentInput: data.currentInput || '',
        isReadyToGenerate: data.isReadyToGenerate || false,
        generatedArticle: data.generatedArticle || null
      };
      return updated;
    });
    hasChangesRef.current = true;

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (draftRef.current && hasChangesRef.current) {
        saveDraft(draftRef.current);
      }
    }, DEBOUNCE_DELAY);
  }, [saveDraft]);

  // Limpar rascunho
  const clearDraft = useCallback(async () => {
    if (!blogId || !user?.id) return;

    try {
      const { error } = await supabase
        .from('chat_article_drafts')
        .delete()
        .eq('blog_id', blogId)
        .eq('user_id', user.id);

      if (error) throw error;

      setDraft(null);
      setLastSaved(null);
      hasChangesRef.current = false;
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [blogId, user?.id]);

  // Auto-save a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (draftRef.current && hasChangesRef.current) {
        saveDraft(draftRef.current);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [saveDraft]);

  // Salvar ao sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (draftRef.current && hasChangesRef.current) {
        // Usar sendBeacon para garantir que o request seja enviado
        const payload = JSON.stringify({
          blog_id: blogId,
          user_id: user?.id,
          messages: draftRef.current.messages,
          current_input: draftRef.current.currentInput,
          is_ready_to_generate: draftRef.current.isReadyToGenerate,
          generated_article: draftRef.current.generatedArticle
        });
        
        // Fallback: salvar sincrono antes de sair
        navigator.sendBeacon?.(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/chat_article_drafts`, payload);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [blogId, user?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Salvar ao desmontar se houver mudanças
      if (draftRef.current && hasChangesRef.current) {
        saveDraft(draftRef.current);
      }
    };
  }, [saveDraft]);

  return {
    draft,
    isLoading,
    isSaving,
    lastSaved,
    saveDraft,
    clearDraft,
    updateDraft
  };
}
