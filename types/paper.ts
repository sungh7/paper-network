export interface Paper {
  paperId: string;
  title: string;
  authors: Author[];
  year: number;
  abstract?: string;
  citationCount: number;
  referenceCount: number;
  url?: string;
  venue?: string;
  publicationDate?: string;
}

export interface Author {
  authorId?: string;
  name: string;
}

export interface Citation {
  paperId: string;
  title: string;
  authors: Author[];
  year: number;
  citationCount: number;
}

export interface NetworkData {
  papers: Map<string, Paper>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}

export interface SearchResult {
  total: number;
  data: Paper[];
}
