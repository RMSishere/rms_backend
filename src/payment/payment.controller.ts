/* eslint-disable @typescript-eslint/camelcase */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Render,
  Req,
} from '@nestjs/common';
import { getDecodedToken } from 'src/util/auth';
import { PaymentFactory } from './payment.factory';

@Controller('payment')
export class PaymentController {
  constructor(public readonly paymentFactory: PaymentFactory) {}

  @Get('')
  async getAllPayments(@Req() req, @Query() params: any) {
    return this.paymentFactory.getAllPayments(params, req.user);
  }

  @Get('paypal')
  @Render('paypal')
  async getPayPalView(
    @Query('token') token: string,
    @Query('paymentData') paymentData: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('OS') OS: string,
  ) {
    try {
      await getDecodedToken(token);

      return {
        clientId: process.env.PAYPAL_CLIENT_ID,
        paymentData,
        redirectUri,
        token,
        OS,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('/byParams')
  async getPaymentByParams(@Req() req, @Query() params: any) {
    return this.paymentFactory.getPaymentByParams(params, req.user);
  }

  @Post('paypal/order')
  async createOrder(@Req() req, @Body() paymentData) {
    return this.paymentFactory.createOrder(req.user, paymentData);
  }

  @Post('paypal/transaction/capture')
  async captureTransaction(@Body('orderId') orderId: string, @Req() req) {
    return this.paymentFactory.captureTransaction(req.user, orderId);
  }

  // @Put(':id')
  // async updatePaymentTransactionStatus(
  //     @Body('transactionStatus') transactionStatus: string,
  //     @Param('id') id: string,
  //     @Req() req,
  // ) {
  //     return this.paymentFactory.updatePaymentTransactionStatus(
  //         id,
  //         transactionStatus,
  //         req.user
  //     );
  // }

  @Post('paypal/refund')
  async paypalRefund(@Body('captureId') captureId: string) {
    return this.paymentFactory.paypalRefund(captureId);
  }

  @Post('paypal/transaction')
  async getTransaction(@Body('orderId') orderId: string) {
    return this.paymentFactory.getTransaction(orderId);
  }

  @HttpCode(200)
  @Post('paypal/webhook')
  async paypalWebhook(@Body() eventData: any) {
    return this.paymentFactory.paypalWebhook(eventData);
  }
}
