export const CUSTOMER_PLANS = {
      STARTER: {
        name: 'Starter Plan',
        priceMonthly: 14,
        priceYearly: 119,
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
    