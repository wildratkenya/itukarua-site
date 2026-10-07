import type { EntitlementRole } from './database';

export type MpesaHandler = (
  amount: number,
  description: string,
  accountRef: string,
  paymentType?: string,
  relatedAdId?: string,
  relatedJobId?: string,
  relatedProfileId?: string,
  onComplete?: () => void,
  employerPlans?: boolean,
  employerExpired?: boolean,
  employerExpiredAt?: string | null,
  role?: EntitlementRole,
  relatedAccountId?: string,
  relatedInvoiceId?: string,
  opts?: { metadata?: Record<string, unknown>; defaultPhone?: string; payingOnBehalfOf?: string }
) => void;
