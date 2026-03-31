import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  UserX, Share2, BookOpen, Plus, Pencil, Trash2, Save, Loader2,
  Facebook, Instagram, Linkedin, Twitter, Youtube
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GlossaryTerm {
  term: string;
  definition: string;
  url?: string;
}

interface BlogContentSettingsProps {
  blogId: string;
}

export function BlogContentSettings({ blogId }: BlogContentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Author
  const [hideAuthor, setHideAuthor] = useState(false);
  
  // Social
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialWhatsapp, setSocialWhatsapp] = useState("");
  
  // Glossary
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formTerm, setFormTerm] = useState("");
  const [formDefinition, setFormDefinition] = useState("");
  const [formUrl, setFormUrl] = useState("");

  useEffect(() => {
    loadSettings();
  }, [blogId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("blogs")
      .select("hide_author, social_facebook, social_instagram, social_linkedin, social_twitter, social_youtube, social_tiktok, social_whatsapp, glossary_terms")
      .eq("id", blogId)
      .single();
    
    if (data) {
      setHideAuthor(data.hide_author ?? false);
      setSocialFacebook(data.social_facebook || "");
      setSocialInstagram(data.social_instagram || "");
      setSocialLinkedin(data.social_linkedin || "");
      setSocialTwitter(data.social_twitter || "");
      setSocialYoutube(data.social_youtube || "");
      setSocialTiktok(data.social_tiktok || "");
      setSocialWhatsapp(data.social_whatsapp || "");
      setGlossaryTerms(Array.isArray(data.glossary_terms) ? (data.glossary_terms as unknown as GlossaryTerm[]) : []);
    }
    setLoading(false);
  };

  const saveAuthor = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("blogs")
      .update({ hide_author: hideAuthor } as any)
      .eq("id", blogId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva");
  };

  const saveSocial = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("blogs")
      .update({
        social_facebook: socialFacebook || null,
        social_instagram: socialInstagram || null,
        social_linkedin: socialLinkedin || null,
        social_twitter: socialTwitter || null,
        social_youtube: socialYoutube || null,
        social_tiktok: socialTiktok || null,
        social_whatsapp: socialWhatsapp || null,
      } as any)
      .eq("id", blogId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Redes sociais salvas");
  };

  const saveGlossary = async (terms: GlossaryTerm[]) => {
    const { error } = await supabase
      .from("blogs")
      .update({ glossary_terms: terms as any } as any)
      .eq("id", blogId);
    if (error) { toast.error("Erro ao salvar glossário"); return; }
    setGlossaryTerms(terms);
    toast.success("Glossário salvo");
  };

  const openAddTerm = () => {
    setEditingIndex(null);
    setFormTerm("");
    setFormDefinition("");
    setFormUrl("");
    setShowGlossaryForm(true);
  };

  const openEditTerm = (index: number) => {
    const t = glossaryTerms[index];
    setEditingIndex(index);
    setFormTerm(t.term);
    setFormDefinition(t.definition);
    setFormUrl(t.url || "");
    setShowGlossaryForm(true);
  };

  const handleSaveTerm = () => {
    if (!formTerm.trim() || !formDefinition.trim()) {
      toast.error("Termo e definição são obrigatórios");
      return;
    }
    const newTerm: GlossaryTerm = { term: formTerm.trim(), definition: formDefinition.trim(), url: formUrl.trim() || undefined };
    let updated: GlossaryTerm[];
    if (editingIndex !== null) {
      updated = [...glossaryTerms];
      updated[editingIndex] = newTerm;
    } else {
      updated = [...glossaryTerms, newTerm];
    }
    saveGlossary(updated);
    setShowGlossaryForm(false);
  };

  const handleDeleteTerm = (index: number) => {
    const updated = glossaryTerms.filter((_, i) => i !== index);
    saveGlossary(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const socialFields = [
    { label: "Facebook", placeholder: "https://facebook.com/suapagina", value: socialFacebook, set: setSocialFacebook, icon: Facebook },
    { label: "Instagram", placeholder: "https://instagram.com/seuperfil", value: socialInstagram, set: setSocialInstagram, icon: Instagram },
    { label: "LinkedIn", placeholder: "https://linkedin.com/company/empresa", value: socialLinkedin, set: setSocialLinkedin, icon: Linkedin },
    { label: "X (Twitter)", placeholder: "https://x.com/seuhandle", value: socialTwitter, set: setSocialTwitter, icon: Twitter },
    { label: "YouTube", placeholder: "https://youtube.com/@seucanal", value: socialYoutube, set: setSocialYoutube, icon: Youtube },
    { label: "TikTok", placeholder: "https://tiktok.com/@seuperfil", value: socialTiktok, set: setSocialTiktok, icon: Share2 },
    { label: "WhatsApp", placeholder: "https://wa.me/5511999999999", value: socialWhatsapp, set: setSocialWhatsapp, icon: Share2 },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Card A: Privacidade do Autor */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Privacidade do Autor</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Ocultar autor nos artigos</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Quando ativado, o nome e foto do autor não serão exibidos nas páginas públicas dos artigos.
              </p>
            </div>
            <Switch checked={hideAuthor} onCheckedChange={setHideAuthor} />
          </div>
          <Button onClick={saveAuthor} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Card B: Redes Sociais */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Redes Sociais</CardTitle>
              <CardDescription>Apenas as redes cadastradas aqui aparecerão nos botões de compartilhamento dos artigos.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {socialFields.map((field) => (
            <div key={field.label} className="space-y-1">
              <Label className="flex items-center gap-2 text-sm">
                <field.icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
              </Label>
              <Input
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
              />
            </div>
          ))}
          <Button onClick={saveSocial} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Redes Sociais
          </Button>
        </CardContent>
      </Card>

      {/* Card C: Glossário */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Glossário</CardTitle>
                <CardDescription>Termos que serão sublinhados automaticamente nos artigos com sua definição ao final.</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={openAddTerm}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar termo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {glossaryTerms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum termo cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {glossaryTerms.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">{item.term}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.definition}</p>
                    {item.url && <p className="text-xs text-primary mt-0.5 truncate">{item.url}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTerm(idx)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTerm(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Glossary Form Dialog */}
      <Dialog open={showGlossaryForm} onOpenChange={setShowGlossaryForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Editar Termo" : "Adicionar Termo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Termo *</Label>
              <Input value={formTerm} onChange={(e) => setFormTerm(e.target.value)} placeholder="Ex: SEO" />
            </div>
            <div className="space-y-1">
              <Label>Definição *</Label>
              <Textarea value={formDefinition} onChange={(e) => setFormDefinition(e.target.value)} placeholder="Explique o termo..." rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Link externo (opcional)</Label>
              <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
            <Button className="w-full" onClick={handleSaveTerm}>
              {editingIndex !== null ? "Salvar Alteração" : "Adicionar Termo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
