import { useTranslation } from "react-i18next";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { MapPin, Search, Lightbulb, PenTool, Calendar, Trophy } from "lucide-react";

export const AnimatedTimeline = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.1);

  const steps = [
    { 
      icon: MapPin, 
      emoji: "🗺️", 
      title: t('landing.timeline.step1.title'),
      desc: t('landing.timeline.step1.desc')
    },
    { 
      icon: Search, 
      emoji: "🔍", 
      title: t('landing.timeline.step2.title'),
      desc: t('landing.timeline.step2.desc')
    },
    { 
      icon: Lightbulb, 
      emoji: "💡", 
      title: t('landing.timeline.step3.title'),
      desc: t('landing.timeline.step3.desc')
    },
    { 
      icon: PenTool, 
      emoji: "✍️", 
      title: t('landing.timeline.step4.title'),
      desc: t('landing.timeline.step4.desc')
    },
    { 
      icon: Calendar, 
      emoji: "📅", 
      title: t('landing.timeline.step5.title'),
      desc: t('landing.timeline.step5.desc')
    },
    { 
      icon: Trophy, 
      emoji: "🏆", 
      title: t('landing.timeline.step6.title'),
      desc: t('landing.timeline.step6.desc')
    },
  ];

  return (
    <section ref={ref} className="py-20 bg-muted/30 overflow-hidden">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
            {t('landing.timeline.title')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.timeline.subtitle')}
          </p>
        </div>

        {/* Timeline - Desktop (horizontal) */}
        <div className="hidden lg:block relative">
          {/* Connecting line */}
          <div className="absolute top-16 left-0 right-0 h-1 bg-border">
            <div 
              className={`h-full bg-gradient-to-r from-primary to-accent transition-all duration-1500 ease-out ${
                isVisible ? 'w-full' : 'w-0'
              }`}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-6 gap-4">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={`relative flex flex-col items-center transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + index * 150}ms` }}
              >
                {/* Step number badge */}
                <div 
                  className={`w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-4 z-10 transition-all duration-500 ${
                    isVisible ? 'scale-100' : 'scale-0'
                  }`}
                  style={{ transitionDelay: `${400 + index * 150}ms` }}
                >
                  {index + 1}
                </div>

                {/* Icon container */}
                <div 
                  className={`w-20 h-20 rounded-2xl bg-card border-2 border-primary/20 flex items-center justify-center mb-4 shadow-lg transition-all duration-500 ${
                    isVisible ? 'scale-100 rotate-0' : 'scale-0 rotate-12'
                  }`}
                  style={{ transitionDelay: `${300 + index * 150}ms` }}
                >
                  <span className="text-3xl">{step.emoji}</span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-center mb-2">{step.title}</h3>
                
                {/* Description */}
                <p className="text-sm text-muted-foreground text-center">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline - Mobile/Tablet (vertical) */}
        <div className="lg:hidden relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-1 bg-border">
            <div 
              className={`w-full bg-gradient-to-b from-primary to-accent transition-all duration-1500 ease-out ${
                isVisible ? 'h-full' : 'h-0'
              }`}
            />
          </div>

          {/* Steps */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div 
                key={index}
                className={`relative flex gap-6 items-start transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                {/* Icon container */}
                <div 
                  className={`flex-shrink-0 w-16 h-16 rounded-xl bg-card border-2 border-primary/20 flex items-center justify-center shadow-lg z-10 transition-all duration-500 ${
                    isVisible ? 'scale-100' : 'scale-0'
                  }`}
                  style={{ transitionDelay: `${300 + index * 100}ms` }}
                >
                  <span className="text-2xl">{step.emoji}</span>
                </div>

                {/* Content */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {t('landing.timeline.stepLabel')} {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Central message */}
        <div 
          className={`mt-16 text-center transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '1200ms' }}
        >
          <div className="inline-block bg-gradient-to-r from-primary to-accent p-[2px] rounded-2xl">
            <div className="bg-background rounded-2xl px-8 py-6">
              <p className="text-xl md:text-2xl font-display font-bold">
                <span className="text-foreground">{t('landing.timeline.message1')}</span>
                <br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {t('landing.timeline.message2')}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
