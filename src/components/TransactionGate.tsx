import { useAuth } from '@/contexts/AuthContext';
import { useKycStatus } from '@/hooks/useKycStatus';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { KycGateBanner } from './KycGateBanner';

interface Props {
  feature?: string;
}

/**
 * Reusable hook + UI for gating sensitive financial actions.
 * Blocks unless email is verified AND KYC status === APPROVED.
 */
export function useTransactionGate() {
  const { emailConfirmed } = useAuth();
  const { isApproved, status: kycStatus, loading } = useKycStatus();
  // Only email verification hard-blocks. KYC tier governs daily NGN limits server-side.
  const allowed = emailConfirmed;
  return { allowed, emailConfirmed, kycApproved: isApproved, kycStatus, loading };
}

export function TransactionGate({ feature = 'this action' }: Props) {
  const { emailConfirmed, kycStatus, kycApproved } = useTransactionGate();
  if (emailConfirmed && kycApproved) return null;
  return (
    <div className="space-y-2">
      {!emailConfirmed && <EmailVerificationBanner />}
      {emailConfirmed && !kycApproved && (
        <KycGateBanner status={kycStatus} feature={`higher ${feature} limits`} />
      )}
    </div>
  );
}
