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

export type EdgeType = 'citation' | 'reference' | 'similar';

export interface NetworkEdge {
  source: string;
  target: string;
  type: EdgeType;
  similarity?: number; // For similar edges
}

export interface NetworkData {
  papers: Map<string, Paper>;
  edges: NetworkEdge[];
}

export interface SearchResult {
  total: number;
  data: Paper[];
}
