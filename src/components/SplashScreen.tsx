import { Loader2 } from 'lucide-react';

export function SplashScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
        <span className="text-primary-foreground font-bold text-2xl">L</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">LexoPay</h1>
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    </div>
  );
}
