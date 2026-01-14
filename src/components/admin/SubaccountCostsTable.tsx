import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, FileText, ImageIcon, DollarSign } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubaccountCost {
  blog_id: string;
  blog_name: string;
  articles: number;
  images: number;
  total_cost: number;
  text_cost: number;
  image_cost: number;
}

interface SubaccountCostsTableProps {
  logs: Array<{
    blog_id: string | null;
    action_type: string;
    images_generated: number;
    estimated_cost_usd: number;
  }>;
}

export function SubaccountCostsTable({ logs }: SubaccountCostsTableProps) {
  const [blogNames, setBlogNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Aggregate costs by blog
  const subaccountCosts = useMemo(() => {
    const costMap = new Map<string, SubaccountCost>();

    for (const log of logs) {
      const blogId = log.blog_id || "sem-blog";
      const existing = costMap.get(blogId);

      const isArticle = log.action_type === "article_generation";
      const isImage = log.action_type === "image_generation";
      const isSEO = log.action_type === "seo_improvement";
      
      // Text cost includes articles and SEO
      const textCost = (isArticle || isSEO) ? (log.estimated_cost_usd || 0) : 0;
      const imageCost = isImage ? (log.estimated_cost_usd || 0) : 0;

      if (existing) {
        existing.total_cost += log.estimated_cost_usd || 0;
        existing.text_cost += textCost;
        existing.image_cost += imageCost;
        existing.images += log.images_generated || 0;
        if (isArticle) existing.articles++;
      } else {
        costMap.set(blogId, {
          blog_id: blogId,
          blog_name: blogNames[blogId] || blogId.substring(0, 8) + "...",
          articles: isArticle ? 1 : 0,
          images: log.images_generated || 0,
          total_cost: log.estimated_cost_usd || 0,
          text_cost: textCost,
          image_cost: imageCost,
        });
      }
    }

    return Array.from(costMap.values())
      .sort((a, b) => b.total_cost - a.total_cost);
  }, [logs, blogNames]);

  // Fetch blog names
  useEffect(() => {
    const fetchBlogNames = async () => {
      const blogIds = [...new Set(logs.map(l => l.blog_id).filter(Boolean))] as string[];
      
      if (blogIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("blogs")
        .select("id, name")
        .in("id", blogIds);

      if (data) {
        const names: Record<string, string> = {};
        data.forEach(blog => {
          names[blog.id] = blog.name;
        });
        setBlogNames(names);
      }
      setLoading(false);
    };

    fetchBlogNames();
  }, [logs]);

  // Update subaccount names when blogNames changes
  const displayCosts = useMemo(() => {
    return subaccountCosts.map(cost => ({
      ...cost,
      blog_name: blogNames[cost.blog_id] || (cost.blog_id === "sem-blog" ? "Sem Blog Associado" : cost.blog_id.substring(0, 8) + "..."),
    }));
  }, [subaccountCosts, blogNames]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(value);
  };

  const totalCost = displayCosts.reduce((sum, c) => sum + c.total_cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Custos por Subconta
        </CardTitle>
        <CardDescription>
          Detalhamento de custos de IA por blog/subconta no período
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : displayCosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum custo registrado no período
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subconta</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <FileText className="h-3 w-3" />
                      Artigos
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Imagens
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Custo Texto</TableHead>
                  <TableHead className="text-right">Custo Imagem</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <DollarSign className="h-3 w-3" />
                      Total
                    </span>
                  </TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayCosts.map((cost) => (
                  <TableRow key={cost.blog_id}>
                    <TableCell>
                      <div className="font-medium truncate max-w-[200px]" title={cost.blog_name}>
                        {cost.blog_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{cost.articles}</TableCell>
                    <TableCell className="text-right">{cost.images}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(cost.text_cost)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(cost.image_cost)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(cost.total_cost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {totalCost > 0 ? ((cost.total_cost / totalCost) * 100).toFixed(1) : 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {displayCosts.reduce((sum, c) => sum + c.articles, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {displayCosts.reduce((sum, c) => sum + c.images, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(displayCosts.reduce((sum, c) => sum + c.text_cost, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(displayCosts.reduce((sum, c) => sum + c.image_cost, 0))}
                  </TableCell>
                  <TableCell className="text-right text-primary">
                    {formatCurrency(totalCost)}
                  </TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
