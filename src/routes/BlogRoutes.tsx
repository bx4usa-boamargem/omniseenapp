import { Routes, Route } from 'react-router-dom';
import CustomDomainBlog from '@/pages/CustomDomainBlog';
import CustomDomainArticle from '@/pages/CustomDomainArticle';
import CustomDomainLandingPage from '@/pages/CustomDomainLandingPage';
import { useDomainResolution } from '@/hooks/useDomainResolution';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Rotas dedicadas para blogs públicos
 * Usadas quando acesso é via subdomínio ({slug}.app.omniseen.app) ou domínio customizado
 */
export function BlogRoutes() {
  const { blogId, isLoading, error } = useDomainResolution();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-2/3 mx-auto mb-4" />
          <Skeleton className="h-6 w-1/2 mx-auto mb-12" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !blogId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Blog não encontrado
          </h1>
          <p className="text-muted-foreground">
            Este domínio não está configurado corretamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<CustomDomainBlog blogId={blogId} />} />
      <Route path="/p/:pageSlug" element={<CustomDomainLandingPage blogId={blogId} />} />
      <Route path="/:articleSlug" element={<CustomDomainArticle blogId={blogId} />} />
    </Routes>
  );
}