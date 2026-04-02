import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnChainBalances, CONVERTIBLE_TOKENS } from '@/hooks/useOnChainBalances';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export const OnChainBalances = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const walletAddress = profile?.wallet_address;
  const { balances, loading, refetch } = useOnChainBalances(walletAddress);
  const [showOther, setShowOther] = useState(false);

  if (!walletAddress) {
    return (
      <Card className="glass-card border-border/30">
        <CardContent className="py-4 text-center">
          <Wallet className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Connect wallet to view balance</p>
        </CardContent>
      </Card>
    );
  }

  const mainTokens = balances.filter((b) => CONVERTIBLE_TOKENS.includes(b.token));
  const otherTokens = balances.filter((b) => !CONVERTIBLE_TOKENS.includes(b.token));

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">On-Chain Wallet</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && balances.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : balances.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No assets found
          </p>
        ) : (
          <>
            {mainTokens.map((token) => (
              <div
                key={token.token}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {token.token === 'ETH' ? 'Ξ' : '$'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{token.token}</p>
                    <p className="text-xs text-muted-foreground">Base</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono font-medium">
                    {parseFloat(token.balance).toFixed(token.token === 'ETH' ? 4 : 2)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3"
                    onClick={() => navigate(`/convert?token=${token.token}`)}
                  >
                    Convert
                  </Button>
                </div>
              </div>
            ))}

            {otherTokens.length > 0 && (
              <>
                <button
                  className="w-full flex items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowOther(!showOther)}
                >
                  <span>Other Assets ({otherTokens.length})</span>
                  {showOther ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showOther &&
                  otherTokens.map((token) => (
                    <div
                      key={token.token}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground">
                            {token.token.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{token.token}</p>
                          <p className="text-xs text-muted-foreground">Not convertible</p>
                        </div>
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        {parseFloat(token.balance).toFixed(4)}
                      </p>
                    </div>
                  ))}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
