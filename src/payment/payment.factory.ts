/* eslint-disable @typescript-eslint/camelcase */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';
import { GLOBAL_PREFIX, paginationLimit, USER_ROLES } from 'src/config';
import { payPalClient } from 'src/payment/paypal';
import { BaseFactory } from '../lib/base.factory';
import { Counter, Payment, User } from '../lib/index';
import { PaymentDto } from './payment.dto';
import paypal = require('@paypal/checkout-server-sdk');
import paypalNodeSdk = require('paypal-node-sdk');


@Injectable()
export class PaymentFactory extends BaseFactory {
  constructor(
    @InjectModel('payment') public readonly paymentModel: Model<Payment>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('request') public readonly requestModel: Model<Request>, // private socketService: SocketService
  ) {
    super(countersModel);

    // add paypal webhook
    // paypalNodeSdk.notification.webhook.list(function (error, res) {
    //   if (error) {
    //     throw error;
    //   } else {
    //     if (res?.webhooks?.length <= 0) {
    //       paypalNodeSdk.notification.webhook.create({
    //         url: `${process.env.SERVER_HOST}/${GLOBAL_PREFIX}/payment/paypal/webhook`,
    //         event_types: [{ name: "*" }]
    //       }, function (error, webhook) {
    //         if (error) {

    //           throw error;
    //         } else {

    //         }
    //       });
    //     }
    //   }
    // });
  }

  async createOrder(user: User, paymentData: Payment): Promise<Payment> {
    try {
      // Call PayPal to set up a transaction

      const paymentRequest = new paypal.orders.OrdersCreateRequest();
      paymentRequest.prefer('return=representation');
      paymentRequest.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: paymentData.currencyCode || 'USD',
              value: paymentData.amount,
            },
          },
        ],
      });

      const request = await this.requestModel
        .findOne({ _id: paymentData.request._id, isActive: true })
        .exec();

      if (!request) {
        throw new BadRequestException();
      }

      try {
        const order = await payPalClient().execute(paymentRequest);

        const data = {
          payee: user,
          amount: paymentData.amount,
          orderId: order.result.id,
          status: order.result.status,
          currencyCode: paymentData.currencyCode || 'USD',
          request: request,
          paymentForModel: paymentData.paymentForModel,
          type: paymentData.type,
          createdBy: this.getCreatedBy(user),
        };

        const id = await this.generateSequentialId('payment');

        data['id'] = id;

        const newPayment = new this.paymentModel(data);
        const result = await newPayment.save();
        const res = new PaymentDto(result);


        // Return a successful response to the client with the order ID
        return res;
      } catch (err) {
        console.error(err);
        throw new InternalServerErrorException();
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // async updatePaymentTransactionStatus(id: string, transactionStatus: string, user: User): Promise<Payment> {
  //     try {
  //         const filter = { payee: user, id };
  //         let data = { transactionStatus }
  //         data.updatedBy = this.getUpdatedBy(user);
  //         const newValue = { $set: { ...data } };
  //         const newPayment = await this.paymentModel.findOneAndUpdate(
  //             filter,
  //             newValue,
  //             { new: true },
  //         );
  //         const res = new PaymentDto(newPayment)
  //         return res;
  //     }
  //     catch (error) {
  //         console.error(error);
  //         throw error;
  //     }
  // }

  async captureTransaction(user: User, orderId: string): Promise<Payment> {
    try {
      // Call PayPal to capture the order
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      try {
        const capture = await payPalClient().execute(request);

        // Save the capture ID to your database. Implement logic to save capture to your database for future reference.
        const captureId =
          capture.result.purchase_units[0].payments.captures[0].id;
        const filter = { payee: user, orderId };
        const data = {
          captureId: captureId,
          status: capture.result.status,
          updatedBy: this.getUpdatedBy(user),
        };
        const newValue = { $set: { ...data } };
        const newPayment = await this.paymentModel.findOneAndUpdate(
          filter,
          newValue,
          { new: true },
        );

        // Return a successful response to the client
        // this.socketService.socket.to()
        const res = new PaymentDto(newPayment);
        return res;
      } catch (err) {
        // Handle any errors from the call
        console.error(err)
        throw new InternalServerErrorException();
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async paypalRefund(captureId: string): Promise<object> {
    try {
      // 2. Set up your server to receive a call from the client

      // 2. Get the capture ID from your database
      // const captureId = await database.lookupCaptureID();

      // 3. Call PayPal to refund the transaction
      const request = new paypal.payments.CapturesRefundRequest(captureId);
      request.requestBody({
        amount: {
          currency_code: 'USD',
          value: '1.00',
        },
      });

      try {
        const refund = await payPalClient().execute(request);

        // 5. Return a successful response to the client with the order ID
        return {
          refundID: refund.result.id,
        };
      } catch (err) {
        // 4. Handle any errors from the call
        console.error(err);
        throw new InternalServerErrorException();
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getTransaction(orderId: string): Promise<object> {
    try {
      // 2. Set up your server to receive a call from the client

      // 3. Call PayPal to get the transaction details
      const request = new paypal.orders.OrdersGetRequest(orderId);

      let order;
      try {
        order = await payPalClient().execute(request);
      } catch (err) {
        // 4. Handle any errors from the call
        throw new InternalServerErrorException();
      }

      // 5. Validate the transaction details are as expected
      if (order.result.purchase_units[0].amount.value !== '1.00') {
        throw new BadRequestException();
      }

      // 6. Save the transaction in your database
      // await database.saveTransaction(orderId);

      // 7. Return a successful response to the client
      return { data: 'test' };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getAllPayments(params: any, user: User): Promise<PaginatedData> {
    try {
      const skip = parseInt(params.skip) || 0;
      const filter = {};

      if (params.type) {
        filter['type'] = { $in: params.type.split(',') };
      }

      if (params.zipCode) {
        filter['request.zip'] = params.zipCode;
        filter['paymentForModel'] = 'request';
      }

      if (user.role !== USER_ROLES.ADMIN) {
        filter['payee'] = user;
      }

      const count = await this.paymentModel.countDocuments(filter);

      const payments = await this.paymentModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .populate('payee')
        .sort({ createdAt: 'desc' });

      const result = payments.map(res => new PaymentDto(res));

      const finalData = { result, count, skip };

      return finalData;
    } catch (error) {
      throw error;
    }
  }

  async getPaymentByParams(params: any, user: User): Promise<any> {
    try {
      const requestId = params['request'];
      delete params['request'];
      params['request._id'] = requestId;

      const result = await this.paymentModel
        .find({ ...params, payee: user })
        .sort({ createdAt: 'desc' })
        .limit(1);

      if (result && result.length) {
        const resDto = new PaymentDto(result[0]);
        return resDto;
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async paypalWebhook(eventData: any): Promise<object> {
    try {

      return { msg: "sucess" };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
