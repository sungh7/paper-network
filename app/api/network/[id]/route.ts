import { NextRequest, NextResponse } from 'next/server';
import { getPaperDetails, getCitations, getReferences, getRecommendations } from '@/lib/semanticScholar';
import type { NetworkEdge, Paper } from '@/types/paper';

interface CacheEntry {
  value: {
    papers: Paper[];
    edges: NetworkEdge[];
  };
  expiresAt: number;
}

type NetworkCache = Map<string, CacheEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __networkCache: NetworkCache | undefined;
}

const networkCache: NetworkCache = globalThis.__networkCache ?? new Map();
if (!globalThis.__networkCache) {
  globalThis.__networkCache = networkCache;
}

const NETWORK_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeSimilar = searchParams.get('includeSimilar') !== 'false'; // Default true

    if (!id) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      );
    }

    const cacheKey = `${id}:${includeSimilar ? 'similar' : 'core'}`;
    const cached = networkCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.value);
    }
    if (cached && cached.expiresAt <= Date.now()) {
      networkCache.delete(cacheKey);
    }

    // Fetch main paper, citations, references, and similar papers in parallel
    const [mainPaper, citations, references, recommendations] = await Promise.all([
      getPaperDetails(id),
      getCitations(id, 12),
      getReferences(id, 12),
      includeSimilar ? getRecommendations(id, 10) : Promise.resolve([])
    ]);

    // Build network data
    const papers = new Map<string, Paper>();
    papers.set(mainPaper.paperId, mainPaper);

    const edges: NetworkEdge[] = [];

    // Add citations (papers that cite this paper)
    citations.forEach(citation => {
      if (citation.paperId) {
        papers.set(citation.paperId, {
          ...citation,
          abstract: undefined // Reduce payload size
        });
        edges.push({
          source: citation.paperId,
          target: mainPaper.paperId,
          type: 'citation'
        });
      }
    });

    // Add references (papers this paper cites)
    references.forEach(reference => {
      if (reference.paperId) {
        papers.set(reference.paperId, {
          ...reference,
          abstract: undefined // Reduce payload size
        });
        edges.push({
          source: mainPaper.paperId,
          target: reference.paperId,
          type: 'reference'
        });
      }
    });

    // Add similar papers (recommendations based on content similarity)
    if (includeSimilar && Array.isArray(recommendations)) {
      recommendations.forEach(similar => {
        if (similar.paperId && !papers.has(similar.paperId)) {
          papers.set(similar.paperId, {
            ...similar,
            abstract: undefined // Reduce payload size
          });
          edges.push({
            source: mainPaper.paperId,
            target: similar.paperId,
            type: 'similar'
          });
        }
      });
    }

    const payload = {
      papers: Array.from(papers.values()),
      edges
    };

    networkCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + NETWORK_CACHE_TTL
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Network API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network data' },
      { status: 500 }
    );
  }
}
