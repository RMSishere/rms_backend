import { CUSTOMER_PLANS, AFFILIATE_PLANS } from './plan';

export function getCustomerPlanDetails(plan: string) {
  return CUSTOMER_PLANS[plan] || null;
}

export function getAffiliatePlanDetails(plan: string) {
  return AFFILIATE_PLANS[plan] || null;
}

export function canPostJob(user: any, jobType: 'SELL' | 'REMOVE' | 'OTHER'): boolean {
  const sub = user.subscription;
  if (!sub || sub.status !== 'ACTIVE') return false;

  const plan = getCustomerPlanDetails(sub.type);
  if (!plan) return false;

  const allowed = jobType === 'SELL' || jobType === 'REMOVE' || plan.features.allowAllServices;
  if (!allowed) return false;

  if (plan.features.maxJobsPerMonth === Infinity) return true;
  return sub.jobRequestCountThisMonth < plan.features.maxJobsPerMonth;
}
