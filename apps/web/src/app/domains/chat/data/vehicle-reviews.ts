import { z } from 'zod';

import { safeSourceUrl } from './vehicle-comparison';
import { knowledgeSchema } from './vehicle-contracts';

export const reviewSchema = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
  excerpt: z.string(),
  title: z.string(),
  context: z.string().nullish(),
  url: z.string().nullish(),
  mediaType: z.string().nullish(),
  author: z.string().nullish(),
  publishedOn: z.string().nullish(),
  locator: z.string().nullish(),
  startSeconds: z.number().nonnegative().nullish(),
  scope: z.enum(['MODEL', 'CONFIGURATION']),
  configurationId: z.string().nullish(),
  modelId: z.string().nullish(),
  kind: z.string().nullish(),
  conditions: z.unknown(),
});
export const reviewResponseSchema = knowledgeSchema.extend({
  items: z.array(reviewSchema),
});
export type VehicleReview = z.infer<typeof reviewSchema>;
export type RelatedReview = VehicleReview & {
  relatedConfigurationIds: string[];
};
export interface ReviewQuery {
  configurationIds: string[];
  attributeCode: string;
}
export interface ReviewBatch {
  items: RelatedReview[];
  failedConfigurationIds: string[];
  limited: boolean;
}

/** One model-scoped observation can be returned for several configurations. */
export function mergeReviewResults(
  results: {
    configurationId: string;
    response?: z.infer<typeof reviewResponseSchema>;
  }[],
): ReviewBatch {
  const items = new Map<string, RelatedReview>();
  const failedConfigurationIds: string[] = [];
  let limited = false;
  for (const { configurationId, response } of results) {
    if (!response || response.status === 'UNAVAILABLE') {
      failedConfigurationIds.push(configurationId);
      continue;
    }
    limited ||= response.items.length >= 30;
    for (const review of response.items) {
      const previous = items.get(review.id);
      if (previous) previous.relatedConfigurationIds.push(configurationId);
      else
        items.set(review.id, {
          ...review,
          relatedConfigurationIds: [configurationId],
        });
    }
  }
  return { items: [...items.values()], failedConfigurationIds, limited };
}

export function reviewUrl(
  review: Pick<VehicleReview, 'url' | 'startSeconds'>,
): string | undefined {
  const href = safeSourceUrl(review.url);
  if (!href) return undefined;
  const url = new URL(href);
  if (
    review.startSeconds != null &&
    ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname)
  )
    url.searchParams.set('t', String(Math.floor(review.startSeconds)));
  return url.href;
}

export function reviewMedia(type: string | null | undefined): string {
  return (
    (
      {
        VIDEO: 'Vídeo',
        YOUTUBE: 'Vídeo',
        ARTICLE: 'Artigo',
        BLOG: 'Blog',
        BLOG_POST: 'Blog',
        SOCIAL: 'Post',
        SOCIAL_POST: 'Post',
        TWEET: 'Post',
      } as Record<string, string>
    )[type ?? ''] ??
    type ??
    'Outro'
  );
}

export function reviewPrompt(
  attributeCode: string,
  configurationIds: string[],
  reviews: RelatedReview[],
): string {
  // Send stable evidence IDs, not potentially long or untrusted review text.
  return `Analise os relatos selecionados sobre ${attributeCode} para as configurações ${configurationIds.join(', ')}. Consulte os trechos pelos IDs de evidência: ${[...new Set(reviews.map((r) => r.evidenceId))].join(', ')}. Observações selecionadas: ${reviews.map((r) => r.id).join(', ')}. Explique concordâncias, divergências e limites de aplicação a cada versão. Separe opiniões de especificações técnicas.`;
}
