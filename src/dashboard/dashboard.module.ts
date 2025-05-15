import { Module } from '@nestjs/common';
import { PaymentModule } from 'src/payment/payment.module';
import { UserMiscInfoModule } from 'src/userMiscInfo/userMiscInfo.module';
import { RequestModule } from '../request/request.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    RequestModule,
    UsersModule,
    PaymentModule,
    UserMiscInfoModule
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
  ],
  exports: [DashboardService],
})
export class DashboardModule { }
