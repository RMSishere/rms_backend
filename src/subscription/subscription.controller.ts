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
  Res,
  Query,
  InternalServerErrorException,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import mongoose from 'mongoose';

import Stripe from 'stripe';

import {
  getCustomerPlanDetails,
  getAffiliatePlanDetails,
  canPostJob,
} from './subscription.utils';
import { CUSTOMER_PLANS, AFFILIATE_PLANS } from './plan';

import { Roles } from 'src/common/decorators/roles.decorator';
import { USER_ROLES } from 'src/config';
import { RolesGuard } from 'src/common/guards/roles.guard';

// ✅ Guard that ALWAYS allows (used only on webhook to bypass RolesGuard)
class AllowAllGuard implements CanActivate {
  canActivate(_context: ExecutionContext) {
    return true;
  }
}

const stripe = new Stripe('REMOVED_STRIPE_LIVE_KEY', {
  apiVersion: '2025-08-27.basil',
});

const STRIPE_WEBHOOK_SECRET = 'whsec_QcumBf3YBDiTzem2EsrBodKrhxTMDNLL';

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
  _id: Types.ObjectId | string;
  id?: any;
  email: string;
  role: number;
  subscription?: Subscription;
  modifiedCount: number;
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
      jobRequestCountThisMonth:
        user?.subscription?.jobRequestCountThisMonth || 0,
    };
  }

  // -------------------------
  // KEEP YOUR EXISTING ROUTES
  // (subscribe, lead-purchase, finalize-sale, change-plan, cancel, status, etc.)
  // -------------------------

  // ✅✅✅ STRIPE + REVENUECAT WEBHOOK (WORKING ON YOUR NEST VERSION)
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(AllowAllGuard) // ✅ bypass controller-level RolesGuard for webhook only
  async webhookHandler(
    @Req() req: Request & { body: Buffer }, // ✅ Buffer because express.raw used on this route
    @Res() res: Response,
    @Headers('stripe-signature') sig?: string,
  ) {
    // --------------------------
    // 1) STRIPE WEBHOOK (signature exists)
    // --------------------------
    if (sig) {
      let event: Stripe.Event;

      try {
        // ✅ Use raw Buffer from req.body (express.raw)
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          STRIPE_WEBHOOK_SECRET,
        );
      } catch (err: any) {
        console.error('❌ Invalid Stripe webhook signature:', err.message);
        return res.status(400).send('Invalid Stripe webhook');
      }

      // ✅ ACK Stripe immediately
      res.status(200).json({ received: true });

      // ✅ Process after ACK
      try {
        const dataObject: any = event.data.object;

        switch (event.type) {
          case 'invoice.payment_succeeded': {
            const subscriptionId = dataObject.subscription;

            await this.userModel.updateOne(
              { 'subscription.subscriptionId': subscriptionId },
              {
                $set: {
                  'subscription.status': 'ACTIVE',
                  'subscription.startedAt': new Date(),
                  // ⚠️ This assumes MONTHLY. If you support YEARLY, compute it properly.
                  'subscription.expiresAt': new Date(
                    new Date().setMonth(new Date().getMonth() + 1),
                  ),
                },
              },
            );
            break;
          }

          case 'invoice.payment_failed': {
            const subscriptionId = dataObject.subscription;

            await this.userModel.updateOne(
              { 'subscription.subscriptionId': subscriptionId },
              { $set: { 'subscription.status': 'INACTIVE' } },
            );
            break;
          }

          case 'customer.subscription.deleted': {
            const subscriptionId = dataObject.id;

            await this.userModel.updateOne(
              { 'subscription.subscriptionId': subscriptionId },
              {
                $set: {
                  'subscription.status': 'CANCELED',
                  'subscription.expiresAt': new Date(),
                },
              },
            );
            break;
          }

          case 'checkout.session.completed': {
            const session = dataObject;
            const subscriptionId = session.subscription;
            const userId = session.metadata?.userId;

            if (userId && subscriptionId) {
              await this.userModel.updateOne(
                { id: userId },
                { $set: { 'subscription.subscriptionId': subscriptionId } },
              );
            }
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error('❌ Stripe webhook handler error:', e);
      }

      return; // response already sent
    }

    // --------------------------
    // 2) REVENUECAT WEBHOOK (NO stripe-signature)
    // express.raw() means body is Buffer => parse JSON manually
    // --------------------------
    try {
      const raw = req.body?.toString('utf8') || '{}';
      const body: any = JSON.parse(raw);

      const userId = body?.app_user_id;
      const productId = body?.product_id;

      const purchaseDate = body?.purchase_date ? new Date(body.purchase_date) : null;
      const expiresDate = body?.expires_date ? new Date(body.expires_date) : null;

      const subscriptionStatus =
        body?.subscriber?.subscriptions?.[productId]?.status || null;

      if (!userId) {
        console.error('RevenueCat webhook missing app_user_id');
        return res.status(200).json({ received: true });
      }

      const user = await this.userModel.findOne({ id: userId });
      if (!user) {
        console.error('User not found for RevenueCat userId:', userId);
        return res.status(200).json({ received: true });
      }

      let mappedStatus = 'INACTIVE';
      if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
        mappedStatus = 'ACTIVE';
      } else if (subscriptionStatus === 'expired') {
        mappedStatus = 'INACTIVE';
      } else if (subscriptionStatus === 'canceled') {
        mappedStatus = 'CANCELED';
      }

      await this.userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            'subscription.type': productId,
            'subscription.status': mappedStatus,
            'subscription.startedAt': purchaseDate || user.subscription?.startedAt,
            'subscription.expiresAt': expiresDate || user.subscription?.expiresAt,
          },
        },
      );

      return res.status(200).json({ received: true });
    } catch (e) {
      console.error('❌ RevenueCat webhook handler error:', e);
      return res.status(200).json({ received: true });
    }
  }
}
