'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paper, SearchResult } from '@/types/paper';

interface SearchBarProps {
  onPaperSelect: (paper: Paper) => void;
}

export function SearchBar({ onPaperSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery<SearchResult>({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm) return { total: 0, data: [] };
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchTerm)}&limit=10`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchTerm.length > 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="논문 제목이나 키워드를 입력하세요..."
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">
          검색 중 오류가 발생했습니다. 다시 시도해주세요.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {data.total}개의 결과 중 {data.data.length}개 표시
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.data.map((paper) => (
              <button
                key={paper.paperId}
                onClick={() => onPaperSelect(paper)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {paper.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {paper.authors.map(a => a.name).join(', ')} • {paper.year}
                </p>
                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>인용: {paper.citationCount}</span>
                  <span>참고문헌: {paper.referenceCount}</span>
                  {paper.venue && <span>{paper.venue}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.data.length === 0 && searchTerm && !isLoading && (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
