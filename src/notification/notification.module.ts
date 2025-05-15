import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationFactory } from './notification.factory';
import { notificationSchema } from './notification.schema';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'notification', schema: notificationSchema }]),
    ],
    controllers: [NotificationController],
    providers: [NotificationFactory],
    exports: [
        MongooseModule.forFeature([{ name: 'notification', schema: notificationSchema }]),
        NotificationFactory,
    ]
})

export class NotificationModule { }