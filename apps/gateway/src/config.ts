export interface GatewayConfig {
  publicOrigin: string;
  apiUrl: string;
  aiUrl: string;
  webUrl: string;
  projectId: string;
  googleClientId: string;
  googleClientSecret: string;
  identityApiKey: string;
  cloudRunAuth: boolean;
}

export function loadConfig(env = process.env): GatewayConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const production = env['NODE_ENV'] === 'production';
  const origin = (name: string): string => {
    const url = new URL(required(name));
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        `${name} must be an origin without credentials, path or query`,
      );
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && local && !production)
    )
      throw new Error(
        `${name} must use HTTPS (HTTP loopback is allowed in development)`,
      );
    return url.origin;
  };
  if (production && env['FIREBASE_AUTH_EMULATOR_HOST'])
    throw new Error('The auth emulator is forbidden in production');
  return {
    publicOrigin: origin('PUBLIC_ORIGIN'),
    apiUrl: origin('API_URL'),
    aiUrl: origin('AI_URL'),
    webUrl: origin('WEB_URL'),
    projectId: required('GOOGLE_CLOUD_PROJECT'),
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    identityApiKey: required('IDENTITY_PLATFORM_API_KEY'),
    cloudRunAuth: production || env['CLOUD_RUN_AUTH'] === 'true',
  };
}
