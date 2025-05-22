import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Put,
  UseGuards,
  HttpCode,
  Headers,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  getCustomerPlanDetails,
  getAffiliatePlanDetails,
  canPostJob,
} from './subscription.utils';
import { CUSTOMER_PLANS, AFFILIATE_PLANS } from './plan';
import { Roles } from 'src/common/decorators/roles.decorator';
import { USER_ROLES } from 'src/config';
import { RolesGuard } from 'src/common/guards/roles.guard';
import Stripe from 'stripe';
import { Types } from 'mongoose';

const stripe = new Stripe(
  'REMOVED_STRIPE_TEST_KEY',
  { apiVersion: '2025-04-30.basil' }
);

const STRIPE_WEBHOOK_SECRET = 'whsec_eFeLRLlhDR3zZ3PGzuzbGZ9rptTeBwY0'; // Set this from your Stripe dashboard

interface Subscription {
  type: string;
  billingType: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELED';
  startedAt: Date;
  expiresAt: Date;
  jobRequestCountThisMonth: number;
  pricingRequestsUsed: number;
  customVideosUsed: number;
  pitchReviewsUsed: number;
  lastReset: Date;
  subscriptionId?: string;
  customerId?: string;
}

interface User {
  _id: Types.ObjectId | string; // MongoDB ObjectId
  id?: any;
  email: string;
  role: number;
  subscription?: Subscription;
}

