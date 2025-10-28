import { NextRequest, NextResponse } from 'next/server';
import { getPaperDetails, getCitations, getReferences, getRecommendations } from '@/lib/semanticScholar';
import type { NetworkEdge } from '@/types/paper';

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

    // Fetch main paper, citations, references, and similar papers in parallel
    const [mainPaper, citations, references, recommendations] = await Promise.all([
      getPaperDetails(id),
      getCitations(id, 12),
      getReferences(id, 12),
      includeSimilar ? getRecommendations(id, 10) : Promise.resolve([])
    ]);

    // Build network data
    const papers = new Map();
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

    return NextResponse.json({
      papers: Array.from(papers.values()),
      edges
    });
  } catch (error) {
    console.error('Network API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network data' },
      { status: 500 }
    );
  }
}
