'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
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
  calculateBetweennessCentrality,
  detectCommunities,
  findShortestPath,
  getTopPapers,
  type Community,
  type CentralityScores
} from '@/lib/networkAnalysis';

interface NetworkData {
  papers: Paper[];
  edges: NetworkEdge[];
}

interface FilteredNetworkData extends NetworkData {
  hiddenPaperCount: number;
  hiddenEdgeCount: number;
  effectiveTimelineYear: number | null;
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
  const [highlightPath, setHighlightPath] = useState<string[] | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<string[] | null>(null);
  const [focusPaperId, setFocusPaperId] = useState<string | null>(null);
  const [timelineYear, setTimelineYear] = useState<number | null>(null);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const isApplyingParams = useRef(false);
  const lastSerializedParams = useRef('');

  // Load paper from URL on mount
  useEffect(() => {
    isApplyingParams.current = true;

    const paperId = searchParams.get('paper');
    if (paperId && paperId !== centerPaperId) {
      setCenterPaperId(paperId);
    }
    if (!paperId && centerPaperId) {
      setCenterPaperId(null);
    }

    const layoutParam = searchParams.get('layout') === 'timeline' ? 'timeline' : 'force';
    if (layoutParam !== layoutType) {
      setLayoutType(layoutParam);
    }

    const citationsParam = searchParams.get('citations');
    const referencesParam = searchParams.get('references');
    const similarParam = searchParams.get('similar');
    const communitiesParam = searchParams.get('communities');
    const analysisParam = searchParams.get('analysis');

    const nextShowCitations = citationsParam !== '0';
    if (nextShowCitations !== showCitations) {
      setShowCitations(nextShowCitations);
    }

    const nextShowReferences = referencesParam !== '0';
    if (nextShowReferences !== showReferences) {
      setShowReferences(nextShowReferences);
    }

    const nextShowSimilar = similarParam !== '0';
    if (nextShowSimilar !== showSimilar) {
      setShowSimilar(nextShowSimilar);
    }

    const nextShowCommunities = communitiesParam === '1';
    if (nextShowCommunities !== showCommunities) {
      setShowCommunities(nextShowCommunities);
    }

    const nextShowAnalysis = analysisParam === '1';
    if (nextShowAnalysis !== showAnalysis) {
      setShowAnalysis(nextShowAnalysis);
    }

    const yearParam = searchParams.get('year');
    if (layoutParam === 'timeline' && yearParam) {
      const parsedYear = Number(yearParam);
      if (!Number.isNaN(parsedYear) && parsedYear !== timelineYear) {
        setTimelineYear(parsedYear);
      }
    }

    if (layoutParam !== 'timeline' && timelineYear !== null) {
      setTimelineYear(null);
    }

    lastSerializedParams.current = searchParams.toString();
    isApplyingParams.current = false;
  }, [searchParams, centerPaperId, layoutType, showCitations, showReferences, showSimilar, showCommunities, showAnalysis, timelineYear]);

  useEffect(() => {
    if (isApplyingParams.current) return;

    const params = new URLSearchParams();
    if (centerPaperId) {
      params.set('paper', centerPaperId);
    }
    if (layoutType !== 'force') {
      params.set('layout', layoutType);
    }
    if (!showCitations) {
      params.set('citations', '0');
    }
    if (!showReferences) {
      params.set('references', '0');
    }
    if (!showSimilar) {
      params.set('similar', '0');
    }
    if (showCommunities) {
      params.set('communities', '1');
    }
    if (showAnalysis) {
      params.set('analysis', '1');
    }
    if (layoutType === 'timeline' && yearInfo && effectiveTimelineYear !== null && effectiveTimelineYear !== yearInfo.max) {
      params.set('year', String(effectiveTimelineYear));
    }

    const serialized = params.toString();
    if (serialized !== lastSerializedParams.current) {
      lastSerializedParams.current = serialized;
      const search = serialized ? `?${serialized}` : '?';
      if (search !== `?${searchParams.toString()}`) {
        router.replace(search, { scroll: false });
      }
    }
  }, [centerPaperId, layoutType, showCitations, showReferences, showSimilar, showCommunities, showAnalysis, router, searchParams, yearInfo, effectiveTimelineYear]);

