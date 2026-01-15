import { Link } from "react-router-dom";
import { ArrowLeft, Check, Zap, Target, Building2, Globe } from "lucide-react";
import { OmniseenLogoHeader } from "@/components/ui/OmniseenLogoHeader";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const ServicesEN = () => {
  const currentYear = new Date().getFullYear();

  const plans = [
    {
      name: "Lite",
      price: "$37",
      description: "Start your local digital presence",
      features: [
        "1 blog",
        "8 articles/month",
        "1 user",
        "1 territory",
        "Automated basic SEO",
        "Custom domain",
        "Email support"
      ],
      icon: Zap,
      popular: false
    },
    {
      name: "Pro",
      price: "$97",
      description: "For growing businesses",
      features: [
        "1 blog",
        "20 articles/month",
        "5 users",
        "2 territories",
        "10 Radar searches/month",
        "Weekly market intelligence",
        "Competitor analysis",
        "Priority support"
      ],
      icon: Target,
      popular: true
    },
    {
      name: "Business",
      price: "$147",
      description: "For enterprises and agencies",
      features: [
        "5 blogs",
        "100 articles/month",
        "20 users",
        "10 territories",
        "30 Radar searches/blog",
        "Integration API",
        "Dedicated account manager",
        "Custom onboarding"
      ],
      icon: Building2,
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <OmniseenLogoHeader className="h-8" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Our Services
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your local business into a customer acquisition machine with artificial intelligence
          </p>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What We Offer</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Opportunity Radar</h3>
              <p className="text-muted-foreground">
                AI that monitors the local market and identifies content opportunities with high commercial intent.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Automatic Generation</h3>
              <p className="text-muted-foreground">
                SEO-optimized articles created automatically, with unique images and personalized CTAs.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional Blog</h3>
              <p className="text-muted-foreground">
                Public portal with your brand, custom domain, and responsive design ready to convert.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Plans & Pricing</h2>
          <p className="text-center text-muted-foreground mb-12">
            All plans include a 7-day free trial
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={`relative p-6 rounded-xl border bg-card ${
                  plan.popular ? 'border-primary shadow-lg scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <plan.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <p className="text-muted-foreground mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/auth">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Set up your business</h3>
                  <p className="text-muted-foreground">
                    Enter your niche, service area, and offerings. The AI learns about your business in minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">AI monitors the market</h3>
                  <p className="text-muted-foreground">
                    The Opportunity Radar analyzes trends, competitors, and local demands automatically.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Content is created and published</h3>
                  <p className="text-muted-foreground">
                    Optimized articles are generated and published on your blog, attracting qualified customers 24/7.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to dominate your local market?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Start your 7-day free trial. No credit card required.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} OMNISEEN. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/en/terms" className="text-muted-foreground hover:text-foreground">
                Terms of Use
              </Link>
              <Link to="/en/privacy" className="text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/services" className="text-muted-foreground hover:text-foreground">
                Português
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ServicesEN;
