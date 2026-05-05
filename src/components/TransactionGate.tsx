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
  const allowed = emailConfirmed && isApproved;
  return { allowed, emailConfirmed, kycApproved: isApproved, kycStatus, loading };
}

export function TransactionGate({ feature = 'this action' }: Props) {
  const { emailConfirmed, kycStatus, kycApproved } = useTransactionGate();
  if (emailConfirmed && kycApproved) return null;
  return (
    <div className="space-y-2">
      {!emailConfirmed && <EmailVerificationBanner />}
      {emailConfirmed && !kycApproved && <KycGateBanner status={kycStatus} feature={feature} />}
    </div>
  );
}
