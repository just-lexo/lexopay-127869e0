import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KycStatus } from '@/hooks/useKycStatus';

interface Props {
  status: KycStatus;
  feature?: string; // e.g. "withdrawals"
}

export function KycGateBanner({ status, feature = 'this action' }: Props) {
  const navigate = useNavigate();
  if (status === 'APPROVED') return null;

  const config = {
    NOT_STARTED: {
      Icon: BadgeCheck,
      tone: 'border-primary/30 bg-primary/10',
      iconColor: 'text-primary',
      title: 'Verify your identity',
      message: `Complete verification to unlock ${feature}.`,
      cta: 'Start verification',
    },
    PENDING: {
      Icon: Clock,
      tone: 'border-warning/30 bg-warning/10',
      iconColor: 'text-warning',
      title: 'Verification in review',
      message: 'We\'re reviewing your identity. This usually takes 1–2 business days.',
      cta: 'View status',
    },
    REJECTED: {
      Icon: XCircle,
      tone: 'border-destructive/30 bg-destructive/10',
      iconColor: 'text-destructive',
      title: 'Verification rejected',
      message: 'Please update your details and resubmit.',
      cta: 'Resubmit',
    },
  }[status];

  const { Icon } = config;

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${config.tone}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{config.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.message}</p>
      </div>
      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => navigate('/kyc')}>
        {config.cta}
      </Button>
    </div>
  );
}
