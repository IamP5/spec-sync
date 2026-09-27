import { useCreditsStore } from './credits-store';
import { CreditsUsageCard } from './ui/credits-usage-card';

/** The AI credits card of the account screen; hidden while credits are off. */
export function ChatCreditsOverview() {
  const { wallet } = useCreditsStore();
  return wallet ? <CreditsUsageCard wallet={wallet} /> : null;
}
