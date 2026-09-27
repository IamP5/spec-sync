import { CopilotKitProvider } from '@copilotkit/react-native/headless';
import type { ReactNode } from 'react';

import { mobileConfig } from '../../shared/util-config/mobile-config';
import { chatRuntimeUrl } from '../data/chat-agent';

/**
 * CopilotKit for the Mastra runtime behind the gateway, with the web app's
 * transport: one endpoint (`runtimeTransport: 'single'`) and no cookies.
 * There is no second runtime; see docs/adr/0003-chat-runtime.md.
 *
 * The gateway only answers a verified Firebase user, so the first runtime
 * handshake fails while signed out (the agent stays a provisional stand-in).
 * `ChatConversationStore` puts the `Authorization` header on the runtime and
 * reconnects once the session is established, and clears it on sign-out.
 */
function ignoreReportedError(): void {
  // Reported by ChatConversationStore.
}

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl={chatRuntimeUrl(mobileConfig.gatewayUrl)}
      useSingleEndpoint
      credentials="omit"
      // Failures reach the user through ChatConversationStore; without a
      // handler CopilotKit logs each one, including the expected signed-out
      // handshake refusal.
      onError={ignoreReportedError}
    >
      {children}
    </CopilotKitProvider>
  );
}
