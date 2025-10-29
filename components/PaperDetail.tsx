'use client';

import type { Paper } from '@/types/paper';

interface PaperDetailProps {
  paper: Paper | null;
  onClose: () => void;
}

export function PaperDetail({ paper, onClose }: PaperDetailProps) {
  if (!paper) return null;

  const formattedPublicationDate = paper.publicationDate
    ? new Date(paper.publicationDate).toLocaleDateString()
    : undefined;
  const openAccessUrl = paper.openAccessPdf?.url;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white pr-4">
          {paper.title}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl flex-shrink-0"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            저자
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {paper.authors.map(a => a.name).join(', ')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              발표 연도
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{paper.year}</p>
          </div>
          {formattedPublicationDate && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                출판일
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{formattedPublicationDate}</p>
            </div>
          )}
          {paper.venue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                학회/저널
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{paper.venue}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              인용 횟수
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{paper.citationCount}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              참고문헌 수
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{paper.referenceCount}</p>
          </div>
        </div>

        {paper.abstract && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              초록
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {paper.abstract}
            </p>
          </div>
        )}

        {paper.url && (
          <div>
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Semantic Scholar에서 보기 →
            </a>
          </div>
        )}

        {openAccessUrl && (
          <div>
            <a
              href={openAccessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Open Access PDF 열기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
