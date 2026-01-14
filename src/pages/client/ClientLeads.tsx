import { useState, useEffect } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users, 
  Loader2, 
  Search, 
  MessageCircle, 
  Phone, 
  Mail, 
  Calendar,
  TrendingUp,
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  interest_summary: string | null;
  lead_score: number | null;
  article_title: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  webhook_sent_at: string | null;
  created_at: string;
  conversation_id: string | null;
}

interface Conversation {
  id: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tokens_used: number;
  created_at: string;
}

export default function ClientLeads() {
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    avgScore: 0,
  });

  useEffect(() => {
    if (!blog?.id) return;

    const fetchLeads = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('brand_agent_leads')
          .select('*')
          .eq('blog_id', blog.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setLeads(data || []);

        // Calculate stats
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const weekStart = new Date(now.setDate(now.getDate() - 7));

        const todayLeads = (data || []).filter(l => new Date(l.created_at) >= todayStart);
        const weekLeads = (data || []).filter(l => new Date(l.created_at) >= weekStart);
        const avgScore = (data || []).reduce((sum, l) => sum + (l.lead_score || 0), 0) / (data?.length || 1);

        setStats({
          total: data?.length || 0,
          today: todayLeads.length,
          thisWeek: weekLeads.length,
          avgScore: Math.round(avgScore),
        });
      } catch (err) {
        console.error('Error fetching leads:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [blog?.id]);

  const fetchConversation = async (conversationId: string) => {
    setLoadingConversation(true);
    try {
      const { data, error } = await supabase
        .from('brand_agent_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      
      // Parse messages if they're a string
      const messages = typeof data.messages === 'string' 
        ? JSON.parse(data.messages) 
        : data.messages;
      
      setConversation({ ...data, messages });
    } catch (err) {
      console.error('Error fetching conversation:', err);
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleViewConversation = (lead: Lead) => {
    setSelectedLead(lead);
    if (lead.conversation_id) {
      fetchConversation(lead.conversation_id);
    }
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'WhatsApp', 'Interesse', 'Score', 'Artigo', 'UTM Source', 'Data'];
    const rows = leads.map(lead => [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.whatsapp || '',
      lead.interest_summary || '',
      lead.lead_score?.toString() || '',
      lead.article_title || '',
      lead.utm_source || '',
      format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm'),
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const filteredLeads = leads.filter(lead => {
    const search = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.phone?.includes(search) ||
      lead.whatsapp?.includes(search) ||
      lead.interest_summary?.toLowerCase().includes(search)
    );
  });

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
          <Users className="h-8 w-8 text-primary" />
          Leads Capturados
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Leads gerados pelo seu Agente Comercial de IA
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/10">
                <Users className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-sm text-muted-foreground">Leads Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-sm text-muted-foreground">Esta Semana</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10">
                <MessageCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgScore}%</p>
                <p className="text-sm text-muted-foreground">Score Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Leads</CardTitle>
              <CardDescription>
                {filteredLeads.length} leads encontrados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={exportToCSV}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {searchTerm ? 'Nenhum lead encontrado' : 'Nenhum lead capturado ainda'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? 'Tente outro termo de busca' : 'Ative o Agente Comercial para começar a capturar leads'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Interesse</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Webhook</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.name && (
                            <p className="font-medium">{lead.name}</p>
                          )}
                          {lead.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </p>
                          )}
                          {(lead.phone || lead.whatsapp) && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.whatsapp || lead.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-[200px] truncate">
                          {lead.interest_summary || '-'}
                        </p>
                        {lead.article_title && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            Via: {lead.article_title}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getScoreColor(lead.lead_score)}>
                          {lead.lead_score || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.utm_source ? (
                          <Badge variant="outline" className="text-xs">
                            {lead.utm_source}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Direto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.webhook_sent_at ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewConversation(lead)}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => { setSelectedLead(null); setConversation(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversa com {selectedLead?.name || 'Visitante'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-muted/30 rounded-lg">
            {loadingConversation ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conversation?.messages?.length ? (
              conversation.messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white dark:bg-gray-800 border'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Conversa não disponível
              </p>
            )}
          </div>

          {selectedLead?.whatsapp && (
            <div className="pt-4 border-t">
              <Button asChild className="w-full gap-2">
                <a 
                  href={`https://wa.me/${selectedLead.whatsapp}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Continuar no WhatsApp
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
