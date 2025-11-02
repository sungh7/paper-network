import type { Paper } from '@/types/paper';

// Common stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'we', 'this', 'these', 'those', 'can', 'been', 'have', 'had', 'which', 'their',
  'our', 'or', 'not', 'but', 'such', 'through', 'over', 'into', 'also', 'using',
  'used', 'use', 'may', 'more', 'than', 'other', 'based', 'well', 'how', 'when',
  'where', 'why', 'what', 'they', 'them', 'then', 'there', 'here', 'all', 'both',
  'each', 'few', 'most', 'some', 'very', 'much', 'many', 'paper', 'study', 'research',
  'results', 'approach', 'method', 'methods', 'however', 'therefore', 'thus', 'furthermore'
]);

export interface KeywordCount {
  keyword: string;
  count: number;
  papers: string[]; // paper IDs
}

export interface KeywordsByYear {
  year: number;
  keywords: Map<string, number>;
}

export interface AuthorStats {
  name: string;
  paperCount: number;
  papers: string[]; // paper IDs
  totalCitations: number;
}

/**
 * Extract keywords from paper titles and abstracts
 */
export function extractKeywords(papers: Paper[], minLength = 3, maxKeywords = 50): KeywordCount[] {
  const keywordMap = new Map<string, Set<string>>();

  papers.forEach(paper => {
    // Combine title and abstract (if available)
    const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();

    // Split into words, remove punctuation and numbers
    const words = text
      .replace(/[^a-z\s-]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length >= minLength &&
        !STOPWORDS.has(word) &&
        !/^\d+$/.test(word) // exclude pure numbers
      );

    // Count unique words for this paper
    const uniqueWords = new Set(words);
    uniqueWords.forEach(word => {
      if (!keywordMap.has(word)) {
        keywordMap.set(word, new Set());
      }
      keywordMap.get(word)!.add(paper.paperId);
    });
  });

  // Convert to array and sort by frequency
  const keywords: KeywordCount[] = Array.from(keywordMap.entries())
    .map(([keyword, paperIds]) => ({
      keyword,
      count: paperIds.size,
      papers: Array.from(paperIds)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxKeywords);

  return keywords;
}

/**
 * Analyze keyword trends by year
 */
export function analyzeKeywordTrends(papers: Paper[], topN = 10): KeywordsByYear[] {
  // First get overall top keywords
  const topKeywords = extractKeywords(papers, 3, topN).map(k => k.keyword);

  // Group papers by year
  const papersByYear = new Map<number, Paper[]>();
  papers.forEach(paper => {
    if (paper.year) {
      if (!papersByYear.has(paper.year)) {
        papersByYear.set(paper.year, []);
      }
      papersByYear.get(paper.year)!.push(paper);
    }
  });

  // Calculate keyword frequency per year
  const trendData: KeywordsByYear[] = [];
  papersByYear.forEach((yearPapers, year) => {
    const keywords = new Map<string, number>();

    topKeywords.forEach(keyword => {
      const count = yearPapers.filter(paper => {
        const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
        return text.includes(keyword);
      }).length;

      if (count > 0) {
        keywords.set(keyword, count);
      }
    });

    trendData.push({ year, keywords });
  });

  return trendData.sort((a, b) => a.year - b.year);
}

/**
 * Analyze author statistics
 */
export function analyzeAuthors(papers: Paper[], topN = 10): AuthorStats[] {
  const authorMap = new Map<string, {
    paperIds: Set<string>;
    totalCitations: number;
  }>();

  papers.forEach(paper => {
    if (paper.authors && paper.authors.length > 0) {
      paper.authors.forEach(author => {
        const authorName = author.name;
        if (!authorMap.has(authorName)) {
          authorMap.set(authorName, {
            paperIds: new Set(),
            totalCitations: 0
          });
        }
        const stats = authorMap.get(authorName)!;
        stats.paperIds.add(paper.paperId);
        stats.totalCitations += paper.citationCount || 0;
      });
    }
  });

  // Convert to array and sort
  const authors: AuthorStats[] = Array.from(authorMap.entries())
    .map(([name, stats]) => ({
      name,
      paperCount: stats.paperIds.size,
      papers: Array.from(stats.paperIds),
      totalCitations: stats.totalCitations
    }))
    .sort((a, b) => b.paperCount - a.paperCount)
    .slice(0, topN);

  return authors;
}

/**
 * Calculate keyword co-occurrence
 */
export function calculateKeywordCooccurrence(
  papers: Paper[],
  topKeywords: string[],
  minCooccurrence = 2
): Map<string, Map<string, number>> {
  const cooccurrence = new Map<string, Map<string, number>>();

  // Initialize
  topKeywords.forEach(kw => {
    cooccurrence.set(kw, new Map());
  });

  papers.forEach(paper => {
    const text = `${paper.title} ${paper.abstract || ''}`.toLowerCase();
    const presentKeywords = topKeywords.filter(kw => text.includes(kw));

    // Record co-occurrences
    for (let i = 0; i < presentKeywords.length; i++) {
      for (let j = i + 1; j < presentKeywords.length; j++) {
        const kw1 = presentKeywords[i];
        const kw2 = presentKeywords[j];

        const map1 = cooccurrence.get(kw1)!;
        map1.set(kw2, (map1.get(kw2) || 0) + 1);

        const map2 = cooccurrence.get(kw2)!;
        map2.set(kw1, (map2.get(kw1) || 0) + 1);
      }
    }
  });

  // Filter by minimum co-occurrence
  cooccurrence.forEach((related, keyword) => {
    const filtered = new Map(
      Array.from(related.entries()).filter(([_, count]) => count >= minCooccurrence)
    );
    cooccurrence.set(keyword, filtered);
  });

  return cooccurrence;
}
