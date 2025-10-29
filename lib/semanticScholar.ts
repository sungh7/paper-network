import axios from 'axios';
import type { Paper, Citation, SearchResult } from '@/types/paper';

const API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

type CacheStore = Map<string, CacheEntry<unknown>>;

declare global {
  // eslint-disable-next-line no-var
  var __semanticScholarCache: CacheStore | undefined;
}

const cacheStore: CacheStore = globalThis.__semanticScholarCache ?? new Map();

if (!globalThis.__semanticScholarCache) {
  globalThis.__semanticScholarCache = cacheStore;
}

const SEARCH_TTL = 1000 * 60 * 5; // 5 minutes
const PAPER_TTL = 1000 * 60 * 10; // 10 minutes

function getCacheValue<T>(key: string): T | null {
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return cached.value;
}

function setCacheValue<T>(key: string, value: T, ttl: number) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
}

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function searchPapers(query: string, limit: number = 10): Promise<SearchResult> {
  try {
    const cacheKey = `search:${query}:${limit}`;
    const cached = getCacheValue<SearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axiosClient.get(`/paper/search`, {
      params: {
        query,
        limit,
        fields: 'paperId,title,authors,year,abstract,citationCount,referenceCount,url,venue,publicationDate,openAccessPdf'
      }
    });

    const result: SearchResult = {
      total: response.data.total,
      data: response.data.data || []
    };

    setCacheValue(cacheKey, result, SEARCH_TTL);

    return result;
  } catch (error) {
    console.error('Error searching papers:', error);
    throw error;
  }
}

export async function getPaperDetails(paperId: string): Promise<Paper> {
  try {
    const cacheKey = `paper:${paperId}`;
    const cached = getCacheValue<Paper>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axiosClient.get(`/paper/${paperId}`, {
      params: {
        fields: 'paperId,title,authors,year,abstract,citationCount,referenceCount,url,venue,publicationDate,openAccessPdf'
      }
    });

    setCacheValue(cacheKey, response.data, PAPER_TTL);

    return response.data;
  } catch (error) {
    console.error('Error fetching paper details:', error);
    throw error;
  }
}

export async function getCitations(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const cacheKey = `citations:${paperId}:${limit}`;
    const cached = getCacheValue<Citation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axiosClient.get(`/paper/${paperId}/citations`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    const results = response.data.data?.map((item: any) => item.citedPaper) || [];
    setCacheValue(cacheKey, results, PAPER_TTL);

    return results;
  } catch (error) {
    console.error('Error fetching citations:', error);
    return [];
  }
}

export async function getReferences(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const cacheKey = `references:${paperId}:${limit}`;
    const cached = getCacheValue<Citation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axiosClient.get(`/paper/${paperId}/references`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    const results = response.data.data?.map((item: any) => item.citedPaper) || [];
    setCacheValue(cacheKey, results, PAPER_TTL);

    return results;
  } catch (error) {
    console.error('Error fetching references:', error);
    return [];
  }
}

export async function getRecommendations(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const cacheKey = `recommendations:${paperId}:${limit}`;
    const cached = getCacheValue<Citation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axiosClient.get(`/recommendations/v1/papers/forpaper/${paperId}`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    const results = response.data.recommendedPapers || [];
    setCacheValue(cacheKey, results, PAPER_TTL);

    return results;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}
