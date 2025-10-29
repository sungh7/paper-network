'use client';

import { useMemo, useState } from 'react';
import type { Paper, NetworkEdge } from '@/types/paper';
import type { NetworkStats as Stats, CentralityScores, Community } from '@/lib/networkAnalysis';
import { findShortestPath } from '@/lib/networkAnalysis';

interface NetworkStatsProps {
  stats: Stats | null;
  topPapers: Paper[];
  betweennessTop: Paper[];
  centrality: CentralityScores;
  betweenness: CentralityScores;
  communities: Community[];
  papers: Paper[];
  edges: NetworkEdge[];
  onHighlightPath: (path: string[] | null) => void;
  onHighlightNodes: (nodes: string[] | null) => void;
  onClose: () => void;
  onFocusPaper?: (paperId: string | null) => void;
  onRequestPaperDetail?: (paper: Paper) => void;
  timelineBounds?: { min: number; max: number } | null;
  timelineYear?: number | null;
  hiddenPaperCount?: number;
  hiddenEdgeCount?: number;
}

export function NetworkStats({
  stats,
  topPapers,
  betweennessTop,
  centrality,
  betweenness,
  communities,
  papers,
  edges,
  onHighlightPath,
  onHighlightNodes,
  onClose,
  onFocusPaper,
  onRequestPaperDetail,
  timelineBounds,
  timelineYear,
  hiddenPaperCount,
  hiddenEdgeCount,
}: NetworkStatsProps) {
  const [pathStart, setPathStart] = useState('');
  const [pathEnd, setPathEnd] = useState('');
  const [pathResult, setPathResult] = useState<Paper[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);
  const [inspectedPaper, setInspectedPaper] = useState<Paper | null>(null);

  const sortedPapers = useMemo(() => {
    return [...papers].sort((a, b) => a.title.localeCompare(b.title));
  }, [papers]);

  const paperLookup = useMemo(() => {
    return new Map(papers.map((paper) => [paper.paperId, paper]));
  }, [papers]);

  const communityStats = useMemo(() => {
    return communities.map((community) => ({
      ...community,
      size: community.papers.length,
    }));
  }, [communities]);

  const edgeBreakdown = useMemo(() => {
    return edges.reduce(
      (acc, edge) => {
        acc.total += 1;
        acc[edge.type] += 1;
        return acc;
      },
      { citation: 0, reference: 0, similar: 0, total: 0 }
    );
  }, [edges]);

  const showTimelineContext = Boolean(timelineBounds && timelineYear !== null);
  const hiddenSummaryActive = (hiddenPaperCount ?? 0) > 0 || (hiddenEdgeCount ?? 0) > 0;

  if (!stats) return null;

  const handleFindPath = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pathStart || !pathEnd) {
      setPathError('시작 논문과 도착 논문을 모두 선택해주세요.');
      return;
    }
    if (pathStart === pathEnd) {
      const singlePaper = paperLookup.get(pathStart);
      if (singlePaper) {
        setPathResult([singlePaper]);
        setPathError(null);
        onHighlightPath([pathStart]);
        onHighlightNodes([pathStart]);
      }
      return;
    }

    const path = findShortestPath(papers, edges, pathStart, pathEnd);
    if (!path || path.length === 0) {
      setPathResult([]);
      setPathError('선택한 두 논문 사이의 경로를 찾을 수 없습니다.');
      onHighlightPath(null);
      onHighlightNodes(null);
      return;
    }

    const mapped = path
      .map((paperId) => paperLookup.get(paperId))
      .filter((paper): paper is Paper => Boolean(paper));

    setPathResult(mapped);
    setPathError(null);
    onHighlightPath(path);
    onHighlightNodes(path);
  };

  const handleClearPath = () => {
    setPathStart('');
    setPathEnd('');
    setPathResult([]);
    setPathError(null);
    onHighlightPath(null);
    onHighlightNodes(null);
  };

  const formatScore = (scores: CentralityScores, paperId: string) => {
    return ((scores[paperId] ?? 0) * 100).toFixed(1);
  };

  const handleInspectPaper = (paper: Paper) => {
    setInspectedPaper(paper);
    onHighlightNodes([paper.paperId]);
    onHighlightPath(null);
    onFocusPaper?.(paper.paperId);
  };

  const handleOpenDetail = (paper: Paper) => {
    onRequestPaperDetail?.(paper);
  };

  const toCsvValue = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '""';
    const stringValue = String(value).replace(/"/g, '""');
    return `"${stringValue}"`;
  };

  const persistDownload = (content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        paperCount: stats.totalPapers,
        edgeCount: stats.totalEdges,
        componentCount: stats.componentCount,
      },
      papers,
      edges,
    };
    persistDownload(
      JSON.stringify(payload, null, 2),
      'application/json',
      `paper-network-${Date.now()}.json`
    );
  };

  const handleExportNodesCsv = () => {
    const header = 'paperId,title,year,citationCount,referenceCount,venue,authors';
    const rows = papers.map(paper => {
      const authors = paper.authors.map(author => author.name).join('; ');
      return [
        toCsvValue(paper.paperId),
        toCsvValue(paper.title),
        toCsvValue(paper.year ?? ''),
        toCsvValue(paper.citationCount ?? 0),
        toCsvValue(paper.referenceCount ?? 0),
        toCsvValue(paper.venue ?? ''),
        toCsvValue(authors)
      ].join(',');
    });
    persistDownload(
      [header, ...rows].join('\n'),
      'text/csv',
      `paper-network-nodes-${Date.now()}.csv`
    );
  };

  const handleExportEdgesCsv = () => {
    const header = 'source,target,type,similarity';
    const rows = edges.map(edge => (
      [
        toCsvValue(edge.source),
        toCsvValue(edge.target),
        toCsvValue(edge.type),
        toCsvValue(edge.similarity ?? '')
      ].join(',')
    ));
    persistDownload(
      [header, ...rows].join('\n'),
      'text/csv',
      `paper-network-edges-${Date.now()}.csv`
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto max-h-[600px]">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          네트워크 분석
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      {showTimelineContext && timelineBounds && timelineYear !== null && (
        <div className="mb-6 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-900/20 p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
            {timelineBounds.min}–{timelineBounds.max}년 범위 중{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-100">{timelineYear}년</span>
            까지의 데이터만 표시하고 있습니다.
          </p>
          {hiddenSummaryActive && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              숨겨진 논문 {hiddenPaperCount ?? 0}편 · 연결 {hiddenEdgeCount ?? 0}개
            </p>
          )}
        </div>
      )}

      {/* Basic Stats */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          기본 통계
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalPapers}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">논문 수</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalEdges}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">연결 수</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.avgCitations.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">평균 인용</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.avgReferences.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">평균 참고문헌</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.avgDegree.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">평균 연결도</div>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {stats.componentCount}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">연결 컴포넌트</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.avgPathLength.toFixed(2)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">평균 최단 거리</div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.diameter.toFixed(0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">네트워크 지름</div>
          </div>
        </div>
      </div>

      {/* Network Metrics */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          네트워크 지표
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">밀도</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {(stats.density * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">연도 범위</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {stats.yearRange.min} - {stats.yearRange.max}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">기간</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {stats.yearRange.max - stats.yearRange.min + 1}년
            </span>
          </div>
        </div>
      </div>

      {/* Edge composition */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          연결 구성
        </h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <span>인용</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-300">
              {edgeBreakdown.citation}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>참조</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-300">
              {edgeBreakdown.reference}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>유사</span>
            <span className="font-medium text-amber-600 dark:text-amber-300">
              {edgeBreakdown.similar}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700 text-xs">
            <span>전체 연결</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {edgeBreakdown.total}
            </span>
          </div>
        </div>
      </div>

      {/* Top Papers by Degree Centrality */}
      {topPapers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            중요 논문 (연결 중심성 기준)
          </h3>
          <div className="space-y-2">
            {topPapers.map((paper, index) => (
              <button
                key={paper.paperId}
                type="button"
                onClick={() => handleInspectPaper(paper)}
                className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.title}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {paper.year} • {paper.citationCount} 인용
                      </div>
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-300">
                        중심성 {formatScore(centrality, paper.paperId)}%
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Betweenness Centrality */}
      {betweennessTop.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            중개 중심성 Top {betweennessTop.length}
          </h3>
          <div className="space-y-2">
            {betweennessTop.map((paper, index) => (
              <button
                key={`${paper.paperId}-betweenness`}
                type="button"
                onClick={() => handleInspectPaper(paper)}
                className="w-full text-left p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/40 hover:border-amber-500/60 dark:hover:border-amber-500/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-amber-800 dark:text-amber-200 truncate">
                      {paper.title}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        {paper.year} • {paper.citationCount} 인용
                      </div>
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                        중개 {formatScore(betweenness, paper.paperId)}%
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Communities */}
      {communityStats.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            커뮤니티 구성
          </h3>
          <div className="space-y-2">
            {communityStats.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => {
                  const members = community.papers;
                  if (members.length === 0) {
                    onHighlightNodes(null);
                    onHighlightPath(null);
                    onFocusPaper?.(null);
                    return;
                  }
                  onHighlightNodes(members);
                  onHighlightPath(null);
                  onFocusPaper?.(members[0] ?? null);
                }}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex w-3 h-3 rounded-full"
                    style={{ backgroundColor: community.color }}
                    aria-hidden
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    커뮤니티 {community.id + 1}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {community.size}편
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected paper insight */}
      {inspectedPaper && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white leading-snug">
                {inspectedPaper.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {inspectedPaper.authors.map(author => author.name).join(', ')} • {inspectedPaper.year}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                인용 {inspectedPaper.citationCount} • 참고문헌 {inspectedPaper.referenceCount}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onHighlightNodes([inspectedPaper.paperId]);
                  onHighlightPath(null);
                  onFocusPaper?.(inspectedPaper.paperId);
                }}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                그래프 강조
              </button>
              <button
                type="button"
                onClick={() => handleOpenDetail(inspectedPaper)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 text-xs font-semibold"
              >
                상세 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortest Path */}
      {papers.length > 1 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            두 논문 간 최단 경로 탐색
          </h3>
          <form onSubmit={handleFindPath} className="space-y-3">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                시작 논문
              </label>
              <select
                value={pathStart}
                onChange={(event) => setPathStart(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택해주세요</option>
                {sortedPapers.map((paper) => (
                  <option key={`start-${paper.paperId}`} value={paper.paperId}>
                    {paper.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                도착 논문
              </label>
              <select
                value={pathEnd}
                onChange={(event) => setPathEnd(event.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택해주세요</option>
                {sortedPapers.map((paper) => (
                  <option key={`end-${paper.paperId}`} value={paper.paperId}>
                    {paper.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                경로 찾기
              </button>
              <button
                type="button"
                onClick={handleClearPath}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm"
              >
                초기화
              </button>
            </div>
          </form>

          {pathError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 text-xs text-red-600 dark:text-red-300 rounded-lg">
              {pathError}
            </div>
          )}

          {pathResult.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                경로 ({pathResult.length - 1} 단계)
              </h4>
              <ol className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {pathResult.map((paper, index) => (
                  <li key={`path-${paper.paperId}`} className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-600 dark:text-blue-300 font-semibold">
                      {index + 1}.
                    </span>
                    <span className="leading-snug">
                      {paper.title}
                      <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">({paper.year})</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Data export */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          데이터 내보내기
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
          >
            JSON 다운로드
          </button>
          <button
            type="button"
            onClick={handleExportNodesCsv}
            className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
          >
            노드 CSV
          </button>
          <button
            type="button"
            onClick={handleExportEdgesCsv}
            className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold"
          >
            엣지 CSV
          </button>
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          해석 가이드
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
          <li>• <strong>밀도</strong>: 높을수록 논문들이 서로 많이 연결됨</li>
          <li>• <strong>평균 연결도</strong>: 각 논문의 평균 연결 개수</li>
          <li>• <strong>중요 논문</strong>: 네트워크에서 핵심 역할을 하는 논문</li>
          <li>• <strong>중개 중심성</strong>: 다른 논문들을 이어주는 다리 역할의 강도</li>
          <li>• <strong>최단 경로</strong>: 두 논문이 어떻게 연결되는지 단계별로 확인</li>
          <li>• <strong>네트워크 지름</strong>: 최장 최단 경로 길이로, 네트워크 확장 정도를 파악</li>
          <li>• <strong>데이터 내보내기</strong>: JSON/CSV로 저장해 추가 분석에 활용하세요</li>
        </ul>
      </div>
    </div>
  );
}
