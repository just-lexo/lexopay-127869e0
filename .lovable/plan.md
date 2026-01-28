

# LexoPay MVP - Implementation Plan

## Overview
A mobile-first crypto→NGN off-ramp web app with a dual wallet model. Users hold crypto raw in their crypto wallet and only convert to NGN when they choose. Built with React + Vite + TypeScript + Tailwind + Lovable Cloud (Supabase).

---

## Phase 1: Foundation & Core Flow

### 1.1 Design System & Theme
- Dark fintech theme with Base Blue (#0052FF) as primary accent
- Soft shadows, rounded corners, glassmorphism cards
- Mobile-first responsive design with large touch targets
- Custom font pairing for clean crypto-native typography

### 1.2 Landing Page (`/`)
- Hero section with value proposition: "Hold crypto raw. Convert only when you want."
- Visual showing dual wallet concept
- "Get Started" CTA button
- Clean footer with placeholder links

### 1.3 Authentication (`/auth`)
- Supabase auth with email/password sign-up and login
- After signup: prompt to set @username and display name
- Username uniqueness validation
- Redirect to dashboard on success

### 1.4 Dashboard (`/dashboard`)
- Personalized greeting with username
- KYC tier badge (visual indicator, mock for now)
- **Crypto Wallet Card**: Shows token balances by network (USDT on Base, etc.)
- **NGN Wallet Card**: Shows Naira balance
- Quick action buttons: Deposit, Convert, Withdraw, Transactions
- Protected route (requires auth)

### 1.5 Deposit Page (`/deposit`)
- Token selector (USDT, USDC)
- Network selector (Base as primary, others as placeholders)
- Generate mock deposit address with QR code
- Status tracker: Pending → Confirmed
- Dev button: "Simulate Confirm Deposit" to update balance

### 1.6 Convert Page (`/convert`)
- Select source: token + network + amount
- Fetch mock exchange rate (from RateProvider adapter)
- Transparent breakdown: rate, fees, final NGN amount
- Confirm button: deducts crypto, credits NGN, creates transaction record
- Success confirmation with receipt preview

---

## Phase 2: Withdrawals & Transactions

### 2.1 Withdraw Page (`/withdraw`)
- Bank selector from mock list (Nigerian banks)
- Account number input with "Verify" button (returns mock name)
- Amount input with available balance display
- Confirmation screen with fee breakdown
- Dev button: "Simulate Paid" to mark as SUCCESS

### 2.2 Transactions List (`/transactions`)
- Chronological list of all user transactions
- Each item shows: title, subtitle with @username, amount, status chip, timestamp
- Filter/search placeholder for future
- Click navigates to receipt detail

### 2.3 Receipt Detail (`/transactions/[id]`)
- Full transaction receipt view
- Reference number, parties (@usernames), amounts, fees
- Status with timeline
- Share/Download buttons (placeholders)

---

## Database Schema (Supabase)

### Tables to Create:
1. **profiles** - username, display_name, kyc_tier, linked to auth.users
2. **user_roles** - for admin/user role management (security)
3. **wallets** - user's CRYPTO and NGN wallet records
4. **crypto_balances** - per-token, per-network balances
5. **ngn_balances** - Naira balance per wallet
6. **deposits** - deposit records with status tracking
7. **conversions** - conversion records with rates and fees
8. **withdrawals** - bank withdrawal records
9. **transactions** - unified activity log with kind, title, status, metadata

### Row-Level Security:
- Users can only access their own data
- Profile username uniqueness enforced
- Secure role checking via security definer functions

---

## Modular Adapter Architecture

### Folder Structure:
```
/src/adapters/
  /chains/
    - base.adapter.ts (placeholder for Base chain integration)
    - types.ts (ChainAdapter interface)
  /banks/
    - payout.adapter.ts (placeholder for bank payout integration)
    - types.ts (BankPayoutAdapter interface)
  /rates/
    - rate.adapter.ts (mock rate provider)
    - types.ts (RateProvider interface)
```

### Rules Enforced:
- UI components never import from adapters directly
- All adapter calls go through Supabase Edge Functions
- Easy to swap implementations later (mock → real API)

---

## Dev Tools Panel
- Only visible in development mode
- Simulate deposit confirmations
- Simulate withdrawal status changes
- Quick balance adjustments for testing

---

## UI/UX Highlights
- **Dark mode default** with subtle blue accents
- **Base Blue (#0052FF)** for primary actions
- **Cards with glassmorphism** for wallet displays
- **Status chips** with semantic colors (pending=yellow, success=green, failed=red)
- **Big touch targets** (min 44px) for mobile usability
- **Smooth transitions** and loading states