  const { data: networkData, isLoading } = useQuery<NetworkData>({
    queryKey: ['network', centerPaperId, showSimilar],
    queryFn: async () => {
      if (!centerPaperId) return { papers: [], edges: [] };
      const params = new URLSearchParams();
      if (!showSimilar) {
        params.set('includeSimilar', 'false');
      }
      const suffix = params.toString();
      const response = await fetch(`/api/network/${centerPaperId}${suffix ? `?${suffix}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch network');
      return response.json();
    },
    enabled: !!centerPaperId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  // Filter edges based on selected types
  const baseNetworkData = useMemo<NetworkData | null>(() => {
    if (!networkData || !centerPaperId) return null;

    const filteredEdges = networkData.edges.filter(edge => {
      if (edge.type === 'citation' && !showCitations) return false;
      if (edge.type === 'reference' && !showReferences) return false;
      if (edge.type === 'similar' && !showSimilar) return false;
      return true;
    });

    const connectedPaperIds = new Set<string>();
    connectedPaperIds.add(centerPaperId);
    filteredEdges.forEach(edge => {
      connectedPaperIds.add(edge.source);
      connectedPaperIds.add(edge.target);
    });

    const filteredPapers = networkData.papers.filter(paper =>
      connectedPaperIds.has(paper.paperId)
    );

    return {
      papers: filteredPapers,
      edges: filteredEdges
    };
  }, [networkData, showCitations, showReferences, showSimilar, centerPaperId]);

  const yearInfo = useMemo(() => {
    if (!baseNetworkData || baseNetworkData.papers.length === 0) {
      return null;
    }

    const validYears = baseNetworkData.papers
      .map(paper => paper.year)
      .filter(year => Number.isFinite(year));

    if (validYears.length === 0) {
      return null;
    }

    const min = Math.min(...validYears);
    const max = Math.max(...validYears);

    return { min, max };
  }, [baseNetworkData]);

  useEffect(() => {
    if (!yearInfo) {
      if (timelineYear !== null) {
        setTimelineYear(null);
      }
      if (isTimelinePlaying) {
        setIsTimelinePlaying(false);
      }
      return;
    }

    if (timelineYear === null) {
      setTimelineYear(yearInfo.max);
      return;
    }

    if (timelineYear < yearInfo.min) {
      setTimelineYear(yearInfo.min);
    } else if (timelineYear > yearInfo.max) {
      setTimelineYear(yearInfo.max);
    }
  }, [yearInfo, timelineYear, isTimelinePlaying]);

  useEffect(() => {
    if (layoutType !== 'timeline' && isTimelinePlaying) {
      setIsTimelinePlaying(false);
    }
  }, [layoutType, isTimelinePlaying]);

  useEffect(() => {
    if (!isTimelinePlaying || layoutType !== 'timeline' || !yearInfo) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimelineYear(prev => {
        const current = prev ?? yearInfo.min;
        if (current >= yearInfo.max) {
          setIsTimelinePlaying(false);
          return yearInfo.max;
        }
        const next = Math.min(current + 1, yearInfo.max);
        if (next >= yearInfo.max) {
          setIsTimelinePlaying(false);
        }
        return next;
      });
    }, 1200);

    return () => {
      window.clearInterval(interval);
    };
  }, [isTimelinePlaying, layoutType, yearInfo]);

  const effectiveTimelineYear = useMemo(() => {
    if (layoutType !== 'timeline' || !yearInfo) {
      return null;
    }
    const target = timelineYear ?? yearInfo.max;
    return Math.min(Math.max(target, yearInfo.min), yearInfo.max);
  }, [layoutType, timelineYear, yearInfo]);

  const filteredNetworkData = useMemo<FilteredNetworkData | null>(() => {
    if (!baseNetworkData) {
      return null;
    }

    if (effectiveTimelineYear === null) {
      return {
        papers: baseNetworkData.papers,
        edges: baseNetworkData.edges,
        hiddenPaperCount: 0,
        hiddenEdgeCount: 0,
        effectiveTimelineYear: null,
      };
    }

    const visiblePapers = baseNetworkData.papers.filter(paper => {
      if (!Number.isFinite(paper.year)) return true;
      return paper.year <= effectiveTimelineYear;
    });

    const visiblePaperIds = new Set(visiblePapers.map(paper => paper.paperId));
    const visibleEdges = baseNetworkData.edges.filter(edge =>
      visiblePaperIds.has(edge.source) && visiblePaperIds.has(edge.target)
    );

    return {
      papers: visiblePapers,
      edges: visibleEdges,
      hiddenPaperCount: baseNetworkData.papers.length - visiblePapers.length,
      hiddenEdgeCount: baseNetworkData.edges.length - visibleEdges.length,
      effectiveTimelineYear,
    };
  }, [baseNetworkData, effectiveTimelineYear]);

  const effectiveTimelineYearValue = filteredNetworkData?.effectiveTimelineYear ?? yearInfo?.max ?? null;
  const hiddenPaperCount = filteredNetworkData?.hiddenPaperCount ?? 0;
  const hiddenEdgeCount = filteredNetworkData?.hiddenEdgeCount ?? 0;

  const handleTimelinePlayToggle = useCallback(() => {
    if (!yearInfo) return;
    if (!isTimelinePlaying) {
      const current = filteredNetworkData?.effectiveTimelineYear ?? yearInfo.max;
      if (current >= yearInfo.max) {
        setTimelineYear(yearInfo.min);
      }
      setIsTimelinePlaying(true);
    } else {
      setIsTimelinePlaying(false);
    }
  }, [filteredNetworkData, isTimelinePlaying, yearInfo]);

  const handleTimelineReset = useCallback(() => {
    if (!yearInfo) return;
    setIsTimelinePlaying(false);
    setTimelineYear(yearInfo.max);
  }, [yearInfo]);

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

    const betweenness = calculateBetweennessCentrality(
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

    const topBetweenness = getTopPapers(
      filteredNetworkData.papers,
      betweenness,
      5
    );

    return {
      stats,
      centrality,
      betweenness,
      communities,
      topPapers,
      topBetweenness
    };
  }, [filteredNetworkData]);

