'use client';

import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import type { Paper, NetworkEdge } from '@/types/paper';

interface NetworkGraphProps {
  papers: Paper[];
  edges: NetworkEdge[];
  centerPaperId: string;
  onNodeClick?: (paper: Paper) => void;
}

export function NetworkGraph({ papers, edges, centerPaperId, onNodeClick }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || papers.length === 0) return;

    // Create paper lookup map
    const paperMap = new Map(papers.map(p => [p.paperId, p]));

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
            'background-color': (ele: NodeSingular) =>
              ele.data('isCenter') ? '#3b82f6' : '#64748b',
            'label': 'data(label)',
            'width': (ele: NodeSingular) => {
              const citations = ele.data('citations') || 0;
              return Math.max(30, Math.min(80, 30 + Math.log(citations + 1) * 10));
            },
            'height': (ele: NodeSingular) => {
              const citations = ele.data('citations') || 0;
              return Math.max(30, Math.min(80, 30 + Math.log(citations + 1) * 10));
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
      layout: {
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
  }, [papers, edges, centerPaperId, onNodeClick]);

  return (
    <div className="relative w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => cyRef.current?.fit(undefined, 50)}
          className="px-3 py-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          title="전체 보기"
        >
          전체 보기
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
            노드 크기 = 인용 수
          </div>
        </div>
      </div>
    </div>
  );
}
