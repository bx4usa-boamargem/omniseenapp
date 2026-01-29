/**
 * Article Metadata Card
 * 
 * Exibe métricas do artigo: word count, SEO score, H2 count, etc.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Hash, 
  BarChart3, 
  Image as ImageIcon, 
  Shield, 
  HelpCircle,
  CheckCircle,
  XCircle,
  Percent
} from 'lucide-react';

interface ArticleMetadata {
  wordCount: number;
  h2Count: number;
  faqCount: number;
  imageCount: number;
  keywordDensity: number;
  hasEat: boolean;
  seoScore: number;
  template: string;
}

interface ArticleMetadataCardProps {
  metadata: ArticleMetadata;
  targetWordCount?: [number, number];
}

const TEMPLATE_NAMES: Record<string, string> = {
  complete_guide: 'Guia Completo',
  qa_format: 'Perguntas & Respostas',
  comparative: 'Comparativo Técnico',
  problem_solution: 'Problema → Solução',
  educational_steps: 'Educacional em Etapas'
};

export function ArticleMetadataCard({ 
  metadata, 
  targetWordCount = [800, 3000] 
}: ArticleMetadataCardProps) {
  const isWordCountValid = metadata.wordCount >= targetWordCount[0];
  const isH2CountValid = metadata.h2Count >= 5 && metadata.h2Count <= 15;
  const isFaqCountValid = metadata.faqCount >= 5;
  const isKeywordDensityValid = metadata.keywordDensity >= 0.5 && metadata.keywordDensity <= 3;
  const isSeoScoreGood = metadata.seoScore >= 70;
  
  const StatusIcon = ({ valid }: { valid: boolean }) => (
    valid 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-destructive" />
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Word Count */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Palavras</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {metadata.wordCount.toLocaleString()}
                </p>
                <StatusIcon valid={isWordCountValid} />
              </div>
              <p className="text-xs text-muted-foreground">
                meta: {targetWordCount[0]}-{targetWordCount[1]}
              </p>
            </div>
          </div>
          
          {/* SEO Score */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <BarChart3 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">SEO Score</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {metadata.seoScore}/100
                </p>
                <StatusIcon valid={isSeoScoreGood} />
              </div>
              <p className="text-xs text-muted-foreground">
                meta: ≥70
              </p>
            </div>
          </div>
          
          {/* H2 Count */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Seções H2</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {metadata.h2Count}
                </p>
                <StatusIcon valid={isH2CountValid} />
              </div>
              <p className="text-xs text-muted-foreground">
                meta: 5-15
              </p>
            </div>
          </div>
          
          {/* FAQ Count */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">FAQ</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {metadata.faqCount}
                </p>
                <StatusIcon valid={isFaqCountValid} />
              </div>
              <p className="text-xs text-muted-foreground">
                meta: ≥5
              </p>
            </div>
          </div>
          
          {/* Images */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <ImageIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Imagens</p>
              <p className="font-semibold text-lg">
                {metadata.imageCount}
              </p>
            </div>
          </div>
          
          {/* Keyword Density */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Percent className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Densidade</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {metadata.keywordDensity}%
                </p>
                <StatusIcon valid={isKeywordDensityValid} />
              </div>
              <p className="text-xs text-muted-foreground">
                meta: 0.5-3%
              </p>
            </div>
          </div>
          
          {/* E-E-A-T */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">E-E-A-T</p>
              <div className="flex items-center gap-2">
                <Badge variant={metadata.hasEat ? 'default' : 'secondary'}>
                  {metadata.hasEat ? 'Presente' : 'Ausente'}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Template */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Template</p>
              <Badge variant="outline">
                {TEMPLATE_NAMES[metadata.template] || metadata.template}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
