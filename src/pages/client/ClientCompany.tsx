import { useEffect, useState } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const BUSINESS_TYPES = [
  { value: 'servicos', label: 'Serviços' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'beleza', label: 'Beleza e Estética' },
  { value: 'construcao', label: 'Construção' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
];

export default function ClientCompany() {
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [cityState, setCityState] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [whatYouDo, setWhatYouDo] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [differentiator, setDifferentiator] = useState('');

  useEffect(() => {
    if (!blog?.id) return;

    const fetchProfile = async () => {
      setLoading(true);

      try {
        const { data: profile } = await supabase
          .from('business_profile')
          .select('*')
          .eq('blog_id', blog.id)
          .maybeSingle();

        if (profile) {
          setCompanyName(profile.company_name || '');
          setCityState(profile.country || '');
          setBusinessType(profile.niche || '');
          setWhatYouDo(profile.long_description || '');
          setTargetAudience(profile.target_audience || '');
          // Extract differentiator from brand_keywords if available
          if (profile.brand_keywords && profile.brand_keywords.length > 0) {
            setDifferentiator(profile.brand_keywords.join(', '));
          }
        }

        // Also check blog name
        if (blog.name) {
          setCompanyName(blog.name);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [blog?.id, blog?.name]);

  const handleSave = async () => {
    if (!blog?.id) return;
    setSaving(true);
    setSaved(false);

    try {
      // Update business profile
      const { error: profileError } = await supabase
        .from('business_profile')
        .upsert({
          blog_id: blog.id,
          company_name: companyName,
          country: cityState,
          niche: businessType,
          long_description: whatYouDo,
          target_audience: targetAudience,
          brand_keywords: differentiator ? differentiator.split(',').map(k => k.trim()) : [],
        }, { onConflict: 'blog_id' });

      if (profileError) throw profileError;

      // Update blog name
      const { error: blogError } = await supabase
        .from('blogs')
        .update({ name: companyName })
        .eq('id', blog.id);

      if (blogError) throw blogError;

      setSaved(true);
      toast.success('Dados salvos!', {
        description: 'A IA vai usar essas informações para criar seus artigos.',
      });

      // Reset saved state after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          Minha Empresa
        </h1>
        <p className="text-muted-foreground mt-1">
          Conte sobre seu negócio para a IA criar artigos perfeitos
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do seu negócio</CardTitle>
          <CardDescription>
            Essas informações ajudam a IA a entender sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              placeholder="Ex: Limpeza Express"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          {/* Full Address */}
          <div className="space-y-2">
            <Label htmlFor="fullAddress">Endereço completo</Label>
            <Input
              id="fullAddress"
              placeholder="Ex: Rua das Flores, 123 - Centro"
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
            />
          </div>

          {/* City / State */}
          <div className="space-y-2">
            <Label htmlFor="cityState">Cidade / Estado</Label>
            <Input
              id="cityState"
              placeholder="Ex: São Paulo, SP"
              value={cityState}
              onChange={(e) => setCityState(e.target.value)}
            />
          </div>

          {/* Business Type */}
          <div className="space-y-2">
            <Label htmlFor="businessType">Tipo de negócio</Label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* What You Do */}
          <div className="space-y-2">
            <Label htmlFor="whatYouDo">O que você faz</Label>
            <Textarea
              id="whatYouDo"
              placeholder="Ex: Oferecemos serviços de limpeza residencial e comercial, incluindo limpeza pós-obra, higienização de estofados e limpeza de vidros."
              value={whatYouDo}
              onChange={(e) => setWhatYouDo(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Para quem você atende</Label>
            <Input
              id="targetAudience"
              placeholder="Ex: Famílias, condomínios e pequenas empresas"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>

          {/* Differentiator */}
          <div className="space-y-2">
            <Label htmlFor="differentiator">O que te diferencia</Label>
            <Textarea
              id="differentiator"
              placeholder="Ex: Atendimento 24h, produtos ecológicos, equipe treinada, garantia de satisfação"
              value={differentiator}
              onChange={(e) => setDifferentiator(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          size="lg" 
          className="gap-2"
          variant={saved ? "outline" : "default"}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">💡 Por que isso é importante?</h3>
          <p className="text-sm text-muted-foreground">
            A IA usa essas informações para criar artigos que falam diretamente 
            com seus clientes. Quanto mais detalhes você fornecer, melhores serão os artigos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
