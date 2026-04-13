import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base } from '@reown/appkit/networks';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

const projectId = '75013a4ad65b1a5ba23262d1f642c6d2';

const networks = [base] as [typeof base];

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'LexoPay',
    description: 'Crypto to Naira off-ramp on Base',
    url: window.location.origin,
    icons: [`${window.location.origin}/placeholder.svg`],
  },
  features: {
    analytics: false,
  },
  themeMode: 'dark',
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { wagmiAdapter };
