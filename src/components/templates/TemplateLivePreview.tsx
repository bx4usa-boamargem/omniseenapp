import { TemplateDefinition } from './templateData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User } from 'lucide-react';

interface Blog {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  author_name?: string | null;
  author_photo_url?: string | null;
}

interface Article {
  id: string;
  title: string;
  excerpt?: string | null;
  featured_image_url?: string | null;
  slug: string;
  reading_time?: number | null;
  created_at: string;
}

interface TemplateLivePreviewProps {
  template: TemplateDefinition;
  blog: Blog;
  articles: Article[];
  isDark?: boolean;
}

// Mock articles as fallback for preview
const MOCK_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'Como aumentar suas vendas em 2025',
    excerpt: 'Descubra as melhores estratégias para impulsionar seu negócio e alcançar resultados extraordinários.',
    featured_image_url: '/placeholder.svg',
    slug: 'aumentar-vendas-2025',
    reading_time: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Guia completo de marketing digital',
    excerpt: 'Tudo que você precisa saber sobre marketing digital para iniciantes e profissionais.',
    featured_image_url: '/placeholder.svg',
    slug: 'guia-marketing-digital',
    reading_time: 8,
    created_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Tendências de tecnologia para ficar de olho',
    excerpt: 'As principais tendências tecnológicas que vão transformar o mercado nos próximos anos.',
    featured_image_url: '/placeholder.svg',
    slug: 'tendencias-tecnologia',
    reading_time: 6,
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Produtividade: técnicas que funcionam',
    excerpt: 'Métodos comprovados para aumentar sua produtividade no trabalho e na vida pessoal.',
    featured_image_url: '/placeholder.svg',
    slug: 'produtividade-tecnicas',
    reading_time: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'O futuro do trabalho remoto',
    excerpt: 'Como as empresas estão se adaptando à nova realidade do trabalho híbrido.',
    featured_image_url: '/placeholder.svg',
    slug: 'futuro-trabalho-remoto',
    reading_time: 7,
    created_at: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Inovação em pequenos negócios',
    excerpt: 'Estratégias de inovação acessíveis para pequenas e médias empresas.',
    featured_image_url: '/placeholder.svg',
    slug: 'inovacao-pequenos-negocios',
    reading_time: 5,
    created_at: new Date().toISOString(),
  },
];

