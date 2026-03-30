import { useEffect, useState } from "react";
import { sanitizeHTML } from "@/lib/sanitize";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, XCircle, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface ReviewData {
  id: string;
  article_id: string;
  share_token: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  comments: unknown;
  created_at: string;
  reviewed_at: string | null;
  articles: {
    title: string;
    content: string;
    featured_image_url: string | null;
  } | null;
}

export default function ClientReview() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchReview() {
      if (!token) return;

      const { data, error } = await supabase
        .from("client_reviews")
        .select(`
          *,
          articles (
            title,
            content,
            featured_image_url
          )
        `)
        .eq("share_token", token)
        .single();

      if (error || !data) {
        console.error("Error fetching review:", error);
      } else {
        setReview(data as ReviewData);
      }
      setLoading(false);
    }

    fetchReview();
  }, [token]);

  const handleAction = async (action: "approved" | "rejected") => {
    if (!review) return;
    setSubmitting(true);

    const commentsArray = Array.isArray(review.comments) ? review.comments : [];
    const newComments = comment.trim()
      ? [...commentsArray, { text: comment, date: new Date().toISOString() }]
      : commentsArray;

    const { error } = await supabase
      .from("client_reviews")
      .update({
        status: action,
        comments: newComments,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", review.id);

    if (error) {
      toast.error("Erro ao enviar revisão");
    } else {
      setReview(prev => prev ? { ...prev, status: action, comments: newComments } : null);
      toast.success(action === "approved" ? "Artigo aprovado!" : "Artigo reprovado");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!review || !review.articles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link inválido ou expirado</h2>
            <p className="text-muted-foreground">
              Este link de revisão não existe ou já expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReviewed = review.status !== "pending";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Revisão de Artigo</h1>
              <p className="text-sm text-muted-foreground">
                Revise e aprove o conteúdo abaixo
              </p>
            </div>
            {isReviewed && (
              <Badge 
                variant={review.status === "approved" ? "default" : "destructive"}
                className="text-sm"
              >
                {review.status === "approved" ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aprovado
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Reprovado
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Article Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{review.articles.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {review.articles.featured_image_url && (
                  <img
                    src={review.articles.featured_image_url}
                    alt={review.articles.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(review.articles.content || "") }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Review Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Sua Avaliação
                </CardTitle>
                <CardDescription>
                  {isReviewed 
                    ? "Você já enviou sua avaliação" 
                    : "Deixe um comentário e aprove ou reprove o artigo"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Deixe um comentário (opcional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isReviewed || submitting}
                  className="min-h-[120px]"
                />

                {!isReviewed && (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleAction("rejected")}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reprovar
                        </>
                      )}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleAction("approved")}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Previous Comments */}
            {Array.isArray(review.comments) && review.comments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comentários</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(review.comments as { text: string; date: string }[]).map((c, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{c.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(c.date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