@UseGuards(RolesGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(@InjectModel('users') private readonly userModel: Model<User>) {}

  @Get('plans/customer')
  getCustomerPlans() {
    return CUSTOMER_PLANS;
  }

  @Get('plans/affiliate')
  getAffiliatePlans() {
    return AFFILIATE_PLANS;
  }
  @Get('job-request-count')
  async getJobRequestCount(@Req() req) {
    const user = await this.userModel
      .findOne({ id: req.user.id })
      .select('subscription.jobRequestCountThisMonth')
      .lean();
  
    return {
      jobRequestCountThisMonth: user?.subscription?.jobRequestCountThisMonth || 0,
    };
  }
  
  
  @Post('subscribe')      
  async subscribe(@Req() req, @Body() body) {
    const { plan, billingType, userId: bodyUserId } = body;
    let user = req.user;
  
    if (!user && bodyUserId) {
      user = await this.userModel.findOne({ _id: bodyUserId });
      if (!user) {
        throw new BadRequestException('User not found');
      }
    }
  
    if (!user) {
      throw new BadRequestException('User authentication failed or userId not provided');
    }
  
    const isCustomer = user.role === USER_ROLES.CLIENT;
    const planDetails = isCustomer
      ? getCustomerPlanDetails(plan)
      : getAffiliatePlanDetails(plan);
  
    if (!planDetails) {
      throw new BadRequestException('Invalid plan');
    }
  
    const priceId = planDetails.stripe?.[billingType];
    if (!priceId) {
      throw new BadRequestException('Stripe price ID not configured for this plan');
    }
  
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id.toString() },
    });
  console.log("dataaaa",customer.id,priceId,)
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  
    const invoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent?: Stripe.PaymentIntent;
    };
  
    if (!invoice.payment_intent?.client_secret) {
      throw new InternalServerErrorException('Stripe client_secret not available');
    }
  
    const expiresAt = new Date();
    billingType === 'MONTHLY'
      ? expiresAt.setMonth(expiresAt.getMonth() + 1)
      : expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          subscription: {
            subscriptionId: subscription.id,
            customerId: customer.id,
            type: plan,
            billingType,
            status: 'INACTIVE',
            startedAt: new Date(),
            expiresAt,
            jobRequestCountThisMonth: 0,
            pricingRequestsUsed: 0,
            customVideosUsed: 0,
            pitchReviewsUsed: 0,
            lastReset: new Date(),
          },
        },
      }
    );
  
    return {
      clientSecret: invoice.payment_intent.client_secret,
      subscriptionId: subscription.id,
    };
  }
  

  @Post('lead-purchase')
 async leadPurchase(@Req() req, @Body() body: { amount: number; leadId: string }) {
  const user = req.user;
  
  if (!body.amount || !body.leadId) {
    throw new BadRequestException('Missing amount or lead ID');
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `https://yourapp.com/payment-success?leadId=${body.leadId}`,
    cancel_url: `https://yourapp.com/payment-cancelled?leadId=${body.leadId}`,
    metadata: {
      userId: user.id.toString(),
      leadId: body.leadId,
      type: 'LEAD_PURCHASE',
    },
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Lead Purchase',
        },
        unit_amount: Math.round(body.amount * 100),
      },
      quantity: 1,
    }],
  });

  return {
    checkoutUrl: session.url,
    leadId: body.leadId,
  };
}


  @Put('change-plan')
  async changePlan(@Req() req, @Body() body) {
    const { newPlan, billingType } = body;
    const user = req.user;
    const isCustomer = user.role === USER_ROLES.CLIENT;

    const planDetails = isCustomer
      ? getCustomerPlanDetails(newPlan)
      : getAffiliatePlanDetails(newPlan);

    if (!planDetails) {
      return { error: 'Invalid plan' };
    }

    const expiresAt = new Date();
    if (billingType === 'MONTHLY') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    await this.userModel.updateOne(
      { id: user.id },
      {
        $set: {
          subscription: {
            type: newPlan,
            billingType,
            status: 'ACTIVE',
            startedAt: new Date(),
            expiresAt,
            jobRequestCountThisMonth: 0,
            pricingRequestsUsed: 0,
            customVideosUsed: 0,
            pitchReviewsUsed: 0,
            lastReset: new Date(),
          },
        },
      }
    );

    return { success: true, message: 'Subscription plan updated' };
  }

  @Put('cancel')
  async cancelSubscription(@Req() req) {
    await this.userModel.updateOne(
      { id: req.user.id },
      {
        $set: {
          'subscription.status': 'CANCELED',
          'subscription.expiresAt': new Date(),
        },
      }
    );
    return { success: true };
  }

  @Get('status')
  async getStatus(@Req() req) {
    console.log(req.user,'testtt');
    const user = await this.userModel
      .findOne({ id: req.user.id })
      .select('subscription')
      .lean();
    return user?.subscription || {};
  }

  @Put('use-job-credit')
  async useCredit(@Req() req) {
    const user = req.user;
    const plan = getCustomerPlanDetails(user.subscription?.type);
    if (!plan) return { error: 'No active plan' };

    const newCount = (user.subscription.jobRequestCountThisMonth || 0) + 1;

    await this.userModel.updateOne(
      { id: user.id },
      { $set: { 'subscription.jobRequestCountThisMonth': newCount } }
    );

    return { success: true };
  }

  @Get('eligibility-check')
  async checkEligibility(@Req() req, @Body('type') jobType: 'SELL' | 'REMOVE' | 'OTHER') {
    return {
      canPost: canPostJob(req.user, jobType),
    };
  }

  @Put('reset-monthly-limits')
  @Roles(USER_ROLES.ADMIN)
  async resetLimits(@Req() req) {
    await this.userModel.updateMany(
      { 'subscription.type': { $in: ['STARTER', 'SIMPLIFY', 'WHITE_GLOVE'] } },
      {
        $set: {
          'subscription.jobRequestCountThisMonth': 0,
          'subscription.pricingRequestsUsed': 0,
          'subscription.customVideosUsed': 0,
          'subscription.pitchReviewsUsed': 0,
          'subscription.lastReset': new Date(),
        },
      }
    );

    return { success: true };
  }

  @HttpCode(200)
  @Post('webhook')
  async stripeWebhook(@Body() body: any, @Headers('stripe-signature') sig: string) {
    let event: Stripe.Event;
console.log('hi');
    try {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Invalid Stripe webhook:', err.message);
      throw new BadRequestException('Invalid Stripe webhook');
    }

    const dataObject = event.data.object as any;

    if (event.type === 'invoice.payment_succeeded') {
      const subscriptionId = dataObject.subscription;
      await this.userModel.updateOne(
        { 'subscription.subscriptionId': subscriptionId },
        {
          $set: {
            'subscription.status': 'ACTIVE',
            'subscription.startedAt': new Date(),
            'subscription.expiresAt': new Date(new Date().setMonth(new Date().getMonth() + 1)),
          },
        }
      );
    }

    if (event.type === 'invoice.payment_failed') {
      const subscriptionId = dataObject.subscription;
      await this.userModel.updateOne(
        { 'subscription.subscriptionId': subscriptionId },
        {
          $set: {
            'subscription.status': 'INACTIVE',
          },
        }
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscriptionId = dataObject.id;
      await this.userModel.updateOne(
        { 'subscription.subscriptionId': subscriptionId },
        {
          $set: {
            'subscription.status': 'CANCELED',
            'subscription.expiresAt': new Date(),
          },
        }
      );
    }

    return { received: true };
  }
}
