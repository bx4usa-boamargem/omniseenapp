import { BookOpen, ExternalLink } from "lucide-react";

export interface GlossaryTerm {
  term: string;
  definition: string;
  url?: string;
}

interface ArticleGlossaryProps {
  terms: GlossaryTerm[];
  primaryColor?: string | null;
}

/**
 * Renders a glossary section at the end of the article.
 * Shows only terms that actually appear in the article (filtered externally).
 */
export const ArticleGlossary = ({ terms, primaryColor }: ArticleGlossaryProps) => {
  if (!terms || terms.length === 0) return null;

  const accentColor = primaryColor || "#2563eb";

  return (
    <section className="mt-12 border-t border-border/60 pt-8" aria-label="Glossário">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <BookOpen className="h-5 w-5" style={{ color: accentColor }} />
        </div>
        <h2
          className="text-xl font-heading font-semibold text-foreground"
          id="glossario"
        >
          Glossário
        </h2>
      </div>

      <dl className="space-y-4">
        {terms.map((item, idx) => (
          <div
            key={idx}
            className="group bg-muted/30 border border-border/40 rounded-xl p-4 hover:border-border/70 transition-colors"
          >
            <dt className="flex items-center gap-2 mb-1">
              <span
                className="font-semibold text-sm tracking-wide"
                style={{ color: accentColor }}
              >
                {item.term}
              </span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Saiba mais sobre ${item.term}`}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </a>
              )}
            </dt>
            <dd className="text-sm text-muted-foreground leading-relaxed pl-0">
              {item.definition}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

/**
 * Processes article HTML content and wraps glossary terms with styled links.
 * Terms are matched case-insensitively (first occurrence only per term).
 * Returns the modified HTML string.
 */
export function injectGlossaryLinks(
  html: string,
  terms: GlossaryTerm[],
  primaryColor?: string | null
): string {
  if (!html || !terms || terms.length === 0) return html;

  const color = primaryColor || "#2563eb";
  let result = html;

  for (const { term, url } of terms) {
    // Escape special regex chars
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match first occurrence, not inside existing tags/attributes
    const pattern = new RegExp(
      `(?<!<[^>]*)\\b(${escaped})\\b(?![^<]*>)`,
      "i"
    );

    if (url) {
      result = result.replace(
        pattern,
        `<a href="${url}" class="glossary-link" style="color:${color};text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;font-weight:500;" target="_blank" rel="noopener noreferrer" title="${term} — veja no glossário">$1</a>`
      );
    } else {
      result = result.replace(
        pattern,
        `<span class="glossary-term" style="border-bottom:1.5px dotted ${color};cursor:help;font-weight:500;" title="${term} — veja no glossário abaixo">$1</span>`
      );
    }
  }

  return result;
}
