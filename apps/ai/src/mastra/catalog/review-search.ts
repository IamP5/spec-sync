import { retrieveGraph } from '../graph/retrieval';
import { vertex } from '../models';

export async function retrieveReviews(
  input: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const model = process.env['SPECSYNC_REVIEW_EMBEDDING_MODEL'];
  let embedding: number[] | undefined;
  if (model && typeof input['q'] === 'string' && input['q'].trim()) {
    const dimensions = Number(
      process.env['SPECSYNC_REVIEW_EMBEDDING_DIMENSIONS'] ?? 768,
    );
    const output = await vertex.embeddingModel(model).doEmbed({
      values: [input['q']],
      abortSignal: signal,
      providerOptions: {
        google: {
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: dimensions,
        },
      },
    });
    embedding = output.embeddings[0];
  }
  return retrieveGraph('reviews', { ...input, embedding }, signal);
}
