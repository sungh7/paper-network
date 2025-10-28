'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { NetworkGraph, type LayoutType } from '@/components/NetworkGraph';
import { PaperDetail } from '@/components/PaperDetail';
import { NetworkStats } from '@/components/NetworkStats';
import type { Paper, NetworkEdge } from '@/types/paper';
import {
  calculateNetworkStats,
  calculateDegreeCentrality,
  detectCommunities,
  getTopPapers,
  type Community,
  type CentralityScores
} from '@/lib/networkAnalysis';

interface NetworkData {
  papers: Paper[];
  edges: NetworkEdge[];
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [centerPaperId, setCenterPaperId] = useState<string | null>(null);
  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);
  const [showCitations, setShowCitations] = useState(true);
  const [showReferences, setShowReferences] = useState(true);
  const [showSimilar, setShowSimilar] = useState(true);
  const [layoutType, setLayoutType] = useState<LayoutType>('force');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);

  // Load paper from URL on mount
  useEffect(() => {
    const paperId = searchParams.get('paper');
    if (paperId && !centerPaperId) {
      setCenterPaperId(paperId);
    }
  }, [searchParams, centerPaperId]);

  const { data: networkData, isLoading } = useQuery<NetworkData>({
    queryKey: ['network', centerPaperId],
    queryFn: async () => {
      if (!centerPaperId) return { papers: [], edges: [] };
      const response = await fetch(`/api/network/${centerPaperId}`);
      if (!response.ok) throw new Error('Failed to fetch network');
      return response.json();
    },
    enabled: !!centerPaperId,
  });

  // Filter edges based on selected types
  const filteredNetworkData = useMemo(() => {
    if (!networkData) return null;

    const filteredEdges = networkData.edges.filter(edge => {
      if (edge.type === 'citation' && !showCitations) return false;
      if (edge.type === 'reference' && !showReferences) return false;
      if (edge.type === 'similar' && !showSimilar) return false;
      return true;
    });

    // Get paper IDs that are connected via filtered edges
    const connectedPaperIds = new Set<string>();
    connectedPaperIds.add(centerPaperId!);
    filteredEdges.forEach(edge => {
      connectedPaperIds.add(edge.source);
      connectedPaperIds.add(edge.target);
    });

    // Filter papers to only include connected ones
    const filteredPapers = networkData.papers.filter(paper =>
      connectedPaperIds.has(paper.paperId)
    );

    return {
      papers: filteredPapers,
      edges: filteredEdges
    };
  }, [networkData, showCitations, showReferences, showSimilar, centerPaperId]);

  // Calculate network analysis
  const networkAnalysis = useMemo(() => {
    if (!filteredNetworkData || filteredNetworkData.papers.length === 0) {
      return null;
    }

    const stats = calculateNetworkStats(
      filteredNetworkData.papers,
      filteredNetworkData.edges
    );

    const centrality = calculateDegreeCentrality(
      filteredNetworkData.papers,
      filteredNetworkData.edges
    );

    const communities = detectCommunities(
      filteredNetworkData.papers,
      filteredNetworkData.edges
    );

    const topPapers = getTopPapers(
      filteredNetworkData.papers,
      centrality,
      5
    );

    return {
      stats,
      centrality,
      communities,
      topPapers
    };
  }, [filteredNetworkData]);

  const handlePaperSelect = (paper: Paper) => {
    setSelectedPaper(paper);
    setCenterPaperId(paper.paperId);
    setDetailPaper(paper);
    // Update URL
    router.push(`?paper=${paper.paperId}`, { scroll: false });
  };

  const handleNodeClick = (paper: Paper) => {
    setDetailPaper(paper);
  };

  const handleNodeDoubleClick = (paper: Paper) => {
    // Expand network around the double-clicked paper
    setCenterPaperId(paper.paperId);
    setSelectedPaper(paper);
    setDetailPaper(paper);
    // Update URL
    router.push(`?paper=${paper.paperId}`, { scroll: false });
  };

  const handleShareUrl = () => {
    if (!centerPaperId) return;
    const url = `${window.location.origin}?paper=${centerPaperId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('URL이 클립보드에 복사되었습니다!');
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Paper Network
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            인용 관계와 유사도 기반으로 논문 네트워크를 시각화하고 탐색하세요
          </p>
        </div>

        <SearchBar onPaperSelect={handlePaperSelect} />

        {isLoading && (
          <div className="text-center mt-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">네트워크 데이터를 불러오는 중...</p>
          </div>
        )}

        {filteredNetworkData && filteredNetworkData.papers.length > 0 && !isLoading && (
          <>
            {/* Filter Controls */}
            <div className="mt-6 flex justify-center gap-4 flex-wrap items-center">
              {/* Layout Toggle */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">레이아웃:</span>
                <button
                  onClick={() => setLayoutType('force')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    layoutType === 'force'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  네트워크
                </button>
                <button
                  onClick={() => setLayoutType('timeline')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    layoutType === 'timeline'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  타임라인
                </button>
              </div>

              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow">
                <input
                  type="checkbox"
                  checked={showCitations}
                  onChange={(e) => setShowCitations(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="w-4 h-0.5 bg-emerald-500"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  인용 ({networkData?.edges.filter(e => e.type === 'citation').length || 0})
                </span>
              </label>

              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow">
                <input
                  type="checkbox"
                  checked={showReferences}
                  onChange={(e) => setShowReferences(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="w-4 h-0.5 bg-indigo-500"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  참조 ({networkData?.edges.filter(e => e.type === 'reference').length || 0})
                </span>
              </label>

              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow">
                <input
                  type="checkbox"
                  checked={showSimilar}
                  onChange={(e) => setShowSimilar(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500"></span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  유사 ({networkData?.edges.filter(e => e.type === 'similar').length || 0})
                </span>
              </label>

              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

              <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow">
                <input
                  type="checkbox"
                  checked={showCommunities}
                  onChange={(e) => setShowCommunities(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  커뮤니티 색상
                </span>
              </label>

              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow hover:shadow-md transition-all font-medium"
                title="네트워크 분석"
              >
                📊 분석
              </button>

              <button
                onClick={handleShareUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow hover:shadow-md transition-all font-medium"
                title="URL 공유"
              >
                🔗 공유
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[600px]">
                <NetworkGraph
                  papers={filteredNetworkData.papers}
                  edges={filteredNetworkData.edges}
                  centerPaperId={centerPaperId!}
                  onNodeClick={handleNodeClick}
                  onNodeDoubleClick={handleNodeDoubleClick}
                  layout={layoutType}
                  communities={networkAnalysis?.communities}
                  centralityScores={networkAnalysis?.centrality}
                  showCommunities={showCommunities}
                />
              </div>
              <div className="lg:col-span-1 h-[600px]">
                {showAnalysis && networkAnalysis ? (
                  <NetworkStats
                    stats={networkAnalysis.stats}
                    topPapers={networkAnalysis.topPapers}
                    onClose={() => setShowAnalysis(false)}
                  />
                ) : (
                  <PaperDetail
                    paper={detailPaper}
                    onClose={() => setDetailPaper(null)}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {!centerPaperId && !isLoading && (
          <div className="mt-12 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="mx-auto h-24 w-24 mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-lg">논문을 검색하여 인용 네트워크를 시각화해보세요</p>
          </div>
        )}
      </main>

      <footer className="mt-16 mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Powered by Semantic Scholar API • Built with Next.js & Cytoscape.js</p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
