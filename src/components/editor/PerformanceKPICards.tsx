import { Clock, TrendingUp, TrendingDown, MousePointer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceKPICardsProps {
  estimatedReadTimeSeconds: number;
  predictedScrollDepth: number;
  predictedBounceRate: number;
  improvements?: {
    estimated_read_time_delta?: number;
    predicted_scroll_depth_delta?: number;
    predicted_bounce_rate_delta?: number;
  };
}

export function PerformanceKPICards({
  estimatedReadTimeSeconds,
  predictedScrollDepth,
  predictedBounceRate,
  improvements
}: PerformanceKPICardsProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}min ${secs}s` : `${secs}s`;
  };

  const getScrollColor = (value: number) => {
    if (value >= 70) return 'text-green-600 dark:text-green-400';
    if (value >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getBounceColor = (value: number) => {
    if (value <= 30) return 'text-green-600 dark:text-green-400';
    if (value <= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Read Time */}
      <div className="bg-muted/50 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {improvements?.estimated_read_time_delta && improvements.estimated_read_time_delta > 0 && (
            <TrendingUp className="h-3 w-3 text-green-500" />
          )}
        </div>
        <p className="text-lg font-bold text-foreground">
          {formatTime(estimatedReadTimeSeconds)}
        </p>
        <p className="text-xs text-muted-foreground">Leitura</p>
        {improvements?.estimated_read_time_delta !== undefined && improvements.estimated_read_time_delta !== 0 && (
          <p className={cn(
            "text-xs font-medium",
            improvements.estimated_read_time_delta > 0 ? "text-green-600" : "text-red-600"
          )}>
            {improvements.estimated_read_time_delta > 0 ? '+' : ''}{formatTime(improvements.estimated_read_time_delta)}
          </p>
        )}
      </div>

      {/* Scroll Depth */}
      <div className="bg-muted/50 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <MousePointer className="h-4 w-4 text-muted-foreground" />
          {improvements?.predicted_scroll_depth_delta && improvements.predicted_scroll_depth_delta > 0 && (
            <TrendingUp className="h-3 w-3 text-green-500" />
          )}
        </div>
        <p className={cn("text-lg font-bold", getScrollColor(predictedScrollDepth))}>
          {predictedScrollDepth}%
        </p>
        <p className="text-xs text-muted-foreground">Scroll</p>
        {improvements?.predicted_scroll_depth_delta !== undefined && improvements.predicted_scroll_depth_delta !== 0 && (
          <p className={cn(
            "text-xs font-medium",
            improvements.predicted_scroll_depth_delta > 0 ? "text-green-600" : "text-red-600"
          )}>
            {improvements.predicted_scroll_depth_delta > 0 ? '+' : ''}{improvements.predicted_scroll_depth_delta}%
          </p>
        )}
      </div>

      {/* Bounce Rate */}
      <div className="bg-muted/50 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          {improvements?.predicted_bounce_rate_delta && improvements.predicted_bounce_rate_delta < 0 && (
            <TrendingDown className="h-3 w-3 text-green-500" />
          )}
        </div>
        <p className={cn("text-lg font-bold", getBounceColor(predictedBounceRate))}>
          {predictedBounceRate}%
        </p>
        <p className="text-xs text-muted-foreground">Bounce</p>
        {improvements?.predicted_bounce_rate_delta !== undefined && improvements.predicted_bounce_rate_delta !== 0 && (
          <p className={cn(
            "text-xs font-medium",
            improvements.predicted_bounce_rate_delta < 0 ? "text-green-600" : "text-red-600"
          )}>
            {improvements.predicted_bounce_rate_delta > 0 ? '+' : ''}{improvements.predicted_bounce_rate_delta}%
          </p>
        )}
      </div>
    </div>
  );
}
