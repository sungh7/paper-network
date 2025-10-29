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
  onClose: () => void;
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
  onClose,
}: NetworkStatsProps) {
  const [pathStart, setPathStart] = useState('');
  const [pathEnd, setPathEnd] = useState('');
  const [pathResult, setPathResult] = useState<Paper[]>([]);
  const [pathError, setPathError] = useState<string | null>(null);

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
      }
      return;
    }

    const path = findShortestPath(papers, edges, pathStart, pathEnd);
    if (!path || path.length === 0) {
      setPathResult([]);
      setPathError('선택한 두 논문 사이의 경로를 찾을 수 없습니다.');
      onHighlightPath(null);
      return;
    }

    const mapped = path
      .map((paperId) => paperLookup.get(paperId))
      .filter((paper): paper is Paper => Boolean(paper));

    setPathResult(mapped);
    setPathError(null);
    onHighlightPath(path);
  };

  const handleClearPath = () => {
    setPathStart('');
    setPathEnd('');
    setPathResult([]);
    setPathError(null);
    onHighlightPath(null);
  };

  const formatScore = (scores: CentralityScores, paperId: string) => {
    return ((scores[paperId] ?? 0) * 100).toFixed(1);
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

      {/* Basic Stats */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          기본 통계
        </h3>
        <div className="grid grid-cols-2 gap-4">
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
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.avgDegree.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">평균 연결도</div>
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

      {/* Top Papers by Degree Centrality */}
      {topPapers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            중요 논문 (연결 중심성 기준)
          </h3>
          <div className="space-y-2">
            {topPapers.map((paper, index) => (
              <div
                key={paper.paperId}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              </div>
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
              <div
                key={`${paper.paperId}-betweenness`}
                className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/40"
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
              </div>
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
              <div
                key={community.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg"
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
              </div>
            ))}
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
        </ul>
      </div>
    </div>
  );
}
