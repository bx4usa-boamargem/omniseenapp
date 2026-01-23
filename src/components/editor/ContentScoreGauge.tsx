import { useEffect, useState } from 'react';
import { Loader2, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentScoreGaugeProps {
  score: number | null;
  loading?: boolean;
  goalMarker?: number;
  className?: string;
}

/**
 * Semicircular gauge with 3 color zones (red/yellow/green),
 * moving pointer, goal marker and score display as "X / 100"
 */
export function ContentScoreGauge({ 
  score, 
  loading = false, 
  goalMarker = 50,
  className 
}: ContentScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const targetScore = score ?? 0;
  
  // Animate score
  useEffect(() => {
    if (loading) return;
    
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
  }, [targetScore, loading]);

  // Gauge dimensions
  const width = 200;
  const height = 110;
  const strokeWidth = 14;
  const radius = 80;
  const centerX = 100;
  const centerY = 95;
  
  // Arc calculation (semicircle from left to right)
  const circumference = Math.PI * radius;
  const progress = (displayScore / 100) * circumference;
  
  // Pointer position (angle in degrees, 0 = left, 180 = right)
  const pointerAngle = (displayScore / 100) * 180;
  const pointerRad = (180 - pointerAngle) * (Math.PI / 180);
  const pointerX = centerX + (radius - strokeWidth / 2) * Math.cos(pointerRad);
  const pointerY = centerY - (radius - strokeWidth / 2) * Math.sin(pointerRad);
  
  // Goal marker position (e.g., 50)
  const goalAngle = (goalMarker / 100) * 180;
  const goalRad = (180 - goalAngle) * (Math.PI / 180);
  const goalX = centerX + (radius + 12) * Math.cos(goalRad);
  const goalY = centerY - (radius + 12) * Math.sin(goalRad);
  
  // Color zones angles
  const getZoneEndX = (percentage: number) => {
    const angle = (percentage / 100) * 180;
    const rad = (180 - angle) * (Math.PI / 180);
    return centerX + radius * Math.cos(rad);
  };
  
  const getZoneEndY = (percentage: number) => {
    const angle = (percentage / 100) * 180;
    const rad = (180 - angle) * (Math.PI / 180);
    return centerY - radius * Math.sin(rad);
  };
  
  // Get score color based on current value
  const getScoreColor = () => {
    if (displayScore >= 80) return 'hsl(142, 76%, 36%)'; // green
    if (displayScore >= 60) return 'hsl(38, 92%, 50%)';  // yellow
    return 'hsl(0, 84%, 60%)'; // red
  };

  // Arc path for semicircle
  const arcPath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;
  
  // Zone arc paths
  const createZonePath = (startPct: number, endPct: number) => {
    const startAngle = (startPct / 100) * 180;
    const endAngle = (endPct / 100) * 180;
    const startRad = (180 - startAngle) * (Math.PI / 180);
    const endRad = (180 - endAngle) * (Math.PI / 180);
    
    const startX = centerX + radius * Math.cos(startRad);
    const startY = centerY - radius * Math.sin(startRad);
    const endX = centerX + radius * Math.cos(endRad);
    const endY = centerY - radius * Math.sin(endRad);
    
    const largeArc = endPct - startPct > 50 ? 1 : 0;
    
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
  };

  return (
    <div className={cn("relative flex flex-col items-center py-4", className)}>
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Background arc (gray) */}
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Zone 1: Red (0-59) */}
        <path
          d={createZonePath(0, 59)}
          fill="none"
          stroke="hsl(0, 84%, 60%)"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          opacity={0.9}
        />
        
        {/* Zone 2: Yellow (59-79) */}
        <path
          d={createZonePath(59, 79)}
          fill="none"
          stroke="hsl(38, 92%, 50%)"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          opacity={0.9}
        />
        
        {/* Zone 3: Green (79-100) */}
        <path
          d={createZonePath(79, 100)}
          fill="none"
          stroke="hsl(142, 76%, 36%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.9}
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
          y={goalY - 16} 
          textAnchor="middle" 
          fontSize="9"
          className="fill-muted-foreground font-medium"
        >
          {goalMarker}
        </text>
        
        {/* Moving pointer (circle) */}
        {!loading && (
          <circle
            cx={pointerX}
            cy={pointerY}
            r={strokeWidth / 2 + 3}
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
          x={centerX - radius - 5} 
          y={centerY + 15} 
          textAnchor="middle" 
          fontSize="10"
          className="fill-muted-foreground"
        >
          0
        </text>
        <text 
          x={centerX + radius + 5} 
          y={centerY + 15} 
          textAnchor="middle" 
          fontSize="10"
          className="fill-muted-foreground"
        >
          100
        </text>
      </svg>
      
      {/* Score display */}
      <div className="absolute inset-0 flex items-center justify-center pt-4">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex items-baseline gap-1" style={{ marginTop: '20px' }}>
            <span 
              className="text-3xl font-bold tabular-nums"
              style={{ color: getScoreColor() }}
            >
              {displayScore}
            </span>
            <span className="text-3xl font-bold text-muted-foreground/60">
              /
            </span>
            <span className="text-3xl font-bold text-muted-foreground/60">
              100
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
