import { Link } from "react-router-dom";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getArticlePath } from "@/utils/blogUrl";

interface ArticleCardProps {
  title: string;
  excerpt?: string | null;
  slug: string;
  blogSlug: string;
  category?: string | null;
  tags?: string[] | null;
  publishedAt?: string | null;
  featuredImageUrl?: string | null;
  primaryColor?: string;
  customDomain?: string | null;
  domainVerified?: boolean | null;
}

const calculateReadingTime = (content?: string | null): number => {
  if (!content) return 1;
  const cleanText = content.replace(/<[^>]*>/g, '').replace(/[#*_\[\](){}|`~>]/g, '');
  const wordsPerMinute = 200;
  const words = cleanText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

export const ArticleCard = ({
  title,
  excerpt,
  slug,
  blogSlug,
  category,
  tags,
  publishedAt,
  featuredImageUrl,
  primaryColor,
  customDomain,
  domainVerified,
}: ArticleCardProps) => {
  const readingTime = calculateReadingTime(excerpt);
  const articlePath = getArticlePath(
    { slug: blogSlug, custom_domain: customDomain, domain_verified: domainVerified },
    slug
  );
  
  return (
    <Link 
      to={articlePath}
      className="group block"
    >
      <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300 h-full flex flex-col">
        {featuredImageUrl ? (
          <div className="aspect-video overflow-hidden bg-gray-100">
            <img
              src={featuredImageUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        ) : (
          <div 
            className="aspect-video flex items-center justify-center bg-gray-100"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <span 
              className="text-4xl font-heading font-bold opacity-30"
              style={{ color: primaryColor || "#6366f1" }}
            >
              {title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        <div className="p-5 flex flex-col flex-1">
          {category && (
            <Badge 
              variant="secondary" 
              className="w-fit mb-3 text-xs"
              style={{ 
                backgroundColor: `${primaryColor}15`,
                color: primaryColor || "#6366f1"
              }}
            >
              {category}
            </Badge>
          )}
          
          <h2 className="font-heading font-semibold text-lg text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-2">
            {title}
          </h2>
          
          {excerpt && (
            <p className="text-gray-600 text-sm line-clamp-2 mb-3 flex-1">
              {excerpt}
            </p>
          )}
          
          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.slice(0, 3).map(tag => (
                <span 
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-200">
            {publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(publishedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {readingTime} min
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
};
