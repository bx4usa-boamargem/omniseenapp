import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, Plus, Loader2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AISuggestKeywordsModal } from "@/components/keywords/AISuggestKeywordsModal";

interface SimpleKeywordsSectionProps {
  blogId: string;
}

interface SavedKeyword {
  id: string;
  keyword: string;
}

export function SimpleKeywordsSection({ blogId }: SimpleKeywordsSectionProps) {
  const [keywords, setKeywords] = useState<SavedKeyword[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAISuggestModal, setShowAISuggestModal] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, [blogId]);

  const fetchKeywords = async () => {
    try {
      const { data, error } = await supabase
        .from("keyword_analyses")
        .select("id, keyword")
        .eq("blog_id", blogId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setKeywords(data || []);
    } catch (error) {
      console.error("Error fetching keywords:", error);
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    
    // Check if already exists
    if (keywords.some(k => k.keyword.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Palavra-chave já adicionada");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("keyword_analyses")
        .insert({
          blog_id: blogId,
          keyword: trimmed,
          source: "manual",
        })
        .select("id, keyword")
        .single();

      if (error) throw error;

      setKeywords(prev => [data, ...prev]);
      setKeywordInput("");
      toast.success("Palavra-chave adicionada");
    } catch (error) {
      console.error("Error adding keyword:", error);
      toast.error("Erro ao adicionar palavra-chave");
    } finally {
      setSaving(false);
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      const { error } = await supabase
        .from("keyword_analyses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (error) {
      console.error("Error removing keyword:", error);
      toast.error("Erro ao remover palavra-chave");
    }
  };

  const handleAIKeywordsAdded = async (addedKeywords: string[]) => {
    if (addedKeywords.length === 0) return;

    try {
      const existingKeywords = keywords.map(k => k.keyword.toLowerCase());
      const newKeywords = addedKeywords.filter(
        k => !existingKeywords.includes(k.toLowerCase())
      );

      if (newKeywords.length === 0) {
        toast.info("Todas as palavras-chave já estão adicionadas");
        setShowAISuggestModal(false);
        return;
      }

      const { error } = await supabase
        .from("keyword_analyses")
        .insert(
          newKeywords.map(keyword => ({
            blog_id: blogId,
            keyword,
            source: "ai_suggestion"
          }))
        );

      if (error) throw error;

      await fetchKeywords();
      toast.success(`${newKeywords.length} palavras-chave adicionadas com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar palavras-chave");
    } finally {
      setShowAISuggestModal(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Palavras-chave
          </CardTitle>
          <CardDescription>
            Adicione palavras-chave que a IA usará para gerar artigos relevantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Suggest Button */}
          <Button
            onClick={() => setShowAISuggestModal(true)}
            className="w-full gap-2"
            variant="outline"
          >
            <Sparkles className="h-4 w-4" />
            Sugerir palavras-chave com IA
          </Button>

          {/* Manual Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Digite uma palavra-chave..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              disabled={saving}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={addKeyword}
              disabled={saving || !keywordInput.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Keywords List */}
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <Badge key={kw.id} variant="secondary" className="gap-1 py-1.5">
                  {kw.keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw.id)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma palavra-chave adicionada. Use a IA para sugerir ou adicione manualmente.
            </p>
          )}

          {keywords.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {keywords.length} palavra{keywords.length !== 1 ? "s" : ""}-chave adicionada{keywords.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Suggest Modal */}
      <AISuggestKeywordsModal
        open={showAISuggestModal}
        onOpenChange={setShowAISuggestModal}
        blogId={blogId}
        onAddKeywords={handleAIKeywordsAdded}
      />
    </>
  );
}
