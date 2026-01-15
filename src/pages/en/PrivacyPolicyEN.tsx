import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { OmniseenLogoHeader } from "@/components/ui/OmniseenLogoHeader";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const PrivacyPolicyEN = () => {
  const currentYear = new Date().getFullYear();
  const lastUpdated = "January 15, 2026";

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

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              OMNISEEN ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains 
              how we collect, use, disclose, and safeguard your information when you use our platform. Please read 
              this policy carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-medium mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>Account information (name, email, password)</li>
              <li>Business profile data (company name, industry, location)</li>
              <li>Payment information (processed securely via Stripe)</li>
              <li>Content and configurations you create</li>
              <li>Communications with our support team</li>
            </ul>
            
            <h3 className="text-xl font-medium mb-3">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Device information and browser type</li>
              <li>IP address and geographic location</li>
              <li>Usage patterns and feature interactions</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Generate personalized AI content for your business</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service updates and marketing communications (with consent)</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Comply with legal obligations and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Service Providers:</strong> Third parties that help operate our platform (hosting, payment processing, analytics)</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
              <li><strong>With Consent:</strong> For any other purpose with your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encryption (TLS/SSL), secure data centers, 
              access controls, and regular security audits. However, no method of transmission over the Internet is 
              100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to legal requirements)</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to enhance functionality, analyze usage, and personalize 
              content. You can manage cookie preferences through your browser settings. Some features may not 
              function properly if cookies are disabled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as necessary to provide services and comply with legal obligations. 
              After account deletion, we may retain certain data in anonymized form for analytics purposes or as 
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. International Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate 
              safeguards are in place for such transfers in compliance with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for individuals under 18 years of age. We do not knowingly collect 
              personal information from children. If we become aware of such collection, we will take steps to 
              delete the information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of significant changes via email 
              or through a notice on our platform. Your continued use after changes constitutes acceptance of the 
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions, concerns, or requests regarding this Privacy Policy or your data, please contact us:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Email:</strong> contato@omniseen.com
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} OMNISEEN. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/en/terms" className="text-muted-foreground hover:text-foreground">
                Terms of Use
              </Link>
              <Link to="/en/services" className="text-muted-foreground hover:text-foreground">
                Services
              </Link>
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                Português
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyEN;
