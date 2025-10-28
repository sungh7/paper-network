import { NextRequest, NextResponse } from 'next/server';
import { getPaperDetails } from '@/lib/semanticScholar';

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

    const paper = await getPaperDetails(id);
    return NextResponse.json(paper);
  } catch (error) {
    console.error('Paper API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paper details' },
      { status: 500 }
    );
  }
}
