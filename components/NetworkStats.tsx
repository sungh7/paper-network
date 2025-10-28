'use client';

import type { Paper } from '@/types/paper';
import type { NetworkStats as Stats, CentralityScores } from '@/lib/networkAnalysis';

interface NetworkStatsProps {
  stats: Stats | null;
  topPapers: Paper[];
  onClose: () => void;
}

export function NetworkStats({ stats, topPapers, onClose }: NetworkStatsProps) {
  if (!stats) return null;

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

      {/* Top Papers by Centrality */}
      {topPapers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            중요 논문 (중심성 기준)
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
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {paper.year} • {paper.citationCount} 인용
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        </ul>
      </div>
    </div>
  );
}
