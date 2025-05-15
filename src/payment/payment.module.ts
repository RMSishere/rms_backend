import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { PaymentFactory } from './payment.factory';
import { paymentSchema } from './payment.schema';
import { RequestModule } from 'src/request/request.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'payment', schema: paymentSchema }]),
        RequestModule
    ],
    controllers: [PaymentController],
    providers: [PaymentFactory],
    exports: [
        MongooseModule.forFeature([{ name: 'payment', schema: paymentSchema }]),
        PaymentFactory
    ]
})

export class PaymentModule { }