import OpenAI from 'openai';

// OpenAI API 키가 설정되어 있으면 클라이언트 초기화
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface EmbeddingResult {
  paperId: string;
  embedding: number[];
}

/**
 * 텍스트를 임베딩으로 변환
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!openai) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // 토큰 제한을 위해 잘라냄
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * 두 벡터 간의 코사인 유사도 계산
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 논문 텍스트를 임베딩으로 변환 (제목 + 초록)
 */
export async function getPaperEmbedding(
  title: string,
  abstract?: string
): Promise<number[] | null> {
  const text = abstract
    ? `${title}\n\n${abstract}`
    : title;

  return getEmbedding(text);
}

/**
 * 여러 논문의 유사도 계산
 */
export async function calculateSimilarities(
  targetEmbedding: number[],
  candidateEmbeddings: Array<{ paperId: string; embedding: number[] }>
): Promise<Array<{ paperId: string; similarity: number }>> {
  return candidateEmbeddings.map(({ paperId, embedding }) => ({
    paperId,
    similarity: cosineSimilarity(targetEmbedding, embedding)
  })).sort((a, b) => b.similarity - a.similarity);
}

/**
 * OpenAI가 설정되어 있는지 확인
 */
export function isEmbeddingAvailable(): boolean {
  return openai !== null;
}
