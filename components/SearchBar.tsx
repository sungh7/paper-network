'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paper, SearchResult } from '@/types/paper';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

interface SearchBarProps {
  onPaperSelect: (paper: Paper) => void;
}

export function SearchBar({ onPaperSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentPapers, setRecentPapers] = useState<Paper[]>([]);
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const queryClient = useQueryClient();
  const RECENTS_STORAGE_KEY = 'paper-network:recent';

  const { data, isFetching, error, refetch } = useQuery<SearchResult>({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) {
        return { total: 0, data: [] };
      }
      const response = await fetch(`/api/search?query=${encodeURIComponent(debouncedQuery)}&limit=10`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return response.json();
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  const suggestions = data?.data ?? [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(RECENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Paper[];
        setRecentPapers(parsed);
      }
    } catch (storageError) {
      console.warn('Failed to load recent papers from storage:', storageError);
    }
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  const persistRecentPaper = useCallback((paper: Paper) => {
    setRecentPapers(prev => {
      const compactPaper: Paper = {
        ...paper,
        abstract: undefined,
      };
      const next = [compactPaper, ...prev.filter(item => item.paperId !== paper.paperId)].slice(0, 6);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
        } catch (storageError) {
          console.warn('Failed to persist recent papers:', storageError);
        }
      }
      return next;
    });
  }, [RECENTS_STORAGE_KEY]);

  const handleSuggestionSelect = useCallback((paper: Paper) => {
    onPaperSelect(paper);
    setQuery(paper.title);
    setHasSubmitted(true);
    setActiveIndex(-1);
    persistRecentPaper(paper);
  }, [onPaperSelect, persistRecentPaper]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(prev => {
        const next = prev + 1;
        return next >= suggestions.length ? 0 : next;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => {
        if (prev <= 0) {
          return suggestions.length - 1;
        }
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < suggestions.length) {
      event.preventDefault();
      handleSuggestionSelect(suggestions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setActiveIndex(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      handleSuggestionSelect(suggestions[activeIndex]);
      return;
    }
    setHasSubmitted(true);
    if (debouncedQuery !== query.trim()) {
      queryClient.setQueryData(['search', query.trim()], data ?? { total: 0, data: [] });
    }
    refetch();
  };

  const suggestionLabel = useMemo(() => {
    if (!debouncedQuery) return '검색어를 입력하면 제안이 표시됩니다.';
    if (isFetching && !data) return '검색 중...';
    if (data && data.total > 0) {
      return `${data.total}개의 결과 중 상위 ${data.data.length}개`;
    }
    if (hasSubmitted && data && data.data.length === 0) {
      return '검색 결과가 없습니다. 다른 키워드를 시도해보세요.';
    }
    return '검색 결과를 불러오는 중...';
  }, [debouncedQuery, isFetching, data, hasSubmitted]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHasSubmitted(false);
              if (activeIndex !== -1) {
                setActiveIndex(-1);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="논문 제목이나 키워드를 입력하세요..."
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="논문 검색"
          />
          <button
            type="submit"
            disabled={isFetching || !query.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {isFetching ? '검색 중...' : '검색'}
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
              {suggestionLabel}
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {suggestions.map((paper, index) => {
              const isActive = index === activeIndex;
              const baseClasses = 'w-full text-left p-4 border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors';
              const stateClasses = isActive
                ? 'bg-blue-50 dark:bg-blue-900/40'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700';

              return (
              <button
                key={paper.paperId}
                type="button"
                onClick={() => handleSuggestionSelect(paper)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`${baseClasses} ${stateClasses}`}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {paper.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {paper.authors.map(a => a.name).join(', ')} • {paper.year}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>인용: {paper.citationCount}</span>
                  <span>참고문헌: {paper.referenceCount}</span>
                  {paper.venue && <span>{paper.venue}</span>}
                </div>
              </button>
            );
            })}
          </div>
        </div>
      )}

      {data && data.data.length === 0 && debouncedQuery && !isFetching && (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          검색 결과가 없습니다. 다른 키워드를 입력해보세요.
        </div>
      )}

      {recentPapers.length > 0 && !debouncedQuery && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mt-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">최근 탐색한 논문</p>
            <button
              type="button"
              onClick={() => {
                setRecentPapers([]);
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem(RECENTS_STORAGE_KEY);
                }
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              지우기
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentPapers.map((paper) => (
              <button
                key={`recent-${paper.paperId}`}
                type="button"
                onClick={() => handleSuggestionSelect(paper)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {paper.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {paper.authors.map(a => a.name).join(', ')} • {paper.year}
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>인용: {paper.citationCount}</span>
                  <span>참고문헌: {paper.referenceCount}</span>
                  {paper.venue && <span>{paper.venue}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
