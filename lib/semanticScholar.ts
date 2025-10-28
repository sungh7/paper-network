import axios from 'axios';
import type { Paper, Citation, SearchResult } from '@/types/paper';

const API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

// Rate limiting helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function searchPapers(query: string, limit: number = 10): Promise<SearchResult> {
  try {
    const response = await axios.get(`${API_BASE_URL}/paper/search`, {
      params: {
        query,
        limit,
        fields: 'paperId,title,authors,year,abstract,citationCount,referenceCount,url,venue,publicationDate'
      }
    });

    return {
      total: response.data.total,
      data: response.data.data || []
    };
  } catch (error) {
    console.error('Error searching papers:', error);
    throw error;
  }
}

export async function getPaperDetails(paperId: string): Promise<Paper> {
  try {
    const response = await axios.get(`${API_BASE_URL}/paper/${paperId}`, {
      params: {
        fields: 'paperId,title,authors,year,abstract,citationCount,referenceCount,url,venue,publicationDate'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching paper details:', error);
    throw error;
  }
}

export async function getCitations(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const response = await axios.get(`${API_BASE_URL}/paper/${paperId}/citations`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    return response.data.data?.map((item: any) => item.citedPaper) || [];
  } catch (error) {
    console.error('Error fetching citations:', error);
    return [];
  }
}

export async function getReferences(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const response = await axios.get(`${API_BASE_URL}/paper/${paperId}/references`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    return response.data.data?.map((item: any) => item.citedPaper) || [];
  } catch (error) {
    console.error('Error fetching references:', error);
    return [];
  }
}

export async function getRecommendations(paperId: string, limit: number = 20): Promise<Citation[]> {
  try {
    await delay(100); // Rate limiting
    const response = await axios.get(`${API_BASE_URL}/recommendations/v1/papers/forpaper/${paperId}`, {
      params: {
        limit,
        fields: 'paperId,title,authors,year,citationCount'
      }
    });

    return response.data.recommendedPapers || [];
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
}
