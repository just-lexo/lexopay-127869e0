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

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lexopay.lovable.app';

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'LexoPay',
    description: 'Crypto to Naira off-ramp on Base',
    url: origin,
    icons: [`${origin}/placeholder.svg`],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  // Enabling these wallets explicitly improves mobile deep-link reliability
  featuredWalletIds: [
    // Coinbase Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
    // MetaMask
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  ],
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
