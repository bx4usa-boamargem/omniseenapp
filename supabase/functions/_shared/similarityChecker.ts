/**
 * SIMILARITY CHECKER
 * Detects duplicate/similar content using semantic fingerprinting
 * Prevents publication of repetitive or plagiarized content
 */

// Stopwords for Portuguese
const STOPWORDS = new Set([
  'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'para', 'com',
  'não', 'que', 'os', 'as', 'dos', 'das', 'no', 'na', 'por', 'mais',
  'como', 'mas', 'foi', 'ao', 'ele', 'ela', 'seu', 'sua', 'ou', 'ser',
  'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só',
  'pelo', 'pela', 'até', 'isso', 'esse', 'este', 'aquele', 'entre',
  'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me',
  'se', 'qual', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este',
  'fosse', 'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus', 'minhas',
  'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas',
  'dela', 'delas', 'esta', 'estes', 'estas', 'aquela', 'aquelas', 'aqueles',
  'isto', 'aquilo', 'estou', 'estava', 'estamos', 'esteve', 'estivemos',
]);

interface SimilarityResult {
  isSimilar: boolean;
  similarityScore: number;
  mostSimilarArticle?: {
    id: string;
    title: string;
    similarity: number;
  };
  threshold: number;
}

/**
 * Normalizes text for fingerprinting
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ')         // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word))
    .join(' ');
}

/**
 * Creates n-grams from text
 */
function createNgrams(text: string, n: number = 3): Set<string> {
  const words = text.split(/\s+/);
  const ngrams = new Set<string>();
  
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  
  return ngrams;
}

/**
 * Calculates Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * Creates a semantic fingerprint from text
 */
export function createFingerprint(text: string): string {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).sort();
  
  // Take first 50 unique words as fingerprint
  const uniqueWords = [...new Set(words)].slice(0, 50);
  return uniqueWords.join(' ');
}

/**
 * Calculates similarity between two texts
 */
export function calculateSimilarity(textA: string, textB: string): number {
  const normalizedA = normalizeText(textA);
  const normalizedB = normalizeText(textB);
  
  const ngramsA = createNgrams(normalizedA, 3);
  const ngramsB = createNgrams(normalizedB, 3);
  
  return jaccardSimilarity(ngramsA, ngramsB);
}

/**
 * Checks if new content is similar to existing articles
 */
export function checkSimilarity(
  newContent: string,
  existingArticles: Array<{ id: string; title: string; content: string | null }>,
  threshold: number = 0.85
): SimilarityResult {
  let maxSimilarity = 0;
  let mostSimilarArticle: SimilarityResult['mostSimilarArticle'];

  for (const article of existingArticles) {
    if (!article.content) continue;
    
    const similarity = calculateSimilarity(newContent, article.content);
    
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarArticle = {
        id: article.id,
        title: article.title,
        similarity: Math.round(similarity * 100),
      };
    }
  }

  return {
    isSimilar: maxSimilarity >= threshold,
    similarityScore: Math.round(maxSimilarity * 100),
    mostSimilarArticle: maxSimilarity > 0.5 ? mostSimilarArticle : undefined,
    threshold: Math.round(threshold * 100),
  };
}

/**
 * Checks title similarity (stricter threshold)
 */
export function checkTitleSimilarity(
  newTitle: string,
  existingTitles: Array<{ id: string; title: string }>,
  threshold: number = 0.7
): SimilarityResult {
  let maxSimilarity = 0;
  let mostSimilarArticle: SimilarityResult['mostSimilarArticle'];

  for (const article of existingTitles) {
    const similarity = calculateSimilarity(newTitle, article.title);
    
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarArticle = {
        id: article.id,
        title: article.title,
        similarity: Math.round(similarity * 100),
      };
    }
  }

  return {
    isSimilar: maxSimilarity >= threshold,
    similarityScore: Math.round(maxSimilarity * 100),
    mostSimilarArticle: maxSimilarity > 0.3 ? mostSimilarArticle : undefined,
    threshold: Math.round(threshold * 100),
  };
}
