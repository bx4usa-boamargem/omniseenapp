import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

interface ROICalculatorProps {
  totalViews: number;
  totalShares: number;
  publishedArticles: number;
  highScoreOpportunities: number;
  valuePerView?: number;
  valuePerShare?: number;
  valuePerArticle?: number;
  valuePerHighScore?: number;
  currency?: string;
}

export function ROICalculator({
  totalViews,
  totalShares,
  publishedArticles,
  highScoreOpportunities,
  valuePerView = 0.50,
  valuePerShare = 2.00,
  valuePerArticle = 200.00,
  valuePerHighScore = 50.00,
  currency = 'BRL'
}: ROICalculatorProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const viewsValue = totalViews * valuePerView;
  const sharesValue = totalShares * valuePerShare;
  const articlesValue = publishedArticles * valuePerArticle;
  const highScoreValue = highScoreOpportunities * valuePerHighScore;
  const totalValue = viewsValue + sharesValue + articlesValue + highScoreValue;

  const items = [
    { 
      label: 'Visualizações', 
      count: totalViews, 
      rate: valuePerView, 
      value: viewsValue 
    },
    { 
      label: 'Compartilhamentos', 
      count: totalShares, 
      rate: valuePerShare, 
      value: sharesValue 
    },
    { 
      label: 'Artigos publicados', 
      count: publishedArticles, 
      rate: valuePerArticle, 
      value: articlesValue 
    },
    { 
      label: 'Oportunidades 90%+', 
      count: highScoreOpportunities, 
      rate: valuePerHighScore, 
      value: highScoreValue 
    }
  ];

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          ROI Estimado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              <span>{item.label}: </span>
              <span className="font-medium text-gray-900 dark:text-white">{item.count.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 mr-2">
                × {formatCurrency(item.rate)}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(item.value)}
              </span>
            </div>
          </div>
        ))}
        
        <div className="border-t border-slate-200 dark:border-white/10 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              Total Estimado
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
