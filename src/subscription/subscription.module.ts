import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { usersSchema } from '../users/users.schema'; // adjust path if needed

@Module({
      imports: [
            MongooseModule.forFeature([{ name: 'users', schema: usersSchema }]),
          ],
  controllers: [SubscriptionController],
})
export class SubscriptionModule {}
