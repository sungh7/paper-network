'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import type { Paper, NetworkEdge } from '@/types/paper';
import type { Community, CentralityScores } from '@/lib/networkAnalysis';

export type LayoutType = 'force' | 'timeline';

interface NetworkGraphProps {
  papers: Paper[];
  edges: NetworkEdge[];
  centerPaperId: string;
  onNodeClick?: (paper: Paper) => void;
  onNodeDoubleClick?: (paper: Paper) => void;
  layout?: LayoutType;
  onExportImage?: () => void;
  communities?: Community[];
  centralityScores?: CentralityScores;
  showCommunities?: boolean;
  highlightPath?: string[];
}

export interface NetworkGraphHandle {
  exportPNG: () => void;
  exportJPG: () => void;
}

export function NetworkGraph({ papers, edges, centerPaperId, onNodeClick, onNodeDoubleClick, layout = 'force', onExportImage, communities, centralityScores, showCommunities = false, highlightPath }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Create community lookup map
  const communityMap = useMemo(() => {
    const map = new Map<string, string>();
    if (showCommunities && communities) {
      communities.forEach(community => {
        community.papers.forEach(paperId => {
          map.set(paperId, community.color);
        });
      });
    }
    return map;
  }, [communities, showCommunities]);

  const exportPNG = () => {
    if (!cyRef.current) return;
    const png = cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    const link = document.createElement('a');
    link.href = png;
    link.download = `paper-network-${Date.now()}.png`;
    link.click();
  };

  const exportJPG = () => {
    if (!cyRef.current) return;
    const jpg = cyRef.current.jpg({ full: true, scale: 2, bg: '#ffffff' });
    const link = document.createElement('a');
    link.href = jpg;
    link.download = `paper-network-${Date.now()}.jpg`;
    link.click();
  };

  useEffect(() => {
    if (!containerRef.current || papers.length === 0) return;

    // Create paper lookup map
    const paperMap = new Map(papers.map(p => [p.paperId, p]));

    // Calculate timeline layout positions
    const calculateTimelinePositions = () => {
      const years = papers.map(p => p.year).filter(y => y);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const yearRange = maxYear - minYear || 1;

      // Group papers by year
      const papersByYear = new Map<number, Paper[]>();
      papers.forEach(paper => {
        const year = paper.year || minYear;
        if (!papersByYear.has(year)) {
          papersByYear.set(year, []);
        }
        papersByYear.get(year)!.push(paper);
      });

      // Calculate positions
      const positions: Record<string, { x: number; y: number }> = {};
      const height = 600;
      const width = 800;

      papersByYear.forEach((yearPapers, year) => {
        // Y position based on year (inverted so newer papers are at top)
        const yearProgress = (maxYear - year) / yearRange;
        const y = yearProgress * height * 0.8 + height * 0.1;

        // X positions distributed horizontally for papers in same year
        const xSpacing = Math.min(width / (yearPapers.length + 1), 150);
        const totalWidth = xSpacing * yearPapers.length;
        const startX = (width - totalWidth) / 2;

        yearPapers.forEach((paper, index) => {
          positions[paper.paperId] = {
            x: startX + (index + 0.5) * xSpacing,
            y: y
          };
        });
      });

      return positions;
    };

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        // Nodes
        ...papers.map(paper => ({
          data: {
            id: paper.paperId,
            label: paper.title.length > 50 ? paper.title.substring(0, 50) + '...' : paper.title,
            fullTitle: paper.title,
            year: paper.year,
            citations: paper.citationCount,
            isCenter: paper.paperId === centerPaperId,
            paper: paper
          }
        })),
        // Edges
        ...edges.map((edge, idx) => ({
          data: {
            id: `edge-${idx}`,
            source: edge.source,
            target: edge.target,
            edgeType: edge.type,
            similarity: edge.similarity
          }
        }))
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: NodeSingular) => {
              const paperId = ele.data('id');
              if (ele.data('isCenter')) return '#3b82f6';
              if (showCommunities && communityMap.has(paperId)) {
                return communityMap.get(paperId) || '#64748b';
              }
              return '#64748b';
            },
            'label': 'data(label)',
            'width': (ele: NodeSingular) => {
              const paperId = ele.data('id');
              let size = 30;

              // Use centrality score if available
              if (centralityScores && centralityScores[paperId] !== undefined) {
                size = 30 + centralityScores[paperId] * 50;
              } else {
                // Fallback to citations
                const citations = ele.data('citations') || 0;
                size = 30 + Math.log(citations + 1) * 10;
              }

              return Math.max(30, Math.min(80, size));
            },
            'height': (ele: NodeSingular) => {
              const paperId = ele.data('id');
              let size = 30;

              // Use centrality score if available
              if (centralityScores && centralityScores[paperId] !== undefined) {
                size = 30 + centralityScores[paperId] * 50;
              } else {
                // Fallback to citations
                const citations = ele.data('citations') || 0;
                size = 30 + Math.log(citations + 1) * 10;
              }

              return Math.max(30, Math.min(80, size));
            },
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 5,
            'color': '#374151',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'border-width': 2,
            'border-color': '#ffffff',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '3px'
          }
        },
        {
          selector: 'node.path-highlight',
          style: {
            'border-color': '#f97316',
            'border-width': 6,
            'background-color': '#fb923c',
            'z-index-compare': 'manual',
            'z-index': 999
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ef4444',
            'border-width': 4
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': (ele: EdgeSingular) => {
              const type = ele.data('edgeType');
              if (type === 'citation') return '#10b981'; // Green for citations
              if (type === 'reference') return '#6366f1'; // Indigo for references
              if (type === 'similar') return '#f59e0b'; // Amber for similar papers
              return '#cbd5e1';
            },
            'target-arrow-color': (ele: EdgeSingular) => {
              const type = ele.data('edgeType');
              if (type === 'citation') return '#10b981';
              if (type === 'reference') return '#6366f1';
              if (type === 'similar') return '#f59e0b';
              return '#cbd5e1';
            },
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1,
            'line-style': (ele: EdgeSingular) => {
              const type = ele.data('edgeType');
              return type === 'similar' ? 'dashed' : 'solid';
            },
            'line-dash-pattern': [6, 3]
          }
        },
        {
          selector: 'edge.path-highlight',
          style: {
            'width': 5,
            'line-color': '#f97316',
            'target-arrow-color': '#f97316',
            'z-index-compare': 'manual',
            'z-index': 999
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'width': 4,
            'opacity': 1
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'opacity': 1
          }
        }
      ],
      layout: layout === 'timeline'
        ? {
            name: 'preset',
            positions: calculateTimelinePositions(),
            fit: true,
            padding: 50,
            animate: true,
            animationDuration: 500
          }
        : {
            name: 'cose',
            animate: true,
            animationDuration: 1000,
            nodeRepulsion: 8000,
            idealEdgeLength: 100,
            edgeElasticity: 100,
            nestingFactor: 1.2,
            gravity: 1,
            numIter: 1000,
            padding: 50
          },
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2
    });

    // Event handlers
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const paper = node.data('paper');
      setSelectedNode(node.id());

      // Highlight connected edges
      cy.elements().removeClass('highlighted');
      node.connectedEdges().addClass('highlighted');

      if (onNodeClick && paper) {
        onNodeClick(paper);
      }
    });

    // Double tap to expand network
    cy.on('dbltap', 'node', (evt) => {
      const node = evt.target;
      const paper = node.data('paper');

      if (onNodeDoubleClick && paper) {
        onNodeDoubleClick(paper);
      }
    });

    // Tap on background to deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        cy.elements().removeClass('highlighted');
      }
    });

    cyRef.current = cy;

    // Cleanup
    return () => {
      cy.destroy();
    };
  }, [papers, edges, centerPaperId, onNodeClick, onNodeDoubleClick, layout, communities, centralityScores, showCommunities, communityMap]);

  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.nodes().removeClass('path-highlight');
    cyRef.current.edges().removeClass('path-highlight');

    if (!highlightPath || highlightPath.length === 0) {
      return;
    }

    highlightPath.forEach((nodeId) => {
      cyRef.current?.getElementById(nodeId).addClass('path-highlight');
    });

    for (let i = 0; i < highlightPath.length - 1; i++) {
      const source = highlightPath[i];
      const target = highlightPath[i + 1];
      const edgesBetween = cyRef.current
        .edges()
        .filter(edge => {
          const edgeSource = edge.data('source');
          const edgeTarget = edge.data('target');
          return (
            (edgeSource === source && edgeTarget === target) ||
            (edgeSource === target && edgeTarget === source)
          );
        });

      edgesBetween.forEach(edge => edge.addClass('path-highlight'));
    }

    if (highlightPath.length > 0) {
      cyRef.current.animate({
        fit: {
          eles: cyRef.current.collection(
            highlightPath.map(id => cyRef.current!.getElementById(id))
          ),
          padding: 80
        },
        duration: 400
      });
    }
  }, [highlightPath, edges]);

  // Calculate year labels for timeline
  const yearLabels = layout === 'timeline' ? (() => {
    const years = papers.map(p => p.year).filter(y => y);
    if (years.length === 0) return [];
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const yearRange = maxYear - minYear || 1;

    // Show 5-6 year markers
    const step = Math.max(1, Math.ceil(yearRange / 5));
    const labels = [];
    for (let year = minYear; year <= maxYear; year += step) {
      labels.push(year);
    }
    if (!labels.includes(maxYear)) {
      labels.push(maxYear);
    }
    return labels;
  })() : [];

  return (
    <div className="relative w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Timeline year axis */}
      {layout === 'timeline' && yearLabels.length > 0 && (
        <div className="absolute left-2 top-0 bottom-0 flex flex-col justify-between py-16 pointer-events-none">
          {yearLabels.reverse().map(year => (
            <div key={year} className="flex items-center">
              <div className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs font-medium text-gray-700 dark:text-gray-300 shadow">
                {year}
              </div>
              <div className="w-2 h-px bg-gray-300 dark:bg-gray-600 ml-1"></div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => cyRef.current?.fit(undefined, 50)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="전체 보기"
        >
          🔍 전체
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="확대"
        >
          +
        </button>
        <button
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="축소"
        >
          -
        </button>
        <div className="h-px bg-gray-300 dark:bg-gray-600 my-1"></div>
        <button
          onClick={exportPNG}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="PNG로 내보내기"
        >
          📷 PNG
        </button>
        <button
          onClick={exportJPG}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="JPG로 내보내기"
        >
          🖼️ JPG
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs">
        <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">범례</h3>
        <div className="flex flex-col gap-2 text-xs">
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">노드</div>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-gray-700 dark:text-gray-300">중심 논문</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-4 h-4 rounded-full bg-slate-500"></div>
            <span className="text-gray-700 dark:text-gray-300">연결된 논문</span>
          </div>

          <div className="font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1">엣지</div>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-0.5 bg-emerald-500"></div>
            <span className="text-gray-700 dark:text-gray-300">인용 (Citation)</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-0.5 bg-indigo-500"></div>
            <span className="text-gray-700 dark:text-gray-300">참조 (Reference)</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-0.5 bg-amber-500 border-dashed border-t-2 border-amber-500"></div>
            <span className="text-gray-700 dark:text-gray-300">유사 (Similar)</span>
          </div>

          <div className="text-gray-600 dark:text-gray-400 mt-2 ml-2">
            노드 크기 = 중심성 (없으면 인용 수)
          </div>
        </div>
      </div>
    </div>
  );
}
