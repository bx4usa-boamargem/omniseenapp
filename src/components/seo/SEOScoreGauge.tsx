import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SEOScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showButton?: boolean;
  animated?: boolean;
  onOptimize?: () => void;
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 6, fontSize: 16, labelSize: 10 },
  md: { width: 150, strokeWidth: 10, fontSize: 28, labelSize: 12 },
  lg: { width: 200, strokeWidth: 12, fontSize: 36, labelSize: 14 },
};

function getScoreColor(score: number): string {
  if (score <= 40) return "hsl(0, 84%, 60%)"; // Red
  if (score <= 70) return "hsl(38, 92%, 50%)"; // Orange
  return "hsl(142, 76%, 36%)"; // Green
}

function getScoreLabel(score: number): string {
  if (score <= 40) return "Poor";
  if (score <= 70) return "Average";
  return "Good";
}

export function SEOScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  showButton = false,
  animated = true,
  onOptimize,
  className,
}: SEOScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizeConfig[size];
  
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius; // Semi-circle
  const progress = (displayScore / 100) * circumference;
  const centerX = config.width / 2;
  const centerY = config.width / 2;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, animated]);

  const scoreColor = getScoreColor(displayScore);
  const scoreLabel = getScoreLabel(displayScore);

  // Calculate pointer angle (0 = left, 180 = right on semi-circle)
  const pointerAngle = (displayScore / 100) * 180;
  const pointerLength = radius - config.strokeWidth;
  const pointerX = centerX + pointerLength * Math.cos((180 - pointerAngle) * (Math.PI / 180));
  const pointerY = centerY - pointerLength * Math.sin((180 - pointerAngle) * (Math.PI / 180));

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: config.width, height: config.width / 2 + 20 }}>
        <svg
          width={config.width}
          height={config.width / 2 + 20}
          viewBox={`0 0 ${config.width} ${config.width / 2 + 20}`}
        >
          {/* Background arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${centerY} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${centerY}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id={`gauge-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
              <stop offset="50%" stopColor="hsl(38, 92%, 50%)" />
              <stop offset="100%" stopColor="hsl(142, 76%, 36%)" />
            </linearGradient>
          </defs>

          {/* Progress arc */}
          <path
            d={`M ${config.strokeWidth / 2} ${centerY} A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${centerY}`}
            fill="none"
            stroke={`url(#gauge-gradient-${size})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: animated ? 'stroke-dashoffset 0.3s ease-out' : 'none' }}
          />

          {/* Pointer circle */}
          <circle
            cx={pointerX}
            cy={pointerY}
            r={config.strokeWidth / 2 + 2}
            fill={scoreColor}
            stroke="hsl(var(--background))"
            strokeWidth={2}
            style={{ transition: animated ? 'all 0.3s ease-out' : 'none' }}
          />

          {/* Center text */}
          <text
            x={centerX}
            y={centerY - 5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={config.fontSize}
            fontWeight="bold"
            fill="white"
          >
            {displayScore}
          </text>

          {showLabel && (
            <text
              x={centerX}
              y={centerY + config.fontSize / 2 + 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={config.labelSize}
              fill="rgba(255,255,255,0.8)"
            >
              {scoreLabel}
            </text>
          )}

          {/* Min/Max labels */}
          <text
            x={config.strokeWidth}
            y={centerY + 15}
            textAnchor="start"
            fontSize={config.labelSize - 2}
            fill="rgba(255,255,255,0.7)"
          >
            0
          </text>
          <text
            x={config.width - config.strokeWidth}
            y={centerY + 15}
            textAnchor="end"
            fontSize={config.labelSize - 2}
            fill="rgba(255,255,255,0.7)"
          >
            100
          </text>
        </svg>
      </div>

      {showButton && onOptimize && (
        <Button
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={onOptimize}
          className="mt-2"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Auto-Optimize
        </Button>
      )}
    </div>
  );
}
