'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchBar } from '@/components/SearchBar';
import { NetworkGraph } from '@/components/NetworkGraph';
import { PaperDetail } from '@/components/PaperDetail';
import type { Paper } from '@/types/paper';

interface NetworkData {
  papers: Paper[];
  edges: Array<{ source: string; target: string }>;
}

export default function Home() {
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [centerPaperId, setCenterPaperId] = useState<string | null>(null);
  const [detailPaper, setDetailPaper] = useState<Paper | null>(null);

  const { data: networkData, isLoading } = useQuery<NetworkData>({
    queryKey: ['network', centerPaperId],
    queryFn: async () => {
      if (!centerPaperId) return { papers: [], edges: [] };
      const response = await fetch(`/api/network/${centerPaperId}`);
      if (!response.ok) throw new Error('Failed to fetch network');
      return response.json();
    },
    enabled: !!centerPaperId,
  });

  const handlePaperSelect = (paper: Paper) => {
    setSelectedPaper(paper);
    setCenterPaperId(paper.paperId);
    setDetailPaper(paper);
  };

  const handleNodeClick = (paper: Paper) => {
    setDetailPaper(paper);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Paper Network
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            논문 인용 네트워크를 시각화하고 탐색하세요
          </p>
        </div>

        <SearchBar onPaperSelect={handlePaperSelect} />

        {isLoading && (
          <div className="text-center mt-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">네트워크 데이터를 불러오는 중...</p>
          </div>
        )}

        {networkData && networkData.papers.length > 0 && !isLoading && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[600px]">
              <NetworkGraph
                papers={networkData.papers}
                edges={networkData.edges}
                centerPaperId={centerPaperId!}
                onNodeClick={handleNodeClick}
              />
            </div>
            <div className="lg:col-span-1 h-[600px]">
              <PaperDetail
                paper={detailPaper}
                onClose={() => setDetailPaper(null)}
              />
            </div>
          </div>
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
