import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Wallet, RefreshCw, Building2, Shield, Zap, Globe } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <BrandLogo className="w-8 h-8" rounded="rounded-lg" />
            <span className="font-bold text-lg">LexoPay</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/auth')} className="touch-target">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 sm:pt-32 sm:pb-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-sm text-primary font-medium">Built on Base</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-4 sm:mb-6">
            Hold crypto raw.
            <br />
            <span className="gradient-text">Convert only when you want.</span>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            Your crypto, your control. Deposit stablecoins, keep them in your wallet, 
            and convert to Naira on your terms.
          </p>
          
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="touch-target gradient-primary hover:opacity-90 transition-opacity text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Dual Wallet Visual */}
      <section className="py-12 sm:py-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Crypto Wallet Card */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Wallet className="w-5 sm:w-6 h-5 sm:h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg">Crypto Wallet</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Your raw holdings</p>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <WalletRow label="USDC" network="Base" amount="1,250.00" />
                <WalletRow label="USDT" network="Base" amount="500.00" />
              </div>
            </div>

            {/* NGN Wallet Card */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 border-success/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-success/20 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl">₦</span>
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg">NGN Wallet</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Ready to withdraw</p>
                </div>
              </div>
              <div className="p-3 sm:p-4 rounded-lg bg-background/50">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono">₦2,456,000</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center my-6 sm:my-8">
            <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full glass-card">
              <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Convert when YOU decide</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 sm:mb-12">
            Why LexoPay?
          </h2>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard icon={<Shield className="w-5 sm:w-6 h-5 sm:h-6" />} title="No Auto-Conversion" description="Your crypto stays as crypto until you choose to convert." />
            <FeatureCard icon={<Zap className="w-5 sm:w-6 h-5 sm:h-6" />} title="Instant Withdrawals" description="Convert and withdraw to any Nigerian bank in minutes." />
            <FeatureCard icon={<Globe className="w-5 sm:w-6 h-5 sm:h-6" />} title="Base Network" description="Low fees, fast transactions on Coinbase's L2." />
            <FeatureCard icon={<Wallet className="w-5 sm:w-6 h-5 sm:h-6" />} title="Dual Wallet System" description="Separate crypto and NGN wallets for complete control." />
            <FeatureCard icon={<Building2 className="w-5 sm:w-6 h-5 sm:h-6" />} title="All Nigerian Banks" description="Withdraw to Access, GTBank, Kuda, OPay, and more." />
            <FeatureCard icon={<RefreshCw className="w-5 sm:w-6 h-5 sm:h-6" />} title="Transparent Rates" description="See exact rates and fees before every conversion." />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4">
        <div className="container max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            Ready to take control?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-6 sm:mb-8 px-2">
            Join LexoPay and experience crypto off-ramping the way it should be.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="touch-target gradient-primary hover:opacity-90 transition-opacity text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto w-full sm:w-auto"
          >
            Create Your Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <BrandLogo className="w-6 h-6" rounded="rounded-md" />
              <span className="font-semibold">LexoPay</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 LexoPay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const WalletRow = ({ label, network, amount }: { label: string; network: string; amount: string }) => (
  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-background/50">
    <div className="flex items-center gap-2">
      <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-success/20 flex items-center justify-center">
        <span className="text-xs font-bold text-success">$</span>
      </div>
      <span className="font-medium text-sm">{label}</span>
      <span className="text-[10px] sm:text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{network}</span>
    </div>
    <span className="font-mono font-medium text-sm">{amount}</span>
  </div>
);

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="glass-card-hover rounded-xl p-5 sm:p-6">
    <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3 sm:mb-4">
      {icon}
    </div>
    <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2">{title}</h3>
    <p className="text-muted-foreground text-xs sm:text-sm">{description}</p>
  </div>
);

export default Landing;