  const handlePaperSelect = (paper: Paper) => {
    setSelectedPaper(paper);
    setCenterPaperId(paper.paperId);
    setDetailPaper(paper);
    setHighlightPath(null);
    setHighlightNodes(null);
    setFocusPaperId(paper.paperId);
  };

  const handleNodeClick = (paper: Paper) => {
    setDetailPaper(paper);
    setHighlightPath(null);
    setHighlightNodes([paper.paperId]);
    setFocusPaperId(paper.paperId);
  };

  const handleNodeDoubleClick = (paper: Paper) => {
    // Expand network around the double-clicked paper
    setCenterPaperId(paper.paperId);
    setSelectedPaper(paper);
    setDetailPaper(paper);
    setHighlightPath(null);
    setHighlightNodes(null);
    setFocusPaperId(paper.paperId);
  };

  const handleShareUrl = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('URL이 클립보드에 복사되었습니다!');
    });
  };

  const handleHighlightPath = useCallback((path: string[] | null) => {
    setHighlightPath(path);
    setHighlightNodes(path);
    if (!path || path.length === 0) {
      setFocusPaperId(null);
    }
  }, []);

  const handleHighlightNodes = useCallback((nodes: string[] | null) => {
    setHighlightNodes(nodes);
    if (!nodes || nodes.length === 0) {
      setFocusPaperId(null);
    }
  }, []);

  const handleFocusPaper = useCallback((paperId: string | null) => {
    setFocusPaperId(paperId);
  }, []);

  useEffect(() => {
    setHighlightPath(null);
    setHighlightNodes(null);
    setFocusPaperId(centerPaperId);
  }, [centerPaperId, showCitations, showReferences, showSimilar]);

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

              {layoutType === 'timeline' && yearInfo && effectiveTimelineYearValue !== null && (
                <div className="flex flex-col gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow min-w-[260px]">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{yearInfo.min}</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {effectiveTimelineYearValue}년까지 표시
                    </span>
                    <span>{yearInfo.max}</span>
                  </div>
                  <input
                    type="range"
                    min={yearInfo.min}
                    max={yearInfo.max}
                    step={1}
                    value={effectiveTimelineYearValue}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isNaN(value)) {
                        setIsTimelinePlaying(false);
                        setTimelineYear(value);
                      }
                    }}
                    className="w-full accent-blue-600"
                    aria-label="타임라인 연도 선택"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <button
                      onClick={handleTimelinePlayToggle}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                      type="button"
                    >
                      {isTimelinePlaying ? '⏸️ 일시정지' : '▶️ 재생'}
                    </button>
                    <button
                      onClick={handleTimelineReset}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      disabled={effectiveTimelineYearValue === yearInfo.max && hiddenPaperCount === 0}
                    >
                      ↺ 전체 보기
                    </button>
                    {hiddenPaperCount > 0 && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        숨김 논문 {hiddenPaperCount}편 · 연결 {hiddenEdgeCount}개
                      </span>
                    )}
                  </div>
                </div>
              )}

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
                  highlightPath={highlightPath ?? undefined}
                  highlightNodes={highlightNodes ?? undefined}
                  focusPaperId={focusPaperId ?? undefined}
                />
              </div>
              <div className="lg:col-span-1 h-[600px]">
                {showAnalysis && networkAnalysis ? (
                  <NetworkStats
                    stats={networkAnalysis.stats}
                    topPapers={networkAnalysis.topPapers}
                    betweennessTop={networkAnalysis.topBetweenness}
                    centrality={networkAnalysis.centrality}
                    betweenness={networkAnalysis.betweenness}
                    communities={networkAnalysis.communities}
                    papers={filteredNetworkData.papers}
                    edges={filteredNetworkData.edges}
                    timelineBounds={yearInfo ?? null}
                    timelineYear={filteredNetworkData.effectiveTimelineYear ?? null}
                    hiddenPaperCount={hiddenPaperCount}
                    hiddenEdgeCount={hiddenEdgeCount}
                    onHighlightPath={handleHighlightPath}
                    onHighlightNodes={handleHighlightNodes}
                    onClose={() => {
                      setShowAnalysis(false);
                      setHighlightNodes(null);
                      setHighlightPath(null);
                      setFocusPaperId(centerPaperId);
                    }}
                    onFocusPaper={handleFocusPaper}
                    onRequestPaperDetail={(paper) => {
                      setDetailPaper(paper);
                      setShowAnalysis(false);
                      setHighlightNodes([paper.paperId]);
                      setHighlightPath(null);
                      setFocusPaperId(paper.paperId);
                    }}
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
