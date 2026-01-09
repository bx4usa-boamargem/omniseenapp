import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, GripVertical, X, Check, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionHelper } from "./SectionHelper";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

interface CategoriesManagerProps {
  blogId: string;
  onCategoriesChange?: (categories: Category[]) => void;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoriesManager({ blogId, onCategoriesChange }: CategoriesManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
  });

  useEffect(() => {
    fetchCategories();
  }, [blogId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_categories")
        .select("*")
        .eq("blog_id", blogId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      onCategoriesChange?.(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const slug = formData.slug || generateSlug(formData.name);
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.sort_order)) 
        : 0;

      const { data, error } = await supabase
        .from("blog_categories")
        .insert({
          blog_id: blogId,
          name: formData.name,
          slug,
          description: formData.description || null,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories([...categories, data]);
      onCategoriesChange?.([...categories, data]);
      setFormData({ name: "", slug: "", description: "" });
      setShowAddForm(false);
      toast.success("Categoria adicionada");
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Já existe uma categoria com esse slug");
      } else {
        toast.error("Erro ao adicionar categoria");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!formData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const slug = formData.slug || generateSlug(formData.name);

      const { error } = await supabase
        .from("blog_categories")
        .update({
          name: formData.name,
          slug,
          description: formData.description || null,
        })
        .eq("id", id);

      if (error) throw error;

      const updated = categories.map(c => 
        c.id === id ? { ...c, name: formData.name, slug, description: formData.description } : c
      );
      setCategories(updated);
      onCategoriesChange?.(updated);
      setEditingId(null);
      setFormData({ name: "", slug: "", description: "" });
      toast.success("Categoria atualizada");
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Já existe uma categoria com esse slug");
      } else {
        toast.error("Erro ao atualizar categoria");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("blog_categories")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      const updated = categories.filter(c => c.id !== deleteId);
      setCategories(updated);
      onCategoriesChange?.(updated);
      setDeleteId(null);
      toast.success("Categoria excluída");
    } catch (error) {
      toast.error("Erro ao excluir categoria");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ name: "", slug: "", description: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <SectionHelper
          title="Categorias do Blog"
          description="Categorias ajudam a organizar seu conteúdo e facilitam a navegação dos leitores. Elas também melhoram o SEO do seu blog ao criar páginas temáticas."
          action="Crie categorias que representem os principais temas do seu negócio. Exemplo: 'Marketing Digital', 'Vendas', 'Dicas'."
        />
        {!showAddForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="space-y-2">
            <Label>Nome da categoria</Label>
            <Input
              value={formData.name}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                });
              }}
              placeholder="Ex: Marketing Digital"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug (URL)</Label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="marketing-digital"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve descrição da categoria..."
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddCategory} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setFormData({ name: "", slug: "", description: "" });
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma categoria criada ainda.
          </p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className={cn(
                "flex items-center gap-3 p-3 border rounded-lg transition-colors",
                editingId === category.id ? "bg-muted/50" : "hover:bg-muted/30"
              )}
            >
              {editingId === category.id ? (
                <div className="flex-1 space-y-3">
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    placeholder="Nome da categoria"
                  />
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="Slug"
                  />
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição (opcional)"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleUpdateCategory(category.id)} 
                      disabled={saving} 
                      size="sm"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Salvar
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEditing}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1">
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">/{category.slug}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditing(category)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(category.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os artigos desta categoria não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
