import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { notificationSubscriptionSchema } from './notificationSubscription.schema';
import { NotificationSubscriptionController } from './notificationSubscription.controller';
import { NotificationSubscriptionFactory } from './notificationSubscription.factory';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'NotificationSubscription', schema: notificationSubscriptionSchema }]),
    ],
    controllers: [NotificationSubscriptionController],
    providers: [NotificationSubscriptionFactory],
    exports: [
        MongooseModule.forFeature([{ name: 'NotificationSubscription', schema: notificationSubscriptionSchema }]),
        NotificationSubscriptionFactory
    ]
})

export class NotificationSubscriptioneModule { }