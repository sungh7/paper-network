'use client';

import { useState, useMemo } from 'react';
import type { Paper } from '@/types/paper';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';

interface BookmarkGroup {
  id: string;
  name: string;
  color: string;
}

interface BookmarkedPaper extends Paper {
  bookmarkedAt: number;
  groupId?: string;
  notes?: string;
}

interface BookmarksProps {
  onClose: () => void;
  onPaperSelect?: (paper: Paper) => void;
  currentPaper?: Paper | null;
}

const DEFAULT_GROUPS: BookmarkGroup[] = [
  { id: 'default', name: '기본', color: '#3b82f6' },
  { id: 'important', name: '중요', color: '#ef4444' },
  { id: 'reading', name: '읽는 중', color: '#f59e0b' },
  { id: 'read', name: '읽음', color: '#10b981' },
];

export function Bookmarks({ onClose, onPaperSelect, currentPaper }: BookmarksProps) {
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkedPaper[]>('paper-bookmarks', []);
  const [groups, setGroups] = useLocalStorage<BookmarkGroup[]>('bookmark-groups', DEFAULT_GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'year' | 'citations'>('date');

  // Check if current paper is bookmarked
  const currentIsBookmarked = currentPaper ? bookmarks.some(b => b.paperId === currentPaper.paperId) : false;

  // Add or remove bookmark
  const toggleBookmark = (paper: Paper, groupId: string = 'default') => {
    const existingIndex = bookmarks.findIndex(b => b.paperId === paper.paperId);

    if (existingIndex >= 0) {
      // Remove bookmark
      setBookmarks(bookmarks.filter((_, i) => i !== existingIndex));
    } else {
      // Add bookmark
      const newBookmark: BookmarkedPaper = {
        ...paper,
        bookmarkedAt: Date.now(),
        groupId,
      };
      setBookmarks([newBookmark, ...bookmarks]);
    }
  };

  // Update bookmark group
  const updateBookmarkGroup = (paperId: string, groupId: string) => {
    setBookmarks(bookmarks.map(b =>
      b.paperId === paperId ? { ...b, groupId } : b
    ));
  };

  // Update bookmark notes
  const updateNotes = (paperId: string, notes: string) => {
    setBookmarks(bookmarks.map(b =>
      b.paperId === paperId ? { ...b, notes } : b
    ));
  };

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let filtered = bookmarks;

    // Filter by group
    if (selectedGroup) {
      filtered = filtered.filter(b => b.groupId === selectedGroup);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.authors?.some(a => a.name.toLowerCase().includes(query)) ||
        b.notes?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.bookmarkedAt - a.bookmarkedAt;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'year':
          return (b.year || 0) - (a.year || 0);
        case 'citations':
          return (b.citationCount || 0) - (a.citationCount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [bookmarks, selectedGroup, searchQuery, sortBy]);

  // Export bookmarks
  const exportBookmarks = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      bookmarks: bookmarks.map(b => ({
        paperId: b.paperId,
        title: b.title,
        year: b.year,
        authors: b.authors?.map(a => a.name),
        groupId: b.groupId,
        notes: b.notes,
        bookmarkedAt: new Date(b.bookmarkedAt).toISOString(),
      })),
      groups,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookmarks-${Date.now()}.json`;
    link.click();
  };

  // Clear all bookmarks
  const clearAll = () => {
    if (confirm('모든 북마크를 삭제하시겠습니까?')) {
      setBookmarks([]);
    }
  };

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookmarks.forEach(b => {
      const groupId = b.groupId || 'default';
      counts[groupId] = (counts[groupId] || 0) + 1;
    });
    return counts;
  }, [bookmarks]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto max-h-[600px]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            북마크
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {bookmarks.length}개 저장됨
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      {/* Current paper bookmark button */}
      {currentPaper && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentPaper.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {currentPaper.year} • {currentPaper.citationCount} 인용
              </div>
            </div>
            <button
              onClick={() => toggleBookmark(currentPaper)}
              className={`flex-shrink-0 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                currentIsBookmarked
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {currentIsBookmarked ? '🗑️ 제거' : '⭐ 추가'}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3 mb-4">
        {/* Search */}
        <input
          type="text"
          placeholder="제목, 저자, 메모 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />

        {/* Sort & Actions */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="date">최근 추가순</option>
            <option value="title">제목순</option>
            <option value="year">연도순</option>
            <option value="citations">인용수순</option>
          </select>
          <button
            onClick={exportBookmarks}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
            title="내보내기"
          >
            💾
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
            title="전체 삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Group filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selectedGroup === null
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          전체 ({bookmarks.length})
        </button>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setSelectedGroup(group.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedGroup === group.id
                ? 'text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            style={selectedGroup === group.id ? { backgroundColor: group.color } : {}}
          >
            {group.name} ({groupCounts[group.id] || 0})
          </button>
        ))}
      </div>

      {/* Bookmarks list */}
      {filteredBookmarks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">📚</div>
          <p className="text-sm">
            {searchQuery || selectedGroup ? '검색 결과가 없습니다' : '저장된 북마크가 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookmarks.map(bookmark => {
            const group = groups.find(g => g.id === bookmark.groupId);
            return (
              <div
                key={bookmark.paperId}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <button
                    onClick={() => onPaperSelect?.(bookmark)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      {bookmark.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {bookmark.year} • {bookmark.citationCount} 인용 •
                      {bookmark.authors && bookmark.authors.length > 0 && ` ${bookmark.authors[0].name}${bookmark.authors.length > 1 ? ' 외' : ''}`}
                    </div>
                  </button>
                  <button
                    onClick={() => toggleBookmark(bookmark)}
                    className="flex-shrink-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="북마크 제거"
                  >
                    🗑️
                  </button>
                </div>

                {/* Group selector */}
                <select
                  value={bookmark.groupId || 'default'}
                  onChange={(e) => updateBookmarkGroup(bookmark.paperId, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white mb-2"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                {/* Notes */}
                <textarea
                  value={bookmark.notes || ''}
                  onChange={(e) => updateNotes(bookmark.paperId, e.target.value)}
                  placeholder="메모 추가..."
                  className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-white resize-none"
                  rows={2}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
