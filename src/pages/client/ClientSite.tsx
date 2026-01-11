import { useEffect, useState } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, ExternalLink, Plus, Trash2, Loader2, Save, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContactButton {
  id?: string;
  button_type: 'whatsapp' | 'phone' | 'instagram' | 'website' | 'link';
  label: string;
  value: string;
}

const BUTTON_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp', placeholder: '11999999999' },
  { value: 'phone', label: 'Telefone', placeholder: '1133334444' },
  { value: 'instagram', label: 'Instagram', placeholder: '@seuusuario' },
  { value: 'website', label: 'Site', placeholder: 'https://seusite.com' },
  { value: 'link', label: 'Link', placeholder: 'https://...' },
];

const LAYOUT_OPTIONS = [
  { id: 'minimal', name: 'Minimalista', description: 'Limpo e simples' },
  { id: 'modern', name: 'Moderno', description: 'Visual contemporâneo' },
  { id: 'corporate', name: 'Profissional', description: 'Formal e confiável' },
];

export default function ClientSite() {
  const { blog, refetch } = useBlog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [layout, setLayout] = useState('modern');
  const [logoUrl, setLogoUrl] = useState('');
  const [contactButtons, setContactButtons] = useState<ContactButton[]>([]);

  useEffect(() => {
    if (!blog) return;

    setCompanyName(blog.name || '');
    setPrimaryColor(blog.primary_color || '#6366f1');
    setSecondaryColor(blog.secondary_color || '#8b5cf6');
    setLayout('modern'); // Default layout
    setLogoUrl(blog.logo_url || '');
    setCity('');

    // Fetch contact buttons
    const fetchButtons = async () => {
      const { data } = await supabase
        .from('blog_contact_buttons')
        .select('*')
        .eq('blog_id', blog.id)
        .order('sort_order');

      if (data) {
        setContactButtons(data.map(b => ({
          id: b.id,
          button_type: b.button_type as ContactButton['button_type'],
          label: b.label || '',
          value: b.value,
        })));
      }
      setLoading(false);
    };

    fetchButtons();
  }, [blog]);

  const handleSave = async () => {
    if (!blog?.id) return;
    setSaving(true);

    try {
      // Update blog info
      const { error: blogError } = await supabase
        .from('blogs')
        .update({
          name: companyName,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
        })
        .eq('id', blog.id);

      if (blogError) throw blogError;

      // Delete existing buttons
      await supabase
        .from('blog_contact_buttons')
        .delete()
        .eq('blog_id', blog.id);

      // Insert new buttons
      if (contactButtons.length > 0) {
        const buttonsToInsert = contactButtons.map((btn, index) => ({
          blog_id: blog.id,
          button_type: btn.button_type,
          label: btn.label,
          value: btn.value,
          sort_order: index,
        }));

        const { error: buttonsError } = await supabase
          .from('blog_contact_buttons')
          .insert(buttonsToInsert);

        if (buttonsError) throw buttonsError;
      }

      await refetch();
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const addContactButton = () => {
    setContactButtons([...contactButtons, { button_type: 'whatsapp', label: '', value: '' }]);
  };

  const removeContactButton = (index: number) => {
    setContactButtons(contactButtons.filter((_, i) => i !== index));
  };

  const updateContactButton = (index: number, field: keyof ContactButton, value: string) => {
    const updated = [...contactButtons];
    updated[index] = { ...updated[index], [field]: value };
    setContactButtons(updated);
  };

  const openSite = () => {
    if (blog?.slug) {
      window.open(`https://omniseen.app/${blog.slug}`, '_blank');
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Meu Mini-Site
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure a aparência do seu blog
          </p>
        </div>
        <Button onClick={openSite} variant="outline" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Ver meu site
        </Button>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>Informações básicas do seu negócio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-lg border" />
              ) : (
                <div className="h-16 w-16 bg-muted rounded-lg border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <Input
                placeholder="URL da logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input
              placeholder="Ex: Limpeza Express"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              placeholder="Ex: São Paulo, SP"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Layout Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>Escolha o visual do seu site</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setLayout(option.id)}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  layout === option.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="font-semibold">{option.name}</div>
                <div className="text-sm text-muted-foreground">{option.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Cores</CardTitle>
          <CardDescription>Personalize as cores do seu site</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Botões de Contato</CardTitle>
          <CardDescription>Adicione formas de seus clientes entrarem em contato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contactButtons.map((button, index) => (
            <div key={index} className="flex items-center gap-3 p-4 border rounded-lg">
              <select
                value={button.button_type}
                onChange={(e) => updateContactButton(index, 'button_type', e.target.value)}
                className="h-10 rounded-md border px-3 text-sm bg-background"
              >
                {BUTTON_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <Input
                placeholder={BUTTON_TYPES.find(t => t.value === button.button_type)?.placeholder}
                value={button.value}
                onChange={(e) => updateContactButton(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeContactButton(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <Button variant="outline" onClick={addContactButton} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Adicionar botão
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
