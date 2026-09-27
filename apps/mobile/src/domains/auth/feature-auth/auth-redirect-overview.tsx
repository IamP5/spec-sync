import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * Where Google's sign-in redirect (`com.specsync.mobile:/oauthredirect`)
 * lands. On Android the browser hands that URL to the app as a deep link:
 * expo-auth-session reads the code from it, and the router opens this
 * screen, which only steps back to where the user was (the chat when the app
 * was cold-started by the link). It draws nothing: the route is a
 * transparent modal that closes in the same frame.
 */
export function AuthRedirectOverview() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return null;
}
