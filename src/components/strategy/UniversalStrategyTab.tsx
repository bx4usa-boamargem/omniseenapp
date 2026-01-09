import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Building2, Users, Package, Target, X, Plus, Sparkles, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClientStrategy {
  id?: string;
  blog_id: string;
  empresa_nome: string;
  tipo_negocio: string;
  regiao_atuacao: string;
  tipo_publico: string;
  nivel_consciencia: string;
  nivel_conhecimento: string;
  dor_principal: string;
  desejo_principal: string;
  o_que_oferece: string;
  principais_beneficios: string[];
  diferenciais: string[];
  acao_desejada: string;
  canal_cta: string;
}

interface UniversalStrategyTabProps {
  blogId: string;
}

const TIPO_NEGOCIO_OPTIONS = [
  { value: "servico", label: "Serviço" },
  { value: "produto", label: "Produto" },
  { value: "saas", label: "SaaS" },
  { value: "local_business", label: "Negócio Local" },
  { value: "profissional_liberal", label: "Profissional Liberal" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "consultoria", label: "Consultoria" },
  { value: "agencia", label: "Agência" },
];

const TIPO_PUBLICO_OPTIONS = [
  { value: "B2B", label: "B2B (Empresas)" },
  { value: "B2C", label: "B2C (Consumidor Final)" },
  { value: "misto", label: "Misto (B2B e B2C)" },
];

const NIVEL_CONSCIENCIA_OPTIONS = [
  { value: "inconsciente", label: "Inconsciente - Não sabe que tem o problema" },
  { value: "consciente_problema", label: "Consciente do Problema - Sabe que tem o problema" },
  { value: "consciente_solucao", label: "Consciente da Solução - Busca soluções" },
  { value: "pronto_comprar", label: "Pronto para Comprar - Decidido a agir" },
];

const NIVEL_CONHECIMENTO_OPTIONS = [
  { value: "iniciante", label: "Iniciante - Pouco conhecimento técnico" },
  { value: "intermediario", label: "Intermediário - Conhecimento moderado" },
  { value: "avancado", label: "Avançado - Alto conhecimento técnico" },
];

const CANAL_CTA_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "formulario", label: "Formulário" },
  { value: "link", label: "Link" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "agendamento", label: "Agendamento Online" },
];

