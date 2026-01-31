import { cn } from '@/lib/utils';

interface TransactionAmountProps {
  kind: string;
  amountDisplay: string;
  metadata?: Record<string, unknown> | null;
  className?: string;
}

/**
 * Formats transaction amounts for mobile readability with two-line display
 * for complex transactions (conversions, withdrawals)
 */
export function TransactionAmount({ kind, amountDisplay, metadata, className }: TransactionAmountProps) {
  const isPositive = amountDisplay.startsWith('+');
  
  // Parse and format based on transaction type
  if (kind === 'CONVERT' && metadata) {
    const fromAmount = metadata.from_amount as number | undefined;
    const fromToken = metadata.from_token as string | undefined;
    const ngnAmount = metadata.ngn_amount as number | undefined;
    const fee = metadata.fee as number | undefined;

    if (fromAmount && fromToken && ngnAmount) {
      return (
        <div className={cn("text-right", className)}>
          <p className="font-mono font-semibold text-sm">
            -{fromAmount} {fromToken} → <span className="text-success">+₦{ngnAmount.toLocaleString()}</span>
          </p>
          {fee && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Fee: ₦{fee.toLocaleString()}
            </p>
          )}
        </div>
      );
    }
  }

  if (kind === 'WITHDRAW' && metadata) {
    const amount = metadata.amount as number | undefined;
    const fee = metadata.fee as number | undefined;
    const total = (amount || 0) + (fee || 0);

    if (amount && fee) {
      return (
        <div className={cn("text-right", className)}>
          <p className="font-mono font-semibold text-sm">
            -₦{total.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sent ₦{amount.toLocaleString()} • Fee ₦{fee}
          </p>
        </div>
      );
    }
  }

  // Simple display for DEPOSIT, SEND, RECEIVE
  return (
    <div className={cn("text-right", className)}>
      <p className={cn(
        "font-mono font-semibold text-sm",
        isPositive && "text-success"
      )}>
        {amountDisplay}
      </p>
    </div>
  );
}
