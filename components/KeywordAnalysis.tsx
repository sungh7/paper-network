'use client';

import { useMemo, useState } from 'react';
import type { Paper } from '@/types/paper';
import {
  extractKeywords,
  analyzeKeywordTrends,
  analyzeAuthors,
  type KeywordCount,
  type AuthorStats
} from '@/lib/keywordExtraction';

interface KeywordAnalysisProps {
  papers: Paper[];
  onClose: () => void;
}

export function KeywordAnalysis({ papers, onClose }: KeywordAnalysisProps) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  // Extract keywords
  const keywords = useMemo(() => {
    return extractKeywords(papers, 3, 30);
  }, [papers]);

  // Analyze trends
  const trends = useMemo(() => {
    return analyzeKeywordTrends(papers, 8);
  }, [papers]);

  // Analyze authors
  const authors = useMemo(() => {
    return analyzeAuthors(papers, 10);
  }, [papers]);

  // Get papers for selected keyword
  const relatedPapers = useMemo(() => {
    if (!selectedKeyword) return [];
    const keyword = keywords.find(k => k.keyword === selectedKeyword);
    if (!keyword) return [];
    return papers.filter(p => keyword.papers.includes(p.paperId)).slice(0, 5);
  }, [selectedKeyword, keywords, papers]);

  // Export to CSV
  const exportToCSV = () => {
    const csvRows = [
      ['Keyword', 'Count', 'Papers'].join(','),
      ...keywords.map(kw => [
        `"${kw.keyword}"`,
        kw.count,
        kw.papers.length
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keywords-${Date.now()}.csv`;
    link.click();
  };

  // Export to JSON
  const exportToJSON = () => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalPapers: papers.length,
        totalKeywords: keywords.length,
      },
      keywords: keywords.map(kw => ({
        keyword: kw.keyword,
        count: kw.count,
        paperIds: kw.papers
      })),
      authors: authors.map(a => ({
        name: a.name,
        paperCount: a.paperCount,
        totalCitations: a.totalCitations
      })),
      trends: trends.map(t => ({
        year: t.year,
        keywords: Object.fromEntries(t.keywords)
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keyword-analysis-${Date.now()}.json`;
    link.click();
  };

  // Calculate font size for keyword cloud
  const getKeywordFontSize = (count: number, maxCount: number): string => {
    const minSize = 12;
    const maxSize = 32;
    const size = minSize + (count / maxCount) * (maxSize - minSize);
    return `${Math.round(size)}px`;
  };

  const maxKeywordCount = keywords.length > 0 ? keywords[0].count : 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto max-h-[600px]">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          키워드 & 토픽 분석
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={exportToCSV}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          title="CSV로 내보내기"
        >
          📊 CSV
        </button>
        <button
          onClick={exportToJSON}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          title="JSON으로 내보내기"
        >
          💾 JSON
        </button>
      </div>

      {/* Keyword Cloud */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          주요 키워드 클라우드
        </h3>
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg min-h-[150px] flex flex-wrap items-center justify-center gap-3">
          {keywords.slice(0, 20).map((kw, index) => (
            <button
              key={kw.keyword}
              onClick={() => setSelectedKeyword(kw.keyword === selectedKeyword ? null : kw.keyword)}
              className={`px-3 py-1 rounded-full transition-all hover:scale-110 ${
                selectedKeyword === kw.keyword
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-gray-600'
              }`}
              style={{
                fontSize: getKeywordFontSize(kw.count, maxKeywordCount),
                fontWeight: kw.count > maxKeywordCount / 2 ? 'bold' : 'normal'
              }}
              title={`${kw.count}개 논문에서 등장`}
            >
              {kw.keyword}
            </button>
          ))}
        </div>
        {selectedKeyword && relatedPapers.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              &quot;{selectedKeyword}&quot; 키워드 관련 논문:
            </div>
            <div className="space-y-1">
              {relatedPapers.map(paper => (
                <div key={paper.paperId} className="text-xs text-blue-800 dark:text-blue-400 truncate">
                  • {paper.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Keywords List */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          상위 키워드
        </h3>
        <div className="space-y-2">
          {keywords.slice(0, 10).map((kw, index) => (
            <div
              key={kw.keyword}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {kw.keyword}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {kw.count}개 논문
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${(kw.count / maxKeywordCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keyword Trends by Year */}
      {trends.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            연도별 키워드 트렌드
          </h3>
          <div className="space-y-2">
            {trends.map(trend => (
              <div key={trend.year} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {trend.year}년
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Array.from(trend.keywords.values()).reduce((a, b) => a + b, 0)} 키워드
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(trend.keywords.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([keyword, count]) => (
                      <span
                        key={keyword}
                        className="px-2 py-1 bg-white dark:bg-gray-600 text-xs rounded text-gray-700 dark:text-gray-300"
                        title={`${count}회 등장`}
                      >
                        {keyword} ({count})
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Authors */}
      {authors.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            주요 저자
          </h3>
          <div className="space-y-2">
            {authors.map((author, index) => (
              <div
                key={author.name}
                className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {author.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        📄 {author.paperCount}편
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        📚 {author.totalCitations} 인용
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
        <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
          💡 분석 가이드
        </h4>
        <ul className="text-xs text-indigo-800 dark:text-indigo-400 space-y-1">
          <li>• <strong>키워드 클라우드</strong>: 클릭하면 관련 논문 표시</li>
          <li>• <strong>연도별 트렌드</strong>: 시간에 따른 주제 변화 확인</li>
          <li>• <strong>주요 저자</strong>: 해당 분야의 핵심 연구자</li>
          <li>• <strong>내보내기</strong>: CSV/JSON으로 데이터 저장 가능</li>
        </ul>
      </div>
    </div>
  );
}
