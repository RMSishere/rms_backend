export const customer_plans = {
  starter: {
    name: 'Starter Plan',
    priceMonthly: 14,
    priceYearly: 119,
    stripe: {
      MONTHLY: 'price_1RNhiBRdnZqQYz46zJVFRE2W', // Starter monthly
      YEARLY: 'price_1RNhzNRdnZqQYz46a1evyg0K',  // Starter yearly
    },
    features: {
      maxJobsPerMonth: 1,
      allowExtras: false,
      topFeedVisibilityDays: 0,
      allowAllServices: false,
      topRatedAlerts: false,
    },
  },
  simplify: {
    name: 'Simplify Plan',
    priceMonthly: 22,
    priceYearly: 211,
    stripe: {
      MONTHLY: 'price_1RNi0hRdnZqQYz46fb8YIl8D', // Simplify monthly
      YEARLY: 'price_1RNi0hRdnZqQYz46Q1JqOOT7',  // Simplify yearly
    },
    features: {
      maxJobsPerMonth: Infinity,
      allowExtras: true,
      topFeedVisibilityDays: 7,
      allowAllServices: true,
      topRatedAlerts: true,
    },
  },
  white_glove: {
    name: 'White Glove Plan',
    priceMonthly: 44,
    priceYearly: 370,
    stripe: {
      MONTHLY: 'price_1RNi1ORdnZqQYz46I6Mo9H3X', // White Glove monthly
      YEARLY: 'price_1RNi1ORdnZqQYz46ujlVv5ZD',  // White Glove yearly
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

export const affiliate_plans = {
  standard: {
    name: 'Standard',
    priceMonthly: 29,
    priceYearly: 247,
    stripe: {
      MONTHLY: 'price_1RNi2ERdnZqQYz46Ar0r6NWZ', // Standard monthly
      YEARLY: 'price_1RNi2ERdnZqQYz46HrFNFote',  // Standard yearly
    },
    features: {
      pricingHelp: 10,
      dashboardAccess: true,
      discount: 5,
    },
  },
  premium: {
    name: 'Premium',
    priceMonthly: 49,
    priceYearly: 392,
    stripe: {
      MONTHLY: 'price_1RNi2hRdnZqQYz46r5Ho1oNM', // Premium monthly
      YEARLY: 'price_1RNi39RdnZqQYz46RmJYd4Ml',  // Premium yearly
    },
    features: {
      pricingHelp: 20,
      dashboardAccess: true,
      communityAccess: true,
      trainingAccess: true,
      discount: 10,
    },
  },
  pro_partner: {
    name: 'Pro Partner',
    priceMonthly: 99,
    priceYearly: 693,
    stripe: {
      MONTHLY: 'price_1RNi41RdnZqQYz46olOeXXpo', // Pro Partner monthly
      YEARLY: 'price_1RNi41RdnZqQYz46dSIiA7vn',  // Pro Partner yearly
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
