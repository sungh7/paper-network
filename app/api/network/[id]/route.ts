import { NextRequest, NextResponse } from 'next/server';
import { getPaperDetails, getCitations, getReferences } from '@/lib/semanticScholar';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Paper ID is required' },
        { status: 400 }
      );
    }

    // Fetch main paper and its citations/references in parallel
    const [mainPaper, citations, references] = await Promise.all([
      getPaperDetails(id),
      getCitations(id, 15),
      getReferences(id, 15)
    ]);

    // Build network data
    const papers = new Map();
    papers.set(mainPaper.paperId, mainPaper);

    const edges: Array<{ source: string; target: string }> = [];

    // Add citations (papers that cite this paper)
    citations.forEach(citation => {
      if (citation.paperId) {
        papers.set(citation.paperId, {
          ...citation,
          abstract: undefined // Reduce payload size
        });
        edges.push({
          source: citation.paperId,
          target: mainPaper.paperId
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
          target: reference.paperId
        });
      }
    });

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
