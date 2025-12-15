import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationFactory } from './notification.factory';
import { notificationSchema } from './notification.schema';

// ✅ import these schemas (adjust paths if yours are different)
import { usersSchema } from '../users/users.schema'; // or wherever users schema is

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'notification', schema: notificationSchema },

      // ✅ REQUIRED (NotificationFactory injects @InjectModel('counters'))

      // ✅ REQUIRED (NotificationFactory injects @InjectModel('users'))
      { name: 'users', schema: usersSchema },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationFactory],
  exports: [
    // ✅ Export Mongoose models + factory so other modules can use them
    MongooseModule,
    NotificationFactory,
  ],
})
export class NotificationModule {}
