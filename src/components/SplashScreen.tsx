import { Loader2 } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function SplashScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <BrandLogo className="w-14 h-14 shadow-lg shadow-primary/20" rounded="rounded-2xl" />
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">LexoPay</h1>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    </div>
  );
}
