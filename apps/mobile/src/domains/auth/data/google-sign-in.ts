import { exchangeCodeAsync } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { mobileConfig } from '../../shared/util-config/mobile-config';

WebBrowser.maybeCompleteAuthSession();

/** Asks Google for an ID token; `undefined` when the user cancelled. */
export interface GoogleIdTokenPrompt {
  /** False until the request is built, or when this build has no client id. */
  ready: boolean;
  /** Why sign-in cannot start in this build, if it cannot. */
  unavailable?: string;
  prompt: () => Promise<string | undefined>;
}

const clientIds = mobileConfig.googleClientIds;
const platformClientId =
  process.env.EXPO_OS === 'android' ? clientIds.android : clientIds.ios;

/**
 * Google sign-in on iOS and Android (expo-auth-session). It needs the OAuth
 * client ids of the Identity Platform project (`EXPO_PUBLIC_GOOGLE_*`); a
 * build without them explains that instead of opening a broken flow.
 */
export const useGoogleIdTokenPrompt: () => GoogleIdTokenPrompt =
  platformClientId ? useConfiguredPrompt : useUnconfiguredPrompt;

function useConfiguredPrompt(): GoogleIdTokenPrompt {
  // On iOS and Android Google answers with an authorization code (PKCE). The
  // hook would exchange it in the background and report the token through its
  // response state, never through `promptAsync`; exchange it here instead so
  // `prompt` resolves with the token. A code is single-use, so the hook's own
  // exchange stays off.
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: clientIds.ios,
    androidClientId: clientIds.android,
    webClientId: clientIds.web,
    shouldAutoExchangeCode: false,
  });
  return {
    ready: request !== null,
    prompt: async () => {
      const result = await promptAsync();
      if (result.type !== 'success') return undefined;
      const direct = result.params['id_token'];
      if (direct) return direct;
      const code = result.params['code'];
      if (!code || !request || !platformClientId)
        throw new Error('Google did not return an authorization code.');
      const tokens = await exchangeCodeAsync(
        {
          clientId: platformClientId,
          redirectUri: request.redirectUri,
          code,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        Google.discovery,
      );
      if (!tokens.idToken)
        throw new Error('Google did not return an ID token.');
      return tokens.idToken;
    },
  };
}

function useUnconfiguredPrompt(): GoogleIdTokenPrompt {
  return {
    ready: false,
    unavailable:
      'Google sign-in is not configured for this build. Set the EXPO_PUBLIC_GOOGLE_*_CLIENT_ID variables.',
    prompt: async () => undefined,
  };
}
