import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Wallet, RefreshCw, Building2, Shield, Zap, Globe } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-lg">LexoPay</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')}
            className="touch-target"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-sm text-primary font-medium">Built on Base</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Hold crypto raw.
            <br />
            <span className="gradient-text">Convert only when you want.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Your crypto, your control. Deposit stablecoins, keep them in your wallet, 
            and convert to Naira on your terms. Withdraw to any Nigerian bank instantly.
          </p>
          
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="touch-target gradient-primary hover:opacity-90 transition-opacity text-lg px-8 py-6 h-auto"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Dual Wallet Visual */}
      <section className="py-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Crypto Wallet Card */}
            <div className="glass-card rounded-2xl p-6 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Crypto Wallet</h3>
                  <p className="text-sm text-muted-foreground">Your raw holdings</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-success">$</span>
                    </div>
                    <span className="font-medium">USDT</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">Base</span>
                  </div>
                  <span className="font-mono font-medium">1,250.00</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">$</span>
                    </div>
                    <span className="font-medium">USDC</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">Base</span>
                  </div>
                  <span className="font-mono font-medium">500.00</span>
                </div>
              </div>
            </div>

            {/* NGN Wallet Card */}
            <div className="glass-card rounded-2xl p-6 border-success/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                  <span className="text-2xl">₦</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">NGN Wallet</h3>
                  <p className="text-sm text-muted-foreground">Ready to withdraw</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-background/50">
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-3xl font-bold font-mono">₦2,456,000.00</p>
              </div>
            </div>
          </div>

          {/* Arrow between wallets */}
          <div className="flex justify-center my-8">
            <div className="flex items-center gap-4 px-6 py-3 rounded-full glass-card">
              <RefreshCw className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Convert when YOU decide</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Why LexoPay?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="No Auto-Conversion"
              description="Your crypto stays as crypto until you explicitly choose to convert. No surprises."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Withdrawals"
              description="Convert to NGN and withdraw to any Nigerian bank account in minutes."
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6" />}
              title="Base Network"
              description="Low fees, fast transactions. Built on Coinbase's L2 for maximum efficiency."
            />
            <FeatureCard
              icon={<Wallet className="w-6 h-6" />}
              title="Dual Wallet System"
              description="Separate crypto and NGN wallets give you complete visibility and control."
            />
            <FeatureCard
              icon={<Building2 className="w-6 h-6" />}
              title="All Nigerian Banks"
              description="Withdraw to any bank or fintech—Access, GTBank, Kuda, OPay, and more."
            />
            <FeatureCard
              icon={<RefreshCw className="w-6 h-6" />}
              title="Transparent Rates"
              description="See the exact exchange rate and fees before every conversion. No hidden charges."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to take control?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join LexoPay today and experience crypto off-ramping the way it should be.
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="touch-target gradient-primary hover:opacity-90 transition-opacity text-lg px-8 py-6 h-auto"
          >
            Create Your Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">L</span>
              </div>
              <span className="font-semibold">LexoPay</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 LexoPay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="glass-card-hover rounded-xl p-6">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
      {icon}
    </div>
    <h3 className="font-semibold text-lg mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

export default Landing;