export const TemplateLivePreview = ({ template, blog, articles, isDark = false }: TemplateLivePreviewProps) => {
  const isUsingMocks = articles.length === 0;
  const displayArticles = isUsingMocks ? MOCK_ARTICLES : articles;
  const primaryColor = blog.primary_color || '#6366f1';
  const secondaryColor = blog.secondary_color || '#8b5cf6';
  
  const bgClass = isDark ? 'bg-gray-900' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
  const cardBgClass = isDark ? 'bg-gray-800' : 'bg-white';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
  
  return (
    <div className={`min-h-[600px] ${bgClass} ${textClass}`}>
      {/* Header */}
      <header className={`border-b ${borderClass} py-4 px-6`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {blog.logo_url ? (
              <img src={blog.logo_url} alt={blog.name} className="h-8 w-auto" />
            ) : (
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                {blog.name.charAt(0)}
              </div>
            )}
            <span className="font-semibold">{blog.name}</span>
          </div>
          <nav className="flex items-center gap-6">
            <span className={`text-sm ${mutedTextClass} hover:${textClass} cursor-pointer`}>Home</span>
            <span className={`text-sm ${mutedTextClass} hover:${textClass} cursor-pointer`}>Artigos</span>
            <span className={`text-sm ${mutedTextClass} hover:${textClass} cursor-pointer`}>Sobre</span>
          </nav>
        </div>
      </header>
      
      {/* Hero Section based on template style */}
      <HeroSection 
        template={template} 
        blog={blog} 
        primaryColor={primaryColor}
        isDark={isDark}
        textClass={textClass}
        mutedTextClass={mutedTextClass}
      />
      
      {/* Articles Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-2xl font-bold mb-8 ${textClass}`}>Últimos Artigos</h2>
          
          <ArticleGrid 
            template={template}
            articles={displayArticles}
            primaryColor={primaryColor}
            isDark={isDark}
            cardBgClass={cardBgClass}
            borderClass={borderClass}
            textClass={textClass}
            mutedTextClass={mutedTextClass}
          />
        </div>
      </section>
    </div>
  );
};

// Hero Section Component
const HeroSection = ({ 
  template, 
  blog, 
  primaryColor, 
  isDark,
  textClass,
  mutedTextClass
}: { 
  template: TemplateDefinition; 
  blog: Blog; 
  primaryColor: string;
  isDark: boolean;
  textClass: string;
  mutedTextClass: string;
}) => {
  const bgGradient = isDark 
    ? `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}10)`
    : `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`;
  
  switch (template.heroStyle) {
    case 'minimal':
      return (
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className={`text-4xl font-bold mb-4 ${textClass}`}>{blog.name}</h1>
            <p className={`text-lg ${mutedTextClass}`}>{blog.description || 'Descubra conteúdos incríveis sobre diversos temas.'}</p>
          </div>
        </section>
      );
      
    case 'split':
      return (
        <section className="py-16 px-6" style={{ background: bgGradient }}>
          <div className="max-w-6xl mx-auto flex items-center gap-12">
            <div className="flex-1">
              <h1 className={`text-4xl font-bold mb-4 ${textClass}`}>{blog.name}</h1>
              <p className={`text-lg mb-6 ${mutedTextClass}`}>{blog.description || 'Descubra conteúdos incríveis sobre diversos temas.'}</p>
              <button 
                className="px-6 py-3 rounded-lg text-white font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                Explorar Artigos
              </button>
            </div>
            <div className="flex-1 hidden md:block">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
            </div>
          </div>
        </section>
      );
      
    case 'ticker':
      return (
        <section className={`py-3 px-6 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-8 animate-marquee">
            {['🔥 Novo artigo disponível', '📈 Tendências da semana', '💡 Dicas exclusivas', '🚀 Novidades em breve'].map((item, i) => (
              <span key={i} className={`whitespace-nowrap ${mutedTextClass}`}>{item}</span>
            ))}
          </div>
        </section>
      );
      
    case 'featured':
      return (
        <section className="py-8 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-4 h-64">
              <div 
                className="md:col-span-2 rounded-2xl p-6 flex flex-col justify-end"
                style={{ 
                  background: `${bgGradient}, url(https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <span className="text-white/80 text-sm">Destaque</span>
                <h2 className="text-2xl font-bold text-white">Artigo em Destaque</h2>
              </div>
              <div className="flex flex-col gap-4">
                <div className={`flex-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'} p-4`}>
                  <span className={mutedTextClass}>Mais lidos</span>
                </div>
                <div className={`flex-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'} p-4`}>
                  <span className={mutedTextClass}>Recentes</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
      
    case 'asymmetric':
      return (
        <section className="py-16 px-6" style={{ background: bgGradient }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start gap-8">
              <div className="w-2/3">
                <h1 className={`text-5xl font-bold mb-4 leading-tight ${textClass}`}>{blog.name}</h1>
                <p className={`text-xl ${mutedTextClass}`}>{blog.description}</p>
              </div>
              <div 
                className="w-1/3 h-32 rounded-2xl transform rotate-3"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>
        </section>
      );
      
    default: // centered
      return (
        <section className="py-20 px-6 text-center" style={{ background: bgGradient }}>
          <div className="max-w-3xl mx-auto">
            {blog.author_photo_url && template.id === 'personal' && (
              <img 
                src={blog.author_photo_url} 
                alt={blog.author_name || ''} 
                className="w-24 h-24 rounded-full mx-auto mb-6 object-cover border-4 border-white shadow-lg"
              />
            )}
            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${textClass}`}>{blog.name}</h1>
            <p className={`text-lg md:text-xl ${mutedTextClass}`}>{blog.description || 'Descubra conteúdos incríveis sobre diversos temas.'}</p>
          </div>
        </section>
      );
  }
};

// Article Grid Component
const ArticleGrid = ({
  template,
  articles,
  primaryColor,
  isDark,
  cardBgClass,
  borderClass,
  textClass,
  mutedTextClass
}: {
  template: TemplateDefinition;
  articles: Article[];
  primaryColor: string;
  isDark: boolean;
  cardBgClass: string;
  borderClass: string;
  textClass: string;
  mutedTextClass: string;
}) => {
  const gridClass = template.gridStyle === 'list' 
    ? 'flex flex-col gap-4'
    : template.gridStyle === 'masonry'
      ? 'columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4'
      : `grid gap-6 ${
          template.gridColumns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
          template.gridColumns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
          template.gridColumns === 2 ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1'
        }`;
  
  const displayCount = template.gridColumns === 4 ? 8 : template.gridColumns === 3 ? 6 : 4;
  
  return (
    <div className={gridClass}>
      {articles.slice(0, displayCount).map((article, index) => (
        <ArticleCard
          key={article.id}
          article={article}
          template={template}
          primaryColor={primaryColor}
          cardBgClass={cardBgClass}
          borderClass={borderClass}
          textClass={textClass}
          mutedTextClass={mutedTextClass}
          index={index}
        />
      ))}
    </div>
  );
};

// Article Card Component
const ArticleCard = ({
  article,
  template,
  primaryColor,
  cardBgClass,
  borderClass,
  textClass,
  mutedTextClass,
  index
}: {
  article: Article;
  template: TemplateDefinition;
  primaryColor: string;
  cardBgClass: string;
  borderClass: string;
  textClass: string;
  mutedTextClass: string;
  index: number;
}) => {
  const isMinimal = template.cardStyle === 'minimal';
  const isColorful = template.cardStyle === 'colorful';
  const isImageHeavy = template.cardStyle === 'image-heavy';
  const isSharp = template.cardStyle === 'sharp';
  
  const borderRadius = isSharp ? 'rounded-none' : 'rounded-xl';
  
  if (isMinimal) {
    return (
      <article className={`py-4 border-b ${borderClass}`}>
        <h3 className={`text-lg font-semibold mb-2 ${textClass} hover:underline cursor-pointer`}>
          {article.title}
        </h3>
        <p className={`text-sm ${mutedTextClass} line-clamp-2`}>{article.excerpt}</p>
        <div className={`flex items-center gap-4 mt-2 text-xs ${mutedTextClass}`}>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {article.reading_time || 5} min
          </span>
          <span>{format(new Date(article.created_at), "d 'de' MMM", { locale: ptBR })}</span>
        </div>
      </article>
    );
  }
  
  return (
    <article 
      className={`${cardBgClass} ${borderRadius} overflow-hidden border ${borderClass} hover:shadow-lg transition-shadow cursor-pointer ${
        template.gridStyle === 'masonry' ? 'break-inside-avoid' : ''
      } ${isColorful ? 'border-l-4' : ''}`}
      style={{
        borderLeftColor: isColorful ? primaryColor : undefined,
        minHeight: template.gridStyle === 'masonry' ? (index % 3 === 0 ? '280px' : '220px') : undefined
      }}
    >
      {!isMinimal && article.featured_image_url && (
        <div className={`${isImageHeavy ? 'aspect-[16/10]' : 'aspect-video'} overflow-hidden`}>
          <img 
            src={article.featured_image_url} 
            alt={article.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className={`font-semibold mb-2 ${textClass} line-clamp-2 hover:underline`}>
          {article.title}
        </h3>
        <p className={`text-sm ${mutedTextClass} line-clamp-2 mb-3`}>{article.excerpt}</p>
        <div className={`flex items-center gap-4 text-xs ${mutedTextClass}`}>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {article.reading_time || 5} min
          </span>
          <span>{format(new Date(article.created_at), "d 'de' MMM", { locale: ptBR })}</span>
        </div>
      </div>
    </article>
  );
};
