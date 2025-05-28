export const CUSTOMER_PLANS = {
      STARTER: {
        name: 'Starter Plan',
        priceMonthly: 14,
        priceYearly: 119,
        stripe: {
          MONTHLY: 'price_1RNhiBRdnZqQYz46zJVFRE2W',
          YEARLY: 'price_1RNhzNRdnZqQYz46a1evyg0K',
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
          MONTHLY: 'price_1RNi0hRdnZqQYz46fb8YIl8D',
          YEARLY: 'price_1RNi0hRdnZqQYz46Q1JqOOT7',
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
          MONTHLY: 'price_1RNi1ORdnZqQYz46I6Mo9H3X',
          YEARLY: 'price_1RNi1ORdnZqQYz46ujlVv5ZD',
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
          MONTHLY: 'price_1RNi2ERdnZqQYz46Ar0r6NWZ',
          YEARLY: 'price_1RNi2ERdnZqQYz46HrFNFote',
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
          MONTHLY: 'price_1RNi2hRdnZqQYz46r5Ho1oNM',
          YEARLY: 'price_1RNi39RdnZqQYz46RmJYd4Ml',
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
          MONTHLY: 'price_1RNi41RdnZqQYz46olOeXXpo',
          YEARLY: 'price_1RNi41RdnZqQYz46dSIiA7vn',
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
    