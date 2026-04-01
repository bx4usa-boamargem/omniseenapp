import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Instagram,
  Linkedin,
  Download,
  FileCheck,
  ImageIcon,
  Wand2,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  X,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArticleTranslationPanel } from "./ArticleTranslationPanel";
import { QualityGatePanel } from "./QualityGatePanel";

interface ArticleSidebarProps {
  // Article ID for translations
  articleId?: string;
  
  // Status
  status: string;
  scheduledAt: Date | null;
  
  // Article data
  category: string;
  onCategoryChange: (value: string) => void;
  slug: string;
  onSlugChange: (value: string) => void;
  tags: string[];
  onTagsChange: (value: string[]) => void;
  
  // Featured image
  featuredImage: string | null;
  featuredImageAlt: string;
  onFeaturedImageAltChange: (value: string) => void;
  onImageUpload: (file: File) => void;
  onImageGenerate: () => void;
  onImageRemove: () => void;
  isUploadingImage: boolean;
  isGeneratingImage: boolean;
  
  // SEO
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  keywords: string[];
  keywordInput: string;
  onKeywordInputChange: (value: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (keyword: string) => void;
  
  // Approval
  isApproved: boolean;
  approvedAt: Date | null;
  onApprove: () => void;
  onRemoveApproval: () => void;
  
  // Actions
  onRewriteWithAI: () => void;
  onOpenSocialShare: () => void;
  onDownloadAssets: () => void;
  onRequestReview: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  
  // Loading states
  disabled?: boolean;
  
  // Quality Gate
  qualityGateStatus?: string | null;
  qualityGateAttempts?: number | null;
  qualityGateResult?: any;
  onQualityGateRefresh?: () => void;
}

export function ArticleSidebar({
  articleId,
  status,
  scheduledAt,
  category,
  onCategoryChange,
  slug,
  onSlugChange,
  tags,
  onTagsChange,
  featuredImage,
  featuredImageAlt,
  onFeaturedImageAltChange,
  onImageUpload,
  onImageGenerate,
  onImageRemove,
  isUploadingImage,
  isGeneratingImage,
  metaDescription,
  onMetaDescriptionChange,
  keywords,
  keywordInput,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  isApproved,
  approvedAt,
  onApprove,
  onRemoveApproval,
  onRewriteWithAI,
  onOpenSocialShare,
  onDownloadAssets,
  onRequestReview,
  onSchedule,
  onDelete,
  disabled,
  qualityGateStatus,
  qualityGateAttempts,
  qualityGateResult,
  onQualityGateRefresh,
}: ArticleSidebarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [tagInput, setTagInput] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(tags.filter(t => t !== tag));
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Produtividade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onRewriteWithAI}
              disabled={disabled}
            >
              <RefreshCw className="h-4 w-4" />
              Reescrever seção
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onOpenSocialShare}
              disabled={disabled}
            >
              <Instagram className="h-4 w-4" />
              Instagram
              <Badge variant="secondary" className="ml-auto text-xs">Novo</Badge>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onOpenSocialShare}
              disabled={disabled}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
              <Badge variant="secondary" className="ml-auto text-xs">Novo</Badge>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onDownloadAssets}
              disabled={disabled || !featuredImage}
            >
              <Download className="h-4 w-4" />
              Baixar imagens
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onRequestReview}
              disabled={disabled}
            >
              <FileCheck className="h-4 w-4" />
              Revisão cliente
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Article Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Dados do Artigo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Categoria</Label>
              <Input
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                placeholder="Ex: Marketing Digital"
                disabled={disabled}
              />
            </div>

            {/* Approval Status */}
            {isApproved ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Post aprovado!</span>
                </div>
                {approvedAt && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    {format(approvedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-xs text-green-700 hover:text-green-900"
                  onClick={onRemoveApproval}
                >
                  Retirar aprovação
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={onApprove}
                disabled={disabled}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Aprovar conteúdo
              </Button>
            )}

            {/* Schedule */}
            {status === "scheduled" && scheduledAt ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">Agendado</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  {format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={onSchedule}
                disabled={disabled}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Agendar publicação
              </Button>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="url-do-artigo"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Tags (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  placeholder="Adicionar tag"
                  disabled={disabled}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={disabled}
                >
                  +
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} disabled={disabled}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Featured Image */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Imagem destacada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {featuredImage ? (
              <div className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={featuredImage}
                    alt={featuredImageAlt || "Cover"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage || isGeneratingImage}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={onImageGenerate}
                    disabled={isUploadingImage || isGeneratingImage}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onImageRemove}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                  <div className="text-center text-muted-foreground p-4">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sem imagem</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage || isGeneratingImage}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3 w-3" />
                    )}
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={onImageGenerate}
                    disabled={isUploadingImage || isGeneratingImage}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1 h-3 w-3" />
                    )}
                    Gerar
                  </Button>
                </div>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="space-y-1">
              <Label className="text-xs">
                Texto alt ({featuredImageAlt.length}/200)
              </Label>
              <Input
                value={featuredImageAlt}
                onChange={(e) => onFeaturedImageAltChange(e.target.value)}
                placeholder="Descrição da imagem para SEO"
                maxLength={200}
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* SEO */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">
                Meta Description ({metaDescription.length}/160)
              </Label>
              <Textarea
                value={metaDescription}
                onChange={(e) => onMetaDescriptionChange(e.target.value)}
                placeholder="Descrição para mecanismos de busca..."
                maxLength={160}
                disabled={disabled}
                className="min-h-[60px] text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Palavras-chave</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => onKeywordInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddKeyword())}
                  placeholder="Adicionar"
                  disabled={disabled || keywords.length >= 5}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddKeyword}
                  disabled={disabled || keywords.length >= 5}
                >
                  +
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                      {kw}
                      <button onClick={() => onRemoveKeyword(kw)} disabled={disabled}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Até 5 palavras-chave</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Translations */}
        <ArticleTranslationPanel articleId={articleId} isDisabled={disabled} />

        <Separator />

        {/* Quality Gate */}
        {articleId && onQualityGateRefresh && (
          <QualityGatePanel
            articleId={articleId}
            qualityGateStatus={qualityGateStatus || null}
            qualityGateAttempts={qualityGateAttempts || null}
            qualityGateResult={qualityGateResult}
            onRefresh={onQualityGateRefresh}
          />
        )}

        <Separator />
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-destructive">
              Opções Avançadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir post
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
