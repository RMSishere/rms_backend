// chat.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatFactory } from './chat.factory';
import { chatSchema } from './chat.schema';
import { NotificationModule } from '../notification/notification.module';

import { UsersModule } from '../users/users.module';       // ✅ exports users model
import { RequestModule } from '../request/request.module';  // ✅ exports request model
import { CounterModule } from '../counter/counter.module';  // ✅ exports counters model

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'chat', schema: chatSchema }]),
    UsersModule,
    RequestModule,
    CounterModule,
    NotificationModule,
  ],
  controllers: [ChatController],
  providers: [ChatFactory],
  exports: [ChatFactory],
})
export class ChatModule {}