export function UniversalStrategyTab({ blogId }: UniversalStrategyTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [strategy, setStrategy] = useState<ClientStrategy>({
    blog_id: blogId,
    empresa_nome: "",
    tipo_negocio: "",
    regiao_atuacao: "",
    tipo_publico: "",
    nivel_consciencia: "",
    nivel_conhecimento: "",
    dor_principal: "",
    desejo_principal: "",
    o_que_oferece: "",
    principais_beneficios: [],
    diferenciais: [],
    acao_desejada: "",
    canal_cta: "",
  });

  // Input states for array fields
  const [beneficioInput, setBeneficioInput] = useState("");
  const [diferencialInput, setDiferencialInput] = useState("");

  useEffect(() => {
    fetchStrategy();
  }, [blogId]);

  const fetchStrategy = async () => {
    try {
      const { data, error } = await supabase
        .from("client_strategy")
        .select("*")
        .eq("blog_id", blogId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setStrategy({
          id: data.id,
          blog_id: data.blog_id,
          empresa_nome: data.empresa_nome || "",
          tipo_negocio: data.tipo_negocio || "",
          regiao_atuacao: data.regiao_atuacao || "",
          tipo_publico: data.tipo_publico || "",
          nivel_consciencia: data.nivel_consciencia || "",
          nivel_conhecimento: data.nivel_conhecimento || "",
          dor_principal: data.dor_principal || "",
          desejo_principal: data.desejo_principal || "",
          o_que_oferece: data.o_que_oferece || "",
          principais_beneficios: data.principais_beneficios || [],
          diferenciais: data.diferenciais || [],
          acao_desejada: data.acao_desejada || "",
          canal_cta: data.canal_cta || "",
        });
        // Marcar como configurado se tem id e empresa_nome
        if (data.id && data.empresa_nome) {
          setIsConfigured(true);
        }
      }
    } catch (error) {
      console.error("Error fetching strategy:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (strategy.id) {
        // Update existing
        const { error } = await supabase
          .from("client_strategy")
          .update({
            empresa_nome: strategy.empresa_nome,
            tipo_negocio: strategy.tipo_negocio,
            regiao_atuacao: strategy.regiao_atuacao,
            tipo_publico: strategy.tipo_publico,
            nivel_consciencia: strategy.nivel_consciencia,
            nivel_conhecimento: strategy.nivel_conhecimento,
            dor_principal: strategy.dor_principal,
            desejo_principal: strategy.desejo_principal,
            o_que_oferece: strategy.o_que_oferece,
            principais_beneficios: strategy.principais_beneficios,
            diferenciais: strategy.diferenciais,
            acao_desejada: strategy.acao_desejada,
            canal_cta: strategy.canal_cta,
          })
          .eq("id", strategy.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("client_strategy")
          .insert({
            blog_id: blogId,
            empresa_nome: strategy.empresa_nome,
            tipo_negocio: strategy.tipo_negocio,
            regiao_atuacao: strategy.regiao_atuacao,
            tipo_publico: strategy.tipo_publico,
            nivel_consciencia: strategy.nivel_consciencia,
            nivel_conhecimento: strategy.nivel_conhecimento,
            dor_principal: strategy.dor_principal,
            desejo_principal: strategy.desejo_principal,
            o_que_oferece: strategy.o_que_oferece,
            principais_beneficios: strategy.principais_beneficios,
            diferenciais: strategy.diferenciais,
            acao_desejada: strategy.acao_desejada,
            canal_cta: strategy.canal_cta,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setStrategy(prev => ({ ...prev, id: data.id }));
        }
      }

      setIsConfigured(true);
      toast.success("Estratégia salva! Seu blog está pronto para gerar artigos.");
    } catch (error: any) {
      console.error("Save strategy error:", error);
      toast.error(error?.message || "Erro ao salvar estratégia");
    } finally {
      setSaving(false);
    }
  };

  const addBeneficio = () => {
    const trimmed = beneficioInput.trim();
    if (trimmed && !strategy.principais_beneficios.includes(trimmed)) {
      setStrategy(prev => ({
        ...prev,
        principais_beneficios: [...prev.principais_beneficios, trimmed]
      }));
      setBeneficioInput("");
    }
  };

  const removeBeneficio = (beneficio: string) => {
    setStrategy(prev => ({
      ...prev,
      principais_beneficios: prev.principais_beneficios.filter(b => b !== beneficio)
    }));
  };

  const addDiferencial = () => {
    const trimmed = diferencialInput.trim();
    if (trimmed && !strategy.diferenciais.includes(trimmed)) {
      setStrategy(prev => ({
        ...prev,
        diferenciais: [...prev.diferenciais, trimmed]
      }));
      setDiferencialInput("");
    }
  };

  const removeDiferencial = (diferencial: string) => {
    setStrategy(prev => ({
      ...prev,
      diferenciais: prev.diferenciais.filter(d => d !== diferencial)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Blog Configurado */}
      {isConfigured && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 font-medium">
            Blog configurado! Você pode gerar artigos ilimitados.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h3 className="font-semibold">Estratégia Universal de Conteúdo</h3>
          <p className="text-sm text-muted-foreground">
            Configure sua estratégia para que a IA gere conteúdo personalizado e de alta qualidade.
          </p>
        </div>
      </div>

      {/* Identidade do Negócio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Identidade do Negócio
          </CardTitle>
          <CardDescription>
            Informações básicas sobre sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empresa_nome">Nome da Empresa</Label>
              <Input
                id="empresa_nome"
                placeholder="Ex: TechSolutions"
                value={strategy.empresa_nome}
                onChange={(e) => setStrategy(prev => ({ ...prev, empresa_nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_negocio">Tipo de Negócio</Label>
              <Select
                value={strategy.tipo_negocio}
                onValueChange={(v) => setStrategy(prev => ({ ...prev, tipo_negocio: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_NEGOCIO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="regiao_atuacao">Região de Atuação</Label>
            <Input
              id="regiao_atuacao"
              placeholder="Ex: Brasil, São Paulo, América Latina"
              value={strategy.regiao_atuacao}
              onChange={(e) => setStrategy(prev => ({ ...prev, regiao_atuacao: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Público-Alvo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Público-Alvo
          </CardTitle>
          <CardDescription>
            Quem é seu cliente ideal?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_publico">Tipo de Público</Label>
              <Select
                value={strategy.tipo_publico}
                onValueChange={(v) => setStrategy(prev => ({ ...prev, tipo_publico: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_PUBLICO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nivel_consciencia">Nível de Consciência</Label>
              <Select
                value={strategy.nivel_consciencia}
                onValueChange={(v) => setStrategy(prev => ({ ...prev, nivel_consciencia: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {NIVEL_CONSCIENCIA_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nivel_conhecimento">Nível de Conhecimento</Label>
              <Select
                value={strategy.nivel_conhecimento}
                onValueChange={(v) => setStrategy(prev => ({ ...prev, nivel_conhecimento: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {NIVEL_CONHECIMENTO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dor_principal">Dor Principal</Label>
            <Textarea
              id="dor_principal"
              placeholder="Qual é o principal problema que seu cliente enfrenta? Ex: Perda de clientes por falta de atendimento rápido"
              value={strategy.dor_principal}
              onChange={(e) => setStrategy(prev => ({ ...prev, dor_principal: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desejo_principal">Desejo Principal</Label>
            <Textarea
              id="desejo_principal"
              placeholder="O que seu cliente mais deseja alcançar? Ex: Ter mais tempo livre e aumentar vendas"
              value={strategy.desejo_principal}
              onChange={(e) => setStrategy(prev => ({ ...prev, desejo_principal: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Oferta/Solução */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Oferta / Solução
          </CardTitle>
          <CardDescription>
            O que você oferece ao mercado?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="o_que_oferece">O que você oferece?</Label>
            <Textarea
              id="o_que_oferece"
              placeholder="Descreva seu produto ou serviço de forma clara. Ex: Plataforma de atendimento automatizado via WhatsApp"
              value={strategy.o_que_oferece}
              onChange={(e) => setStrategy(prev => ({ ...prev, o_que_oferece: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Principais Benefícios</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Atendimento 24/7"
                value={beneficioInput}
                onChange={(e) => setBeneficioInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBeneficio())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addBeneficio}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {strategy.principais_beneficios.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {strategy.principais_beneficios.map((beneficio) => (
                  <Badge key={beneficio} variant="secondary" className="gap-1">
                    {beneficio}
                    <button
                      type="button"
                      onClick={() => removeBeneficio(beneficio)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Diferenciais Competitivos</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Suporte humano + IA"
                value={diferencialInput}
                onChange={(e) => setDiferencialInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDiferencial())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addDiferencial}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {strategy.diferenciais.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {strategy.diferenciais.map((diferencial) => (
                  <Badge key={diferencial} variant="secondary" className="gap-1">
                    {diferencial}
                    <button
                      type="button"
                      onClick={() => removeDiferencial(diferencial)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Conversão
          </CardTitle>
          <CardDescription>
            Qual ação você quer que o leitor tome?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acao_desejada">Ação Desejada</Label>
              <Input
                id="acao_desejada"
                placeholder="Ex: Solicitar orçamento, Agendar conversa, Testar grátis"
                value={strategy.acao_desejada}
                onChange={(e) => setStrategy(prev => ({ ...prev, acao_desejada: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canal_cta">Canal do CTA</Label>
              <Select
                value={strategy.canal_cta}
                onValueChange={(v) => setStrategy(prev => ({ ...prev, canal_cta: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CANAL_CTA_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Estratégia
        </Button>
      </div>
    </div>
  );
}
