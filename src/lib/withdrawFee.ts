// Mirror of the calculate_withdraw_fee SQL function.
// Server is the source of truth — this is just for instant UI display.
export type FeeBreakdown = {
  base_fee: number;
  stamp_duty: number;
  total_fee: number;
  tier_discount_pct: number;
};

export function calculateWithdrawFee(amount: number, tier: number = 0): FeeBreakdown {
  if (!amount || amount <= 0) return { base_fee: 0, stamp_duty: 0, total_fee: 0, tier_discount_pct: 0 };

  let base = 100;
  if (amount < 5000) base = 20;
  else if (amount < 50000) base = 30;
  else if (amount < 200000) base = 50;

  let discountPct = 0;
  if (tier >= 3) { base = base * 0.5; discountPct = 50; }
  else if (tier >= 2) { base = base * 0.75; discountPct = 25; }

  const stamp = amount >= 10000 ? 50 : 0;
  return {
    base_fee: Math.round(base * 100) / 100,
    stamp_duty: stamp,
    total_fee: Math.round((base + stamp) * 100) / 100,
    tier_discount_pct: discountPct,
  };
}
