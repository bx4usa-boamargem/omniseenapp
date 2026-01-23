import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentScoreGaugeProps {
  score: number | null;
  loading?: boolean;
  goalMarker?: number;
  className?: string;
}

/**
 * Semicircular gauge with continuous gradient (red → yellow → green),
 * moving pointer, goal marker and score display as "X / 100"
 * 
 * CRITICAL: Score comes from database (article_content_scores.total_score)
 * Never use hardcoded values.
 */
export function ContentScoreGauge({ 
  score, 
  loading = false, 
  goalMarker = 50,
  className 
}: ContentScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const hasScore = score !== null;
  const targetScore = score ?? 0;
  
  // Animate score changes
  useEffect(() => {
    if (loading || !hasScore) return;
    
    const duration = 800;
    const steps = 40;
    const increment = (targetScore - displayScore) / steps;
    let current = displayScore;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setDisplayScore(targetScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [targetScore, loading, hasScore]);

  // Gauge dimensions
  const width = 200;
  const height = 120;
  const strokeWidth = 14;
  const radius = 80;
  const centerX = 100;
  const centerY = 95;
  
  // Pointer position (angle in degrees, 0 = left, 180 = right)
  const pointerAngle = (displayScore / 100) * 180;
  const pointerRad = (180 - pointerAngle) * (Math.PI / 180);
  const pointerX = centerX + radius * Math.cos(pointerRad);
  const pointerY = centerY - radius * Math.sin(pointerRad);
  
  // Goal marker position (on outer edge)
  const goalAngle = (goalMarker / 100) * 180;
  const goalRad = (180 - goalAngle) * (Math.PI / 180);
  const goalX = centerX + (radius + 18) * Math.cos(goalRad);
  const goalY = centerY - (radius + 18) * Math.sin(goalRad);
  
  // Get score color based on current value
  const getScoreColor = () => {
    if (!hasScore) return 'hsl(var(--muted-foreground))';
    if (displayScore >= 80) return 'hsl(142, 76%, 36%)'; // green
    if (displayScore >= 60) return 'hsl(38, 92%, 50%)';  // yellow
    return 'hsl(0, 84%, 60%)'; // red
  };
  
  // Arc path for semicircle (from left to right)
  const arcPath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;

  return (
    <div className={cn("relative flex flex-col items-center py-4", className)}>
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Gradient definition for continuous arc */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
            <stop offset="55%" stopColor="hsl(0, 84%, 60%)" />
            <stop offset="60%" stopColor="hsl(38, 92%, 50%)" />
            <stop offset="75%" stopColor="hsl(38, 92%, 50%)" />
            <stop offset="80%" stopColor="hsl(142, 76%, 36%)" />
            <stop offset="100%" stopColor="hsl(142, 76%, 36%)" />
          </linearGradient>
        </defs>
        
        {/* Single continuous arc with gradient - red → yellow → green */}
        <path
          d={arcPath}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Goal marker 🔥 */}
        <g transform={`translate(${goalX}, ${goalY})`}>
          <circle r="10" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="1" />
          <text 
            x="0" 
            y="4" 
            textAnchor="middle" 
            fontSize="10"
            className="select-none"
          >
            🔥
          </text>
        </g>
        <text 
          x={goalX} 
          y={goalY - 14} 
          textAnchor="middle" 
          fontSize="9"
          className="fill-muted-foreground font-medium"
        >
          {goalMarker}
        </text>
        
        {/* Moving pointer (circle) - only show when has score and not loading */}
        {hasScore && !loading && (
          <circle
            cx={pointerX}
            cy={pointerY}
            r={strokeWidth / 2 + 2}
            fill={getScoreColor()}
            stroke="hsl(var(--background))"
            strokeWidth={3}
            className="transition-all duration-300 ease-out"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
            }}
          />
        )}
        
        {/* Min/Max labels */}
        <text 
          x={centerX - radius - 8} 
          y={centerY + 18} 
          textAnchor="middle" 
          fontSize="10"
          className="fill-muted-foreground"
        >
          0
        </text>
        <text 
          x={centerX + radius + 8} 
          y={centerY + 18} 
          textAnchor="middle" 
          fontSize="10"
          className="fill-muted-foreground"
        >
          100
        </text>
      </svg>
      
      {/* Score display - SAME typography weight for score and "/100" */}
      <div className="absolute inset-0 flex items-center justify-center pt-4">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex items-baseline gap-1" style={{ marginTop: '20px' }}>
            {hasScore ? (
              <>
                <span 
                  className="text-3xl font-bold tabular-nums"
                  style={{ color: getScoreColor() }}
                >
                  {displayScore}
                </span>
                <span 
                  className="text-3xl font-bold"
                  style={{ color: getScoreColor() }}
                >
                  /100
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold tabular-nums text-muted-foreground">
                  --
                </span>
                <span className="text-3xl font-bold text-muted-foreground">
                  /100
                </span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Status text below gauge */}
      {!hasScore && !loading && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Calcule o score para ver a pontuação
        </p>
      )}
    </div>
  );
}
