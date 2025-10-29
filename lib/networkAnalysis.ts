import type { Paper, NetworkEdge } from '@/types/paper';

export interface NetworkStats {
  totalPapers: number;
  totalEdges: number;
  avgCitations: number;
  avgReferences: number;
  yearRange: { min: number; max: number };
  density: number;
  avgDegree: number;
  componentCount: number;
  avgPathLength: number;
  diameter: number;
}

export interface CentralityScores {
  [paperId: string]: number;
}

export interface Community {
  id: number;
  papers: string[];
  color: string;
}

/**
 * Calculate basic network statistics
 */
export function calculateNetworkStats(
  papers: Paper[],
  edges: NetworkEdge[]
): NetworkStats {
  if (papers.length === 0) {
    return {
      totalPapers: 0,
      totalEdges: 0,
      avgCitations: 0,
      avgReferences: 0,
      yearRange: { min: 0, max: 0 },
      density: 0,
      avgDegree: 0,
      componentCount: 0,
      avgPathLength: 0,
      diameter: 0
    };
  }

  const years = papers.map(p => p.year).filter(y => y);
  const totalCitations = papers.reduce((sum, p) => sum + (p.citationCount || 0), 0);
  const totalReferences = papers.reduce((sum, p) => sum + (p.referenceCount || 0), 0);

  // Calculate degree for each node
  const degrees = new Map<string, number>();
  papers.forEach(p => degrees.set(p.paperId, 0));
  edges.forEach(edge => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });

  const avgDegree = Array.from(degrees.values()).reduce((a, b) => a + b, 0) / papers.length;

  const adjacency = buildAdjacency(papers, edges);

  const components = getConnectedComponents(adjacency);

  let totalPathLength = 0;
  let pathCount = 0;
  let diameter = 0;

  components.forEach(component => {
    component.forEach(startId => {
      const distances = bfsDistances(adjacency, startId);
      distances.forEach((distance, nodeId) => {
        if (startId === nodeId || distance === Infinity) return;
        totalPathLength += distance;
        pathCount += 1;
        if (distance > diameter) {
          diameter = distance;
        }
      });
    });
  });

  const avgPathLength = pathCount > 0 ? totalPathLength / pathCount : 0;

  // Network density = actual edges / possible edges
  const possibleEdges = (papers.length * (papers.length - 1)) / 2;
  const density = possibleEdges > 0 ? edges.length / possibleEdges : 0;

  return {
    totalPapers: papers.length,
    totalEdges: edges.length,
    avgCitations: totalCitations / papers.length,
    avgReferences: totalReferences / papers.length,
    yearRange: {
      min: Math.min(...years),
      max: Math.max(...years)
    },
    density,
    avgDegree,
    componentCount: components.length,
    avgPathLength,
    diameter
  };
}

/**
 * Calculate degree centrality (number of connections)
 */
export function calculateDegreeCentrality(
  papers: Paper[],
  edges: NetworkEdge[]
): CentralityScores {
  const degrees: CentralityScores = {};

  papers.forEach(p => {
    degrees[p.paperId] = 0;
  });

  edges.forEach(edge => {
    degrees[edge.source] = (degrees[edge.source] || 0) + 1;
    degrees[edge.target] = (degrees[edge.target] || 0) + 1;
  });

  // Normalize to 0-1 range
  const maxDegree = Math.max(...Object.values(degrees), 1);
  Object.keys(degrees).forEach(id => {
    degrees[id] = degrees[id] / maxDegree;
  });

  return degrees;
}

/**
 * Calculate betweenness centrality (how often a node is on shortest paths)
 * Simplified version using degree as proxy for performance
 */
export function calculateBetweennessCentrality(
  papers: Paper[],
  edges: NetworkEdge[]
): CentralityScores {
  const adjacency = buildAdjacency(papers, edges);

  const betweenness: CentralityScores = {};
  papers.forEach(p => betweenness[p.paperId] = 0);

  // For each pair of nodes, find shortest path and increment betweenness
  // This is simplified - full implementation would use BFS for all pairs
  papers.forEach(source => {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: source.paperId, path: [] }];
    visited.add(source.paperId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current.id) || new Set();

      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const newPath = [...current.path, current.id];

          // Increment betweenness for nodes in path
          newPath.forEach(nodeId => {
            if (nodeId !== source.paperId && nodeId !== neighbor) {
              betweenness[nodeId]++;
            }
          });

          queue.push({ id: neighbor, path: newPath });
        }
      });
    }
  });

  // Normalize
  const maxBetweenness = Math.max(...Object.values(betweenness), 1);
  Object.keys(betweenness).forEach(id => {
    betweenness[id] = betweenness[id] / maxBetweenness;
  });

  return betweenness;
}

/**
 * Simple community detection using connected components and modularity
 */
export function detectCommunities(
  papers: Paper[],
  edges: NetworkEdge[]
): Community[] {
  const adjacency = buildAdjacency(papers, edges);

  // Find connected components using DFS
  const visited = new Set<string>();
  const communities: Community[] = [];
  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
  ];

  let communityId = 0;

  papers.forEach(paper => {
    if (visited.has(paper.paperId)) return;

    const component: string[] = [];
    const stack = [paper.paperId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.push(current);

    const neighbors = adjacency.get(current) || new Set();
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    });
    }

    if (component.length > 0) {
      communities.push({
        id: communityId,
        papers: component,
        color: colors[communityId % colors.length]
      });
      communityId++;
    }
  });

  return communities;
}

/**
 * Find shortest path between two papers
 */
export function findShortestPath(
  papers: Paper[],
  edges: NetworkEdge[],
  startId: string,
  endId: string
): string[] | null {
  const adjacency = buildAdjacency(papers, edges);

  // BFS to find shortest path
  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === endId) {
      return current.path;
    }

    const neighbors = adjacency.get(current.id) || new Set();
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          id: neighbor,
          path: [...current.path, neighbor]
        });
      }
    });
  }

  return null; // No path found
}

/**
 * Get top N papers by centrality score
 */
export function getTopPapers(
  papers: Paper[],
  scores: CentralityScores,
  n: number = 5
): Paper[] {
  return papers
    .map(paper => ({ paper, score: scores[paper.paperId] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(item => item.paper);
}

function buildAdjacency(
  papers: Paper[],
  edges: NetworkEdge[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  papers.forEach(p => adjacency.set(p.paperId, new Set()));

  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  return adjacency;
}

function bfsDistances(
  adjacency: Map<string, Set<string>>,
  startId: string
): Map<string, number> {
  const distances = new Map<string, number>();
  adjacency.forEach((_, nodeId) => {
    distances.set(nodeId, Infinity);
  });
  const queue: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];
  distances.set(startId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current.id) || new Set();

    neighbors.forEach(neighbor => {
      if ((distances.get(neighbor) ?? Infinity) === Infinity) {
        const nextDistance = current.distance + 1;
        distances.set(neighbor, nextDistance);
        queue.push({ id: neighbor, distance: nextDistance });
      }
    });
  }

  return distances;
}

function getConnectedComponents(
  adjacency: Map<string, Set<string>>
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  adjacency.forEach((_, nodeId) => {
    if (visited.has(nodeId)) return;

    const component: string[] = [];
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const neighbors = adjacency.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      });
    }

    components.push(component);
  });

  return components;
}
