import { useState, useEffect } from 'react';
import { Globe, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DnsInstructionsCard } from './DnsInstructionsCard';

interface Blog {
  id: string;
  name: string;
  slug: string;
  tenant_id: string | null;
}

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onDomainAdded: () => void;
}

type DomainType = 'subdomain' | 'custom';

export function AddDomainDialog({
  open,
  onOpenChange,
  tenantId,
  onDomainAdded,
}: AddDomainDialogProps) {
  const [domainType, setDomainType] = useState<DomainType>('subdomain');
  const [subdomainName, setSubdomainName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [selectedBlogId, setSelectedBlogId] = useState('');
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDnsInstructions, setShowDnsInstructions] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<{
    domain: string;
    token: string;
    blogId: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchBlogs();
      resetForm();
    }
  }, [open, tenantId]);

  const fetchBlogs = async () => {
    const { data, error } = await supabase
      .from('blogs')
      .select('id, name, slug, tenant_id')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching blogs:', error);
      return;
    }

    setBlogs(data || []);
    if (data && data.length > 0) {
      setSelectedBlogId(data[0].id);
    }
  };

  const resetForm = () => {
    setDomainType('subdomain');
    setSubdomainName('');
    setCustomDomain('');
    setShowDnsInstructions(false);
    setCreatedDomain(null);
  };

  const validateSubdomain = (name: string): boolean => {
    const regex = /^[a-z0-9-]+$/;
    return regex.test(name) && name.length >= 3 && name.length <= 63;
  };

  const validateCustomDomain = (domain: string): boolean => {
    const regex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return regex.test(domain);
  };

  const generateVerificationToken = (): string => {
    return `omniseen_verify_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  };

  const handleSaveSubdomain = async () => {
    if (!validateSubdomain(subdomainName)) {
      toast.error('Nome inválido. Use apenas letras minúsculas, números e hífens (3-63 caracteres).');
      return;
    }

    if (!selectedBlogId) {
      toast.error('Selecione um blog');
      return;
    }

    setIsLoading(true);
    try {
      // NOVO PADRÃO: {nome}.app.omniseen.app
      const fullDomain = `${subdomainName.toLowerCase()}.app.omniseen.app`;

      // Check if domain already exists
      const { data: existing } = await supabase
        .from('tenant_domains')
        .select('id')
        .eq('domain', fullDomain)
        .maybeSingle();

      if (existing) {
        toast.error('Este subdomínio já está em uso');
        return;
      }

      // Get the blog to find tenant_id
      const selectedBlog = blogs.find(b => b.id === selectedBlogId);

      const { error } = await supabase.from('tenant_domains').insert({
        domain: fullDomain,
        domain_type: 'subdomain',
        tenant_id: tenantId,
        blog_id: selectedBlogId,
        status: 'active',
        is_primary: false,
      });

      if (error) throw error;

      // Also update the blog's platform_subdomain for backwards compatibility
      // NOVO PADRÃO: salva apenas o slug, sem sufixo
      await supabase
        .from('blogs')
        .update({ platform_subdomain: `${subdomainName.toLowerCase()}.app.omniseen.app` })
        .eq('id', selectedBlogId);

      toast.success('Subdomínio criado com sucesso!');
      onDomainAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating subdomain:', error);
      if (error.code === '23505') {
        toast.error('Este subdomínio já está em uso');
      } else {
        toast.error('Erro ao criar subdomínio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomDomain = async () => {
    const cleanDomain = customDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    if (!validateCustomDomain(cleanDomain)) {
      toast.error('Formato de domínio inválido. Ex: blog.empresa.com');
      return;
    }

    if (!selectedBlogId) {
      toast.error('Selecione um blog');
      return;
    }

    setIsLoading(true);
    try {
      // Check if domain already exists
      const { data: existing } = await supabase
        .from('tenant_domains')
        .select('id')
        .eq('domain', cleanDomain)
        .maybeSingle();

      if (existing) {
        toast.error('Este domínio já está cadastrado');
        return;
      }

      const verificationToken = generateVerificationToken();

      const { error } = await supabase.from('tenant_domains').insert({
        domain: cleanDomain,
        domain_type: 'custom',
        tenant_id: tenantId,
        blog_id: selectedBlogId,
        status: 'pending',
        verification_token: verificationToken,
        is_primary: false,
      });

      if (error) throw error;

      // Also update the blog's custom_domain for backwards compatibility
      await supabase
        .from('blogs')
        .update({ 
          custom_domain: cleanDomain,
          domain_verification_token: verificationToken,
          domain_verified: false
        })
        .eq('id', selectedBlogId);

      toast.success('Domínio cadastrado. Configure o DNS para ativá-lo.');
      setCreatedDomain({
        domain: cleanDomain,
        token: verificationToken,
        blogId: selectedBlogId,
      });
      setShowDnsInstructions(true);
    } catch (error: any) {
      console.error('Error creating custom domain:', error);
      if (error.code === '23505') {
        toast.error('Este domínio já está cadastrado');
      } else {
        toast.error('Erro ao cadastrar domínio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDomainVerified = () => {
    onDomainAdded();
    onOpenChange(false);
  };

  if (showDnsInstructions && createdDomain) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure seu Domínio</DialogTitle>
          </DialogHeader>
          <DnsInstructionsCard
            domain={createdDomain.domain}
            verificationToken={createdDomain.token}
            blogId={createdDomain.blogId}
            onVerified={handleDomainVerified}
          />
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => {
              onDomainAdded();
              onOpenChange(false);
            }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Domínio</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Domain Type Selection */}
          <RadioGroup
            value={domainType}
            onValueChange={(value) => setDomainType(value as DomainType)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="subdomain"
                id="subdomain"
                className="peer sr-only"
              />
              <Label
                htmlFor="subdomain"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Layers className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Subdomínio Omniseen</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  nome.app.omniseen.app
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="custom"
                id="custom"
                className="peer sr-only"
              />
              <Label
                htmlFor="custom"
                className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Globe className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Domínio Próprio</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  blog.empresa.com
                </span>
              </Label>
            </div>
          </RadioGroup>

          {/* Subdomain Input */}
          {domainType === 'subdomain' && (
            <div className="space-y-2">
              <Label htmlFor="subdomain-name">Nome do Subdomínio</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain-name"
                  placeholder="meublog"
                  value={subdomainName}
                  onChange={(e) => setSubdomainName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  .app.omniseen.app
                </span>
              </div>
              {subdomainName && (
                <p className="text-xs text-muted-foreground">
                  Preview: <strong className="text-foreground">{subdomainName}.app.omniseen.app</strong>
                </p>
              )}
            </div>
          )}

          {/* Custom Domain Input */}
          {domainType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-domain">Seu Domínio</Label>
              <Input
                id="custom-domain"
                placeholder="blog.empresa.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
              />
              <p className="text-xs text-muted-foreground">
                Não inclua http:// ou https://
              </p>
            </div>
          )}

          {/* Blog Selection */}
          <div className="space-y-2">
            <Label>Blog Vinculado</Label>
            <Select value={selectedBlogId} onValueChange={setSelectedBlogId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o blog" />
              </SelectTrigger>
              <SelectContent>
                {blogs.map((blog) => (
                  <SelectItem key={blog.id} value={blog.id}>
                    {blog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={domainType === 'subdomain' ? handleSaveSubdomain : handleSaveCustomDomain}
            disabled={isLoading || !selectedBlogId || (domainType === 'subdomain' ? !subdomainName : !customDomain)}
          >
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
