import { ArticleContent } from "@/components/public/ArticleContent";

interface AuthorityContentBlockProps {
  data: any;
  primaryColor: string;
}

export function AuthorityContentBlock({ data, primaryColor }: AuthorityContentBlockProps) {
  const content = data.html || "";

  return (
    <section className="py-24 px-6 bg-slate-50 border-y border-slate-200">
      <div className="container max-w-4xl mx-auto">
        <div className="prose prose-slate prose-lg max-w-none 
          prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-950
          prose-h2:text-4xl prose-h2:border-b-4 prose-h2:pb-4 prose-h2:mb-8
          prose-p:text-slate-700 prose-p:leading-relaxed
          prose-strong:text-slate-950">
          
          <style>{`
            h2 { border-color: ${primaryColor}30 !important; }
            .authority-image-container { 
              margin: 3rem 0;
              border-radius: 1.5rem;
              overflow: hidden;
              box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.15);
            }
          `}</style>

          <ArticleContent 
            content={content} 
            contentImages={data.images || []}
          />
        </div>
      </div>
    </section>
  );
}
