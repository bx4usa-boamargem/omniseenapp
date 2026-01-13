import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreStarsProps {
  score: number;
  stars?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreStars({ score, stars, showScore = true, size = 'md' }: ScoreStarsProps) {
  // Calculate stars from score if not provided
  const calculatedStars = stars ?? (
    score >= 90 ? 5 :
    score >= 75 ? 4 :
    score >= 60 ? 3 :
    score >= 40 ? 2 : 1
  );

  const getScoreColor = () => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const starSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const scoreSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-2">
      {showScore && (
        <span className={cn('font-bold', scoreSizes[size], getScoreColor())}>
          {score}
        </span>
      )}
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            className={cn(
              starSizes[size],
              i < calculatedStars 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300 dark:text-gray-600'
            )} 
          />
        ))}
      </div>
    </div>
  );
}
