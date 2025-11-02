'use client';

import { useMemo } from 'react';
import type { Paper } from '@/types/paper';

interface PaperComparisonProps {
  papers: Paper[];
  onClose: () => void;
  onRemovePaper: (paperId: string) => void;
  onPaperSelect?: (paper: Paper) => void;
}

export function PaperComparison({ papers, onClose, onRemovePaper, onPaperSelect }: PaperComparisonProps) {
  // Calculate comparison metrics
  const comparison = useMemo(() => {
    if (papers.length === 0) return null;

    const years = papers.map(p => p.year).filter(y => y) as number[];
    const citations = papers.map(p => p.citationCount || 0);

    // Find common authors
    const authorSets = papers.map(p =>
      new Set((p.authors || []).map(a => a.name))
    );
    const commonAuthors = authorSets.length > 1
      ? Array.from(authorSets[0]).filter(author =>
          authorSets.every(set => set.has(author))
        )
      : [];

    // Extract unique keywords from titles
    const keywords = new Map<string, number>();
    papers.forEach(paper => {
      const words = paper.title
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      words.forEach(word => {
        keywords.set(word, (keywords.get(word) || 0) + 1);
      });
    });

    const commonKeywords = Array.from(keywords.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      yearRange: years.length > 0 ? {
        min: Math.min(...years),
        max: Math.max(...years),
        span: Math.max(...years) - Math.min(...years)
      } : null,
      citationStats: {
        total: citations.reduce((a, b) => a + b, 0),
        avg: citations.reduce((a, b) => a + b, 0) / citations.length,
        max: Math.max(...citations),
        min: Math.min(...citations)
      },
      commonAuthors,
      commonKeywords,
      totalAuthors: new Set(papers.flatMap(p => (p.authors || []).map(a => a.name))).size
    };
  }, [papers]);

  // Export comparison
  const exportComparison = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      papers: papers.map(p => ({
        paperId: p.paperId,
        title: p.title,
        year: p.year,
        authors: p.authors?.map(a => a.name),
        citationCount: p.citationCount,
      })),
      comparison,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `paper-comparison-${Date.now()}.json`;
    link.click();
  };

  if (papers.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto max-h-[600px]">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            논문 비교
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">비교할 논문을 선택해주세요</p>
          <p className="text-xs mt-2">네트워크에서 Ctrl+클릭으로 여러 논문 선택</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto max-h-[600px]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            논문 비교
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {papers.length}개 논문 비교 중
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportComparison}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
            title="내보내기"
          >
            💾
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      </div>

      {/* Comparison Summary */}
      {comparison && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            비교 요약
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {comparison.yearRange && (
              <div className="bg-white dark:bg-gray-700 p-2 rounded">
                <div className="text-gray-500 dark:text-gray-400">연도 범위</div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {comparison.yearRange.min} - {comparison.yearRange.max}
                  <span className="text-gray-500 dark:text-gray-400 ml-1">
                    ({comparison.yearRange.span}년)
                  </span>
                </div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-700 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">총 인용</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {comparison.citationStats.total.toLocaleString()}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">평균 인용</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {comparison.citationStats.avg.toFixed(1)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-2 rounded">
              <div className="text-gray-500 dark:text-gray-400">총 저자 수</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {comparison.totalAuthors}명
              </div>
            </div>
          </div>

          {comparison.commonAuthors.length > 0 && (
            <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">공통 저자</div>
              <div className="flex flex-wrap gap-1">
                {comparison.commonAuthors.map(author => (
                  <span key={author} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                    {author}
                  </span>
                ))}
              </div>
            </div>
          )}

          {comparison.commonKeywords.length > 0 && (
            <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">공통 키워드</div>
              <div className="flex flex-wrap gap-1">
                {comparison.commonKeywords.map(keyword => (
                  <span key={keyword} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Papers List */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          선택된 논문
        </h3>
        <div className="space-y-2">
          {papers.map((paper, index) => (
            <div
              key={paper.paperId}
              className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <button
                  onClick={() => onPaperSelect?.(paper)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                    {paper.title}
                  </div>
                </button>
                <button
                  onClick={() => onRemovePaper(paper.paperId)}
                  className="flex-shrink-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                  title="제거"
                >
                  ×
                </button>
              </div>

              <div className="ml-8 space-y-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  📅 {paper.year || 'N/A'} • 📚 {paper.citationCount || 0} 인용
                </div>
                {paper.authors && paper.authors.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ✍️ {paper.authors[0].name}
                    {paper.authors.length > 1 && ` 외 ${paper.authors.length - 1}명`}
                  </div>
                )}
              </div>

              {/* Comparison bars */}
              {comparison && (
                <div className="ml-8 mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-16">인용수</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{
                          width: `${((paper.citationCount || 0) / comparison.citationStats.max) * 100}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
                      {paper.citationCount || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Guide */}
      <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
          💡 사용 팁
        </h4>
        <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
          <li>• Ctrl+클릭으로 네트워크에서 여러 논문 선택</li>
          <li>• 공통점과 차이점을 한눈에 비교</li>
          <li>• 💾 버튼으로 비교 결과 저장</li>
        </ul>
      </div>
    </div>
  );
}
