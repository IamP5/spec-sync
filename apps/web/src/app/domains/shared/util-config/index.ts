import { InjectionToken } from '@angular/core';

export interface WebConfig {
  gatewayUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string };
}
export const WEB_CONFIG = new InjectionToken<WebConfig>('webConfig');
