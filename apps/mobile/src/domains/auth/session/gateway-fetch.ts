import { fetch } from 'expo/fetch';

import { mobileConfig } from '../../shared/util-config/mobile-config';
import { sessionContext } from './session-context';

/** A gateway answer other than 2xx, or a request the session did not allow. */
export class GatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export interface GatewayRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * A request to the gateway on behalf of the verified user (a port of the web
 * `authInterceptor`): absolute gateway URL, a fresh `Authorization: Bearer`
 * ID token, no cookies. The request is aborted when the session ends, and a
 * 401 ends the session, since the token was refused.
 */
export async function gatewayFetch(
  path: string,
  request: GatewayRequest = {},
): Promise<Response> {
  const scope = sessionContext.snapshot().scope;
  if (!scope) throw new GatewayError(401, 'Sign in to continue.');
  const token = await sessionContext.idToken();

  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal?.addEventListener('abort', abort);
  const stop = sessionContext.onEvent((event) => {
    if (event.type === 'invalidated') abort();
  });
  try {
    const response = await fetch(`${mobileConfig.gatewayUrl}${path}`, {
      method: request.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(request.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      credentials: 'omit',
      signal: controller.signal,
    });
    if (response.status === 401 && sessionContext.isCurrent(scope)) {
      sessionContext.invalidate('error');
    }
    return response as unknown as Response;
  } finally {
    stop();
    request.signal?.removeEventListener('abort', abort);
  }
}

/**
 * A JSON request whose answer is validated by `parse`. Non-2xx answers become
 * a {@link GatewayError} carrying the service's `error` text when it sent one.
 */
export async function gatewayJson<T>(
  path: string,
  parse: (value: unknown) => T,
  request: GatewayRequest = {},
): Promise<T> {
  const response = await gatewayFetch(path, request);
  if (!response.ok) throw await gatewayErrorOf(response);
  return parse(await response.json());
}

/** A request whose answer carries no body the caller needs (204). */
export async function gatewaySend(
  path: string,
  request: GatewayRequest = {},
): Promise<void> {
  const response = await gatewayFetch(path, request);
  if (!response.ok) throw await gatewayErrorOf(response);
}

export async function gatewayErrorOf(
  response: Response,
): Promise<GatewayError> {
  let message = `The server answered ${response.status}.`;
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.trim()
    ) {
      message = body.error;
    }
  } catch {
    // Not every error carries a JSON body.
  }
  return new GatewayError(response.status, message);
}
