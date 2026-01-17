import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ArrowLeft, Loader2, FileText, Eye, Clock, Target, Globe, Search, Share2, Mail, Link2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { FunnelChart } from "@/components/analytics/FunnelChart";
import { ScrollHeatmap } from "@/components/analytics/ScrollHeatmap";
import { SectionTimeChart } from "@/components/analytics/SectionTimeChart";

interface BlogTraffic {
  date: string;
  total_visits: number;
  unique_visitors: number;
  direct_visits: number;
  organic_visits: number;
  social_visits: number;
  email_visits: number;
  referral_visits: number;
  avg_time_on_site: number;
}

interface ArticleAnalytics {
  article_id: string;
  title: string;
  views: number;
  avg_time: number;
  read_rate: number;
}

interface Blog {
  id: string;
  name: string;
}

const COLORS = ['hsl(245, 82%, 58%)', 'hsl(280, 80%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

export default function Analytics() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [traffic, setTraffic] = useState<BlogTraffic[]>([]);
  const [articles, setArticles] = useState<ArticleAnalytics[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Get user's blog
        const { data: blogData } = await supabase
          .from('blogs')
          .select('id, name')
          .eq('user_id', user.id)
          .single();

        if (!blogData) {
          setLoadingData(false);
          return;
        }

        setBlog(blogData);

        // Get traffic data
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));

        const { data: trafficData } = await supabase
          .from('blog_traffic')
          .select('*')
          .eq('blog_id', blogData.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .order('date', { ascending: true });

        if (trafficData) {
          setTraffic(trafficData);
        }

        // Get article analytics
        const { data: analyticsData } = await supabase
          .from('article_analytics')
          .select('article_id, time_on_page, read_percentage')
          .eq('blog_id', blogData.id)
          .gte('created_at', startDate.toISOString());

        // Get articles
        const { data: articlesData } = await supabase
          .from('articles')
          .select('id, title')
          .eq('blog_id', blogData.id)
          .eq('status', 'published');

        if (analyticsData && articlesData) {
          // Aggregate analytics per article
          const articleMap = new Map<string, { views: number; totalTime: number; totalRead: number }>();
          
          analyticsData.forEach(a => {
            const existing = articleMap.get(a.article_id) || { views: 0, totalTime: 0, totalRead: 0 };
            existing.views++;
            existing.totalTime += a.time_on_page || 0;
            existing.totalRead += a.read_percentage || 0;
            articleMap.set(a.article_id, existing);
          });

          const articleAnalytics: ArticleAnalytics[] = articlesData.map(article => {
            const stats = articleMap.get(article.id) || { views: 0, totalTime: 0, totalRead: 0 };
            return {
              article_id: article.id,
              title: article.title,
              views: stats.views,
              avg_time: stats.views > 0 ? Math.round(stats.totalTime / stats.views) : 0,
              read_rate: stats.views > 0 ? Math.round(stats.totalRead / stats.views) : 0,
            };
          }).sort((a, b) => b.views - a.views).slice(0, 10);

          setArticles(articleAnalytics);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user, period]);

  // Connected to real subscription status
  const { isActive, isTrial } = useSubscription();
  const isPremium = isActive || isTrial;

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Elegant empty state when no blog is found
  if (!blog) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container flex h-16 items-center">
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </header>
        <main className="container py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-6">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Nenhum blog encontrado</h2>
            <p className="text-muted-foreground mb-6">
              Crie seu primeiro blog para acessar o analytics detalhado.
            </p>
            <Button onClick={() => navigate("/app/dashboard")}>
              Ir para Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Aggregate totals
  const totalVisits = traffic.reduce((sum, t) => sum + t.total_visits, 0);
  const totalDirect = traffic.reduce((sum, t) => sum + t.direct_visits, 0);
  const totalOrganic = traffic.reduce((sum, t) => sum + t.organic_visits, 0);
  const totalSocial = traffic.reduce((sum, t) => sum + t.social_visits, 0);
  const totalEmail = traffic.reduce((sum, t) => sum + (t.email_visits || 0), 0);
  const totalReferral = traffic.reduce((sum, t) => sum + (t.referral_visits || 0), 0);
  const avgTime = traffic.length > 0 
    ? Math.round(traffic.reduce((sum, t) => sum + t.avg_time_on_site, 0) / traffic.length) 
    : 0;
  const totalArticleViews = articles.reduce((sum, a) => sum + a.views, 0);
  const avgReadRate = articles.length > 0 
    ? Math.round(articles.reduce((sum, a) => sum + a.read_rate, 0) / articles.length) 
    : 0;

  const trafficSourcesData = [
    { name: 'Direto', value: totalDirect, color: 'hsl(245, 82%, 58%)' },
    { name: 'Orgânico', value: totalOrganic, color: 'hsl(142, 76%, 36%)' },
    { name: 'Social', value: totalSocial, color: 'hsl(280, 80%, 60%)' },
    { name: 'Email', value: totalEmail, color: 'hsl(38, 92%, 50%)' },
    { name: 'Referral', value: totalReferral, color: 'hsl(0, 84%, 60%)' },
  ].filter(s => s.value > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">OMNISEEN</span>
            </div>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="container py-8">
        <h1 className="text-3xl font-display font-bold mb-8">
          Analytics {blog?.name && <span className="text-muted-foreground font-normal text-xl">— {blog.name}</span>}
        </h1>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="funnel">Funil</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
            <TabsTrigger value="sections">Seções</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Artigos Publicados</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{articles.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalArticleViews.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.floor(avgTime / 60)}:{(avgTime % 60).toString().padStart(2, '0')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Leitura</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgReadRate}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Posts */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Posts por Visualizações</CardTitle>
              <CardDescription>Artigos mais populares</CardDescription>
            </CardHeader>
            <CardContent>
              {articles.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={articles.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="title" 
                        width={150}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.length > 20 ? value.slice(0, 20) + '...' : value}
                      />
                      <Tooltip />
                      <Bar dataKey="views" fill="hsl(245, 82%, 58%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Traffic Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Visualizações ao Longo do Tempo</CardTitle>
              <CardDescription>Evolução do tráfego</CardDescription>
            </CardHeader>
            <CardContent>
              {traffic.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={traffic}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total_visits" 
                        stroke="hsl(245, 82%, 58%)" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Traffic Sources */}
            <h2 className="text-xl font-display font-semibold">Fontes de Tráfego</h2>
            
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Direto</p>
                      <p className="text-xl font-bold">{totalDirect.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Search className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Orgânico</p>
                      <p className="text-xl font-bold">{totalOrganic.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Share2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Social</p>
                      <p className="text-xl font-bold">{totalSocial.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Mail className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-xl font-bold">{totalEmail.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Link2 className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Referral</p>
                      <p className="text-xl font-bold">{totalReferral.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Fonte</CardTitle>
                </CardHeader>
                <CardContent>
                  {trafficSourcesData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={trafficSourcesData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {trafficSourcesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stacked Area */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendência por Fonte</CardTitle>
                </CardHeader>
                <CardContent>
                  {traffic.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={traffic}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit' })}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                          />
                          <Area type="monotone" dataKey="direct_visits" stackId="1" stroke="hsl(245, 82%, 58%)" fill="hsl(245, 82%, 58%)" fillOpacity={0.6} name="Direto" />
                          <Area type="monotone" dataKey="organic_visits" stackId="1" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%)" fillOpacity={0.6} name="Orgânico" />
                          <Area type="monotone" dataKey="social_visits" stackId="1" stroke="hsl(280, 80%, 60%)" fill="hsl(280, 80%, 60%)" fillOpacity={0.6} name="Social" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Nenhum dado disponível
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Posts Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Desempenho dos Artigos</CardTitle>
                <CardDescription>Métricas detalhadas por artigo</CardDescription>
              </CardHeader>
              <CardContent>
                {articles.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Artigo</th>
                          <th className="text-right py-3 px-4 font-medium">Views</th>
                          <th className="text-right py-3 px-4 font-medium">Tempo Médio</th>
                          <th className="text-right py-3 px-4 font-medium">Taxa de Leitura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.map((article) => (
                          <tr key={article.article_id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <span className="line-clamp-1">{article.title}</span>
                            </td>
                            <td className="text-right py-3 px-4">{article.views.toLocaleString()}</td>
                            <td className="text-right py-3 px-4">
                              {Math.floor(article.avg_time / 60)}:{(article.avg_time % 60).toString().padStart(2, '0')}
                            </td>
                            <td className="text-right py-3 px-4">{article.read_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Nenhum artigo com analytics ainda
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funnel">
            {blog && <FunnelChart blogId={blog.id} period={period} />}
          </TabsContent>

          <TabsContent value="heatmap">
            {blog && <ScrollHeatmap blogId={blog.id} period={period} />}
          </TabsContent>

          <TabsContent value="sections">
            {blog && <SectionTimeChart blogId={blog.id} period={period} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
