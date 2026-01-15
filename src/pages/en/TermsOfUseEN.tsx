import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { OmniseenLogoHeader } from "@/components/ui/OmniseenLogoHeader";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const TermsOfUseEN = () => {
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
        <h1 className="text-4xl font-bold mb-2">Terms of Use</h1>
        <p className="text-muted-foreground mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using the OMNISEEN platform ("Service"), you agree to be bound by these Terms of Use. 
              If you do not agree to these terms, please do not use our Service. OMNISEEN reserves the right to 
              modify these terms at any time, and such modifications will be effective immediately upon posting.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              OMNISEEN is a Software as a Service (SaaS) platform that uses artificial intelligence to generate 
              SEO-optimized content for local businesses. Our services include automated blog content creation, 
              market intelligence, competitor analysis, and content publishing tools.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old and have the legal capacity to enter into binding contracts to use 
              our Service. By using OMNISEEN, you represent and warrant that you meet these eligibility requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              To access certain features, you must create an account. You agree to provide accurate, current, and 
              complete information during registration and to update such information to keep it accurate. You are 
              responsible for safeguarding your password and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Plans and Payments</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              OMNISEEN offers different subscription plans (Lite, Pro, Business) with varying features and limits. 
              All plans are billed monthly or annually in advance. Prices are subject to change with 30 days notice.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>All plans include a 7-day free trial</li>
              <li>Payments are processed securely via Stripe</li>
              <li>Refunds are available within 14 days of initial purchase for annual plans</li>
              <li>Monthly plans can be cancelled at any time with no refund for the current period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              Content generated through our platform is owned by the user who created it. OMNISEEN retains all 
              rights to the platform, technology, algorithms, and any improvements made thereto. You grant OMNISEEN 
              a limited license to use your content for service improvement and analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Generate content that is illegal, harmful, threatening, abusive, or defamatory</li>
              <li>Infringe upon intellectual property rights of third parties</li>
              <li>Distribute malware or engage in hacking activities</li>
              <li>Circumvent usage limits or access controls</li>
              <li>Resell or redistribute the service without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              OMNISEEN provides the Service "as is" without warranties of any kind. We are not liable for any 
              indirect, incidental, special, consequential, or punitive damages. Our total liability shall not 
              exceed the amount paid by you in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless OMNISEEN and its officers, directors, employees, and agents 
              from any claims, damages, losses, or expenses arising from your use of the Service or violation of 
              these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              OMNISEEN may terminate or suspend your account at any time for violations of these Terms. Upon 
              termination, your right to use the Service ceases immediately. You may export your content before 
              termination takes effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the United States and 
              the State of Delaware, without regard to conflict of law principles. Any disputes shall be resolved 
              through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Use, please contact us at:
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
              <Link to="/en/privacy" className="text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/en/services" className="text-muted-foreground hover:text-foreground">
                Services
              </Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                Português
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfUseEN;
