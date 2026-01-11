import { cn } from '@/lib/utils';

interface ClientRobotIllustrationProps {
  variant?: 'working' | 'success' | 'idle';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ClientRobotIllustration({ 
  variant = 'working', 
  className,
  size = 'md' 
}: ClientRobotIllustrationProps) {
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-40 h-40',
    lg: 'w-56 h-56'
  };

  const pulseColor = variant === 'success' 
    ? 'rgb(34, 197, 94)' 
    : variant === 'working' 
      ? 'rgb(139, 92, 246)' 
      : 'rgb(156, 163, 175)';

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* Outer glow ring */}
      <div 
        className="absolute inset-0 rounded-full opacity-20 animate-ping"
        style={{ 
          background: `radial-gradient(circle, ${pulseColor} 0%, transparent 70%)`,
          animationDuration: '3s'
        }}
      />
      
      {/* Main SVG */}
      <svg 
        viewBox="0 0 200 200" 
        className={cn('w-full h-full client-float', variant === 'working' && 'drop-shadow-lg')}
        style={{ filter: `drop-shadow(0 0 20px ${pulseColor}40)` }}
      >
        {/* Background gradient circle */}
        <defs>
          <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4D148C" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#FF6600" />
          </linearGradient>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4D148C" />
            <stop offset="100%" stopColor="#2D0A52" />
          </linearGradient>
          <linearGradient id="faceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#4D148C" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Orbiting circles - processing indicator */}
        {variant === 'working' && (
          <g className="origin-center" style={{ animation: 'spin 8s linear infinite' }}>
            <circle cx="100" cy="30" r="6" fill="#FF6600" opacity="0.8">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="170" cy="100" r="4" fill="#7C3AED" opacity="0.6">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="170" r="5" fill="#FF6600" opacity="0.7">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="30" cy="100" r="4" fill="#7C3AED" opacity="0.5">
              <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Robot Body */}
        <ellipse cx="100" cy="145" rx="45" ry="35" fill="url(#bodyGradient)" filter="url(#glow)" />
        
        {/* Robot Head */}
        <rect x="55" y="55" width="90" height="75" rx="20" fill="url(#faceGradient)" filter="url(#glow)" />
        
        {/* Antenna */}
        <line x1="100" y1="55" x2="100" y2="35" stroke="#7C3AED" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="30" r="8" fill="#FF6600" filter="url(#glow)">
          <animate attributeName="r" values="8;10;8" dur="1.5s" repeatCount="indefinite" />
        </circle>

        {/* Eyes */}
        <ellipse cx="75" cy="90" rx="12" ry="14" fill="#1a1a2e" />
        <ellipse cx="125" cy="90" rx="12" ry="14" fill="#1a1a2e" />
        
        {/* Eye glow */}
        <ellipse cx="75" cy="90" rx="8" ry="10" fill={variant === 'success' ? '#22c55e' : '#FF6600'}>
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="125" cy="90" rx="8" ry="10" fill={variant === 'success' ? '#22c55e' : '#FF6600'}>
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </ellipse>

        {/* Eye highlights */}
        <circle cx="72" cy="86" r="3" fill="white" opacity="0.8" />
        <circle cx="122" cy="86" r="3" fill="white" opacity="0.8" />

        {/* Smile */}
        <path 
          d="M 80 110 Q 100 125 120 110" 
          stroke={variant === 'success' ? '#22c55e' : '#FF6600'} 
          strokeWidth="4" 
          fill="none" 
          strokeLinecap="round"
          filter="url(#glow)"
        />

        {/* Arms */}
        <ellipse cx="35" cy="130" rx="15" ry="20" fill="url(#bodyGradient)" />
        <ellipse cx="165" cy="130" rx="15" ry="20" fill="url(#bodyGradient)" />
        
        {/* Hand waves for working state */}
        {variant === 'working' && (
          <g>
            <ellipse cx="165" cy="115" rx="10" ry="12" fill="#4D148C">
              <animateTransform 
                attributeName="transform" 
                type="rotate" 
                values="-10 165 130;10 165 130;-10 165 130" 
                dur="0.8s" 
                repeatCount="indefinite"
              />
            </ellipse>
          </g>
        )}

        {/* Chest indicator light */}
        <circle cx="100" cy="150" r="8" fill="#1a1a2e" />
        <circle cx="100" cy="150" r="5" fill={variant === 'success' ? '#22c55e' : '#7C3AED'}>
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
        </circle>

        {/* Success checkmark overlay */}
        {variant === 'success' && (
          <g filter="url(#glow)">
            <circle cx="100" cy="100" r="35" fill="none" stroke="#22c55e" strokeWidth="3" opacity="0.3" />
            <path 
              d="M 80 100 L 95 115 L 125 85" 
              stroke="#22c55e" 
              strokeWidth="6" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              opacity="0.9"
            />
          </g>
        )}
      </svg>

      {/* Particle effects for working state */}
      {variant === 'working' && (
        <div className="absolute inset-0 pointer-events-none">
          <div 
            className="absolute w-2 h-2 rounded-full bg-primary"
            style={{ 
              top: '20%', 
              left: '10%',
              animation: 'client-float 3s ease-in-out infinite',
              animationDelay: '0s'
            }}
          />
          <div 
            className="absolute w-1.5 h-1.5 rounded-full bg-orange-500"
            style={{ 
              top: '30%', 
              right: '15%',
              animation: 'client-float 2.5s ease-in-out infinite',
              animationDelay: '0.5s'
            }}
          />
          <div 
            className="absolute w-2 h-2 rounded-full bg-purple-400"
            style={{ 
              bottom: '25%', 
              left: '20%',
              animation: 'client-float 3.5s ease-in-out infinite',
              animationDelay: '1s'
            }}
          />
        </div>
      )}
    </div>
  );
}
