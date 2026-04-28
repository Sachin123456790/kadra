import { get, post } from './api-client';
import type { OnboardingSummary } from './investors.service';

export type { OnboardingSummary } from './investors.service';

export interface ProfileUpdatePayload {
  legalName?: string;
  country?: string;
  taxId?: string;
  sourceOfIncome?: string;
}

export function getMyOnboarding() {
  return get<OnboardingSummary>('/investor/me/onboarding');
}

export function updateMyProfile(body: ProfileUpdatePayload) {
  return post<{
    investorId: string;
    legalName: string;
    email: string | null;
    metadata: Record<string, unknown>;
  }>('/investor/me/profile', body);
}
