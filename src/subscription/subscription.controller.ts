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
  Res,       // ✅ ADD THIS
  Query,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
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
import * as mongoose from 'mongoose';
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
  modifiedCount: number

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
    const { plan, billingType: rawBillingType, userId: bodyUserId } = body;
    let user = req.user;
  
    console.log('Subscribe called with:', { plan, billingType: rawBillingType, bodyUserId });
  
    try {
      if (!user && bodyUserId) {
        user = await this.userModel.findOne({ _id: bodyUserId });
        if (!user) {
          console.error('User not found for userId:', bodyUserId);
          throw new BadRequestException('User not found');
        }
      }
  
      if (!user) {
        console.error('User authentication failed and no userId provided');
        throw new BadRequestException('User authentication failed or userId not provided');
      }
  
      const billingType = rawBillingType?.toUpperCase();
      console.log('Normalized billingType:', billingType);
  
      const isCustomer = user.role === USER_ROLES.CLIENT;
      console.log('User role:', user.role, 'Is customer:', isCustomer);
  
      const planDetails = isCustomer
        ? getCustomerPlanDetails(plan)
        : getAffiliatePlanDetails(plan);
  
      if (!planDetails) {
        console.error('Invalid plan:', plan);
        throw new BadRequestException('Invalid plan');
      }
  
      console.log('Plan details found:', planDetails);
  
      const priceId = planDetails.stripe?.[billingType];
      if (!priceId) {
        console.error(`Stripe price ID missing for plan "${plan}" and billingType "${billingType}"`);
        throw new BadRequestException('Stripe price ID not configured for this plan');
      }
  
      console.log('Using Stripe price ID:', priceId);
  
      // Create or reuse Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id.toString() },
      });
      console.log('Created Stripe customer:', customer.id);
  
      // Create Stripe Checkout session for subscription payment
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `https://your-frontend-url.com/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://your-frontend-url.com/subscription-cancelled`,
        metadata: {
          userId: user.id.toString(),
          plan,
          billingType,
        },
      });
  
      // Calculate expiry date (for your DB)
      const expiresAt = new Date();
      if (billingType === 'MONTHLY') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (billingType === 'YEARLY') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        console.warn('Unknown billingType for expiry calculation:', billingType);
      }
  
      // Save subscription record with status INACTIVE; webhook updates on payment success
      await this.userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            subscription: {
              subscriptionId: '', // Will update after webhook confirms subscription
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
  
      console.log('User subscription updated in DB for user:', user._id);
  
      return {
        checkoutUrl: session.url,
        message: 'Checkout session created, complete payment to activate subscription.',
      };
    } catch (error) {
      console.error('Error in subscribe:', error);
      throw error;
    }
  }
  
  
  
  
  
  

  

  @Post('lead-purchase')
  async leadPurchase(@Req() req, @Body() body: { amount: number; leadId: string; success_url: string; cancel_url: string }) {
    const user = req.user;
  
    if (!body.amount || !body.leadId || !body.success_url || !body.cancel_url) {
      throw new BadRequestException('Missing required fields');
    }
  
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: 'https://runmysale.com/api/v1/subscription/payment-redirect?status=success',
      cancel_url: 'https://runmysale.com/api/v1/subscription/payment-redirect?status=cancel',
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
      session:session.id,
      checkoutUrl: session.url,
      leadId: body.leadId,
    };
  }
  @Get('payment-redirect')
async redirectToApp(@Res() res: Response, @Query('status') status: string) {
  const deepLink = `runmysaleapp://payment?status=${status || 'unknown'}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Redirecting...</title>
        <script>
          window.location.href = '${deepLink}';
        </script>
      </head>
      <body>
        <p>Redirecting to app...</p>
      </body>
    </html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
@Get('lead-payment-status')
async getLeadPaymentStatus(@Query('session_id') sessionId: string) {
  if (!sessionId) {
    throw new BadRequestException('Missing session_id query parameter');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
    const paymentStatus = paymentIntent?.status || 'unknown';

    return {
      sessionId,
      leadId: session.metadata?.leadId || null,
      userId: session.metadata?.userId || null,
      paymentStatus,
      amountTotal: session.amount_total / 100,
      currency: session.currency,
    };
  } catch (error) {
    console.error('Stripe session fetch error:', error.message);
    throw new InternalServerErrorException('Failed to fetch payment status');
  }
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
    const user = await this.userModel
      .findOne({ id: req.user.id })
      .select('subscription')
      .lean();
  
    if (!user?.subscription) {
      return {};
    }
  
    const subscription = user.subscription;
    let planName = null;
  
    // If there's a valid Stripe subscriptionId, fetch its details
    if (subscription.subscriptionId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.subscriptionId, {
          expand: ['items.data.price.product'],
        });
  
        planName = (stripeSub.items.data[0]?.price?.product as Stripe.Product)?.name || null;
      } catch (err) {
        console.error('Failed to fetch subscription from Stripe:', err.message);
      }
    }
  
    return {
      type: subscription.type,
      billingType: subscription.billingType,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      jobRequestCountThisMonth: subscription.jobRequestCountThisMonth,
      pricingRequestsUsed: subscription.pricingRequestsUsed,
      customVideosUsed: subscription.customVideosUsed,
      pitchReviewsUsed: subscription.pitchReviewsUsed,
      subscriptionId: subscription.subscriptionId,
      planName,
    };
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
  @Put('update-subscription-id')
  async updateSubscriptionId(
    @Body() body: { userId: string; subscriptionId: string; customerId?: string }
  ) {
    const { userId, subscriptionId, customerId } = body;
  
    if (!userId || !subscriptionId) {
      throw new BadRequestException('userId and subscriptionId are required');
    }
  
    const updateData: any = {
      'subscription.subscriptionId': subscriptionId,
    };
  
    if (customerId) {
      updateData['subscription.customerId'] = customerId;
    }
  
    const result = await this.userModel.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: updateData }
    );
  
    const modifiedCount = (result as any).modifiedCount ?? (result as any).nModified ?? 0;
    if (modifiedCount === 0) {
      throw new InternalServerErrorException('Failed to update subscription');
    }
  
    return { success: true, message: 'Subscription updated successfully' };
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
    if (event.type === 'checkout.session.completed') {
      const session = dataObject;
      const subscriptionId = session.subscription;
      const userId = session.metadata?.userId;
    
      if (userId && subscriptionId) {
        await this.userModel.updateOne(
          { id: userId },
          {
            $set: {
              'subscription.subscriptionId': subscriptionId,
            },
          }
        );
      }
    }
    
    
    return { received: true };
  }
}
