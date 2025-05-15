import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './users.controller';
import { UserFactory } from './users.factory';
import { usersSchema } from './users.schema';
import { UserMiscInfoModule } from '../userMiscInfo/userMiscInfo.module';
import { HelpMessageModule } from '../helpMessage/helpMessage.module';
import { ZipCodeSearchModule } from '../zipCodeSearch/zipCodeSearch.module';
import { NotificationSubscriptioneModule } from 'src/notificationSubscription/notificationSubscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'users', schema: usersSchema }]),
    UserMiscInfoModule,
    HelpMessageModule,
    ZipCodeSearchModule,
    NotificationSubscriptioneModule,
  ],
  controllers: [UserController],
  providers: [UserFactory],
  exports: [
    MongooseModule.forFeature([{ name: 'users', schema: usersSchema }]),
    UserFactory,
  ],
})
export class UsersModule {}
