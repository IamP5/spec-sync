import { createVertex } from '@ai-sdk/google-vertex';

/**
 * Gemini served by Vertex AI. Mastra has no `vertex/...` router string, so the
 * AI SDK provider instance is passed to the agents directly.
 *
 * Authentication is Google Application Default Credentials: the runtime
 * service account on Cloud Run, `gcloud auth application-default login` on a
 * developer machine. No key is ever configured here. Project and location come
 * from GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION (read by the provider).
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

export const vertex = createVertex();

export const modelId = process.env['VERTEX_MODEL'] ?? DEFAULT_MODEL;

export const gemini = vertex(modelId);
