import { GoogleAuth } from 'google-auth-library';

const google = new GoogleAuth();
const clients = new Map<string, ReturnType<GoogleAuth['getIdTokenClient']>>();

/** Authenticate the workload separately from any application-level credentials. */
export async function cloudRunHeaders(
  origin: string,
): Promise<Record<string, string>> {
  if (
    process.env['CLOUD_RUN_AUTH'] !== 'true' &&
    process.env['NODE_ENV'] !== 'production'
  )
    return {};
  const audience = new URL(origin).origin;
  if (!audience.startsWith('https://'))
    throw new Error('Cloud Run requires HTTPS');
  let pending = clients.get(audience);
  if (!pending) {
    pending = google.getIdTokenClient(audience);
    clients.set(audience, pending);
  }
  try {
    const headers = await (await pending).getRequestHeaders();
    const token = headers.get('authorization');
    if (!token) throw new Error('Missing Cloud Run identity token');
    return { 'x-serverless-authorization': token };
  } catch (error) {
    clients.delete(audience);
    throw error;
  }
}
