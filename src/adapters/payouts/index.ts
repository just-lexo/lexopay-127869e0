// Payout Provider Exports
export * from './types';
export { paystackPayoutAdapter } from './paystackPayoutAdapter';
export { flutterwavePayoutAdapter } from './flutterwavePayoutAdapter';

// Default active provider
import { paystackPayoutAdapter } from './paystackPayoutAdapter';
export const activePayoutProvider = paystackPayoutAdapter;
