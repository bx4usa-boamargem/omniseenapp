import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useReferral } from "@/hooks/useReferral";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  DollarSign, 
  Copy, 
  Share2, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Gift
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Referrals() {
  const { referral, conversions, stats, loading, generateCode, getReferralLink } = useReferral();
  const { toast } = useToast();

  const handleGenerateCode = async () => {
    const code = await generateCode();
    if (code) {
      toast({
        title: "Código gerado!",
        description: `Seu código de indicação é: ${code}`,
      });
    }
  };

  const handleCopyLink = () => {
    const link = getReferralLink();
    if (link) {
      navigator.clipboard.writeText(link);
      toast({
        title: "Link copiado!",
        description: "O link de indicação foi copiado para a área de transferência.",
      });
    }
  };

  const handleShare = async () => {
    const link = getReferralLink();
    if (link && navigator.share) {
      try {
        await navigator.share({
          title: 'Omniseen - Automatize seu Blog',
          text: 'Crie artigos incríveis com inteligência artificial! Use meu link de indicação:',
          url: link,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'paid':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Pago</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Programa de Indicações</h1>
          <p className="text-muted-foreground">
            Indique amigos e ganhe <span className="font-semibold text-primary">40% de comissão</span> na primeira mensalidade de cada indicação.
          </p>
        </div>

        {/* Referral Link Card */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Seu Link de Indicação
            </CardTitle>
            <CardDescription>
              Compartilhe este link e ganhe comissão quando seus indicados assinarem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referral ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input 
                    value={getReferralLink()} 
                    readOnly 
                    className="bg-background font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopyLink} variant="outline" className="gap-2">
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                  <Button onClick={handleShare} className="gap-2">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem um código de indicação.
                </p>
                <Button onClick={handleGenerateCode} className="gap-2">
                  <Gift className="h-4 w-4" />
                  Gerar Meu Código
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cliques no Link
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClicks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversões
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendente
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(stats.pendingAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalPending} conversões
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pago
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.paidAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalPaid} conversões
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Indicações</CardTitle>
            <CardDescription>
              Acompanhe todas as suas conversões e status de pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Você ainda não tem indicações convertidas.</p>
                <p className="text-sm">Compartilhe seu link para começar a ganhar!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Plano</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor Assinatura</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sua Comissão</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversions.map((conversion) => (
                      <tr key={conversion.id} className="border-b last:border-0">
                        <td className="py-3 px-4">
                          {format(new Date(conversion.converted_at), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">
                            {conversion.subscription_plan || 'N/A'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {formatCurrency(conversion.subscription_amount_cents)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-primary">
                          {formatCurrency(conversion.commission_amount_cents)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(conversion.payment_due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(conversion.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Compartilhe seu link</h4>
                  <p className="text-sm text-muted-foreground">
                    Envie seu link de indicação para amigos, colegas ou nas redes sociais.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Eles assinam</h4>
                  <p className="text-sm text-muted-foreground">
                    Quando alguém assina através do seu link, a conversão é registrada automaticamente.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Você recebe 40%</h4>
                  <p className="text-sm text-muted-foreground">
                    Receba 40% da primeira mensalidade em até 15 dias úteis após a conversão.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
