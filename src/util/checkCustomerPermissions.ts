export function checkCustomerPermissions(user, serviceType: string) {
      const sub = user.subscription;
      if (!sub || sub.status !== 'ACTIVE') return { allowed: false, reason: 'Plan inactive' };
    
      if (sub.type === 'STARTER') {
        if (serviceType !== 'SELL' && serviceType !== 'REMOVE') {
          return { allowed: false, reason: 'This plan only allows selling/removing items' };
        }
        if (sub.jobRequestCountThisMonth >= 1) {
          return { allowed: false, reason: 'Only 1 job allowed per month on Starter plan' };
        }
      }
    
      if (sub.type === 'SIMPLIFY') {
        return { allowed: true };
      }
    
      if (sub.type === 'WHITE_GLOVE') {
        return { allowed: true };
      }
    
      return { allowed: false, reason: 'Unknown subscription type' };
    }
    