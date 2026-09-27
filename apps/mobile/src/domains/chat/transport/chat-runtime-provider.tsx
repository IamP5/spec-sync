import { CopilotKitProvider } from '@copilotkit/react-native/headless';
import type { ReactNode } from 'react';

import { mobileConfig } from '../../shared/util-config/mobile-config';
import { chatRuntimeUrl } from '../data/chat-agent';

/**
 * Connects CopilotKit to the Mastra runtime behind the gateway, with the same
 * transport as the web app: one endpoint (`runtimeTransport: 'single'`) and no
 * cookies. There is no second runtime; see docs/adr/0003-chat-runtime.md.
 *
 * The gateway rejects requests without a Firebase ID token. The auth domain
 * will supply the `Authorization` header here once it exists.
 */
export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl={chatRuntimeUrl(mobileConfig.gatewayUrl)}
      useSingleEndpoint
      credentials="omit"
    >
      {children}
    </CopilotKitProvider>
  );
}
