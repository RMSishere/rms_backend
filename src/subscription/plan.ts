export const CUSTOMER_PLANS = {
  STARTER: {
    name: 'Starter Plan',
    priceMonthly: 14,
    priceYearly: 119,
    stripe: {
      MONTHLY: 'price_1SGR4ODjCc6csnpijxKuV3in',
      YEARLY: 'price_1SGR4hDjCc6csnpimy3RG69m',
    },
    features: {
      maxJobsPerMonth: 1,
      allowExtras: false,
      topFeedVisibilityDays: 0,
      allowAllServices: false,
      topRatedAlerts: false,
    },
  },
  SIMPLIFY: {
    name: 'Simplify Plan',
    priceMonthly: 22,
    priceYearly: 211,
    stripe: {
      MONTHLY: 'price_1SGR3DDjCc6csnpiQ35xBpxr',
      YEARLY: 'price_1SGR3WDjCc6csnpiX579C4t5',
    },
    features: {
      maxJobsPerMonth: Infinity,
      allowExtras: true,
      topFeedVisibilityDays: 7,
      allowAllServices: true,
      topRatedAlerts: true,
    },
  },
  WHITE_GLOVE: {
    name: 'White Glove Plan',
    priceMonthly: 44,
    priceYearly: 370,
    stripe: {
      MONTHLY: 'price_1SGR2IDjCc6csnpiEffOaRKv',
      YEARLY: 'price_1SGR2VDjCc6csnpi68Hm214Y',
    },
    features: {
      maxJobsPerMonth: Infinity,
      allowExtras: true,
      topFeedVisibilityDays: 7,
      allowAllServices: true,
      topRatedAlerts: true,
      fastPass: true,
      strategyChat: true,
      dedicatedSupport: true,
      labelKit: true,
      estimateHelp: true,
    },
  },
};

export const AFFILIATE_PLANS = {
  STANDARD: {
    name: 'Standard',
    priceMonthly: 29,
    priceYearly: 247,
    stripe: {
      MONTHLY: 'price_1SGR1YDjCc6csnpimZSQE8Hy',
      YEARLY: 'price_1SGR1mDjCc6csnpirFBVPIeC',
    },
    features: {
      pricingHelp: 10,
      dashboardAccess: true,
      discount: 5,
    },
  },
  PREMIUM: {
    name: 'Premium',
    priceMonthly: 49,
    priceYearly: 392,
    stripe: {
      MONTHLY: 'price_1SGR15DjCc6csnpiBqjAqa6t',
      YEARLY: 'price_1SGR0YDjCc6csnpior13ZL5g',
    },
    features: {
      pricingHelp: 20,
      dashboardAccess: true,
      communityAccess: true,
      trainingAccess: true,
      discount: 10,
    },
  },
  PRO_PARTNER: {
    name: 'Pro Partner',
    priceMonthly: 99,
    priceYearly: 693,
    stripe: {
      MONTHLY: 'price_1SGQzxDjCc6csnpiy51DRxP7',
      YEARLY: 'price_1SGQzxDjCc6csnpiAkev5rj7',
    },
    features: {
      pricingHelp: 20,
      dashboardAccess: true,
      communityAccess: true,
      trainingAccess: true,
      discount: 20,
      customVideo: true,
      invoiceHelp: true,
      leadPriority: true,
      pitchReview: true,
      quarterlyReport: true,
    },
  },
};
