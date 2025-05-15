import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatFactory } from './chat.factory';
import { chatSchema } from './chat.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'chat', schema: chatSchema }]),
    NotificationModule,
  ],
  controllers: [ChatController],
  providers: [ChatFactory],
  exports: [
    MongooseModule.forFeature([{ name: 'chat', schema: chatSchema }]),
    ChatFactory,
  ],
})
export class ChatModule {}
