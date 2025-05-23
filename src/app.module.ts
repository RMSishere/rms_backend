import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentModule } from './appointment/appointment.module';
import { ChatModule } from './chat/chat.module';
import { isPhoneNumberVerifiedMiddleware } from './common/middleware/isPhoneNumberVerified.middleware';
import { tokenMiddleware } from './common/middleware/token.middleware';
import { GLOBAL_PREFIX } from './config';
import { CounterModule } from './counter/counter.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { NotificationModule } from './notification/notification.module';
import { NotificationSubscriptioneModule } from './notificationSubscription/notificationSubscription.module';
import { PaymentModule } from './payment/payment.module';
import { RequestModule } from './request/request.module';
import { ScheduleJobsModule } from './scheduleJob/scheduleJob.module';
import { UsersModule } from './users/users.module';
import { winstonConfig } from './util/logger';
import { ZipCodeModule } from './zipCode/zipCode.module';
import { ZipCodeSearchModule } from './zipCodeSearch/zipCodeSearch.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionController } from './subscription/subscription.controller'; // adjust path as needed

const commonExcludeRoutes = [
  { path: `${GLOBAL_PREFIX}`, method: RequestMethod.GET },
  { path: `${GLOBAL_PREFIX}/logs(/?.*)`, method: RequestMethod.GET },
  { path: `${GLOBAL_PREFIX}/auth/login`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/auth/logout`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/auth/register`, method: RequestMethod.POST },
  // { path: `${GLOBAL_PREFIX}/auth/wp-register`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/auth/wp-register`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/subscription/update-subscription-id`, method: RequestMethod.PUT },

  { path: `${GLOBAL_PREFIX}/auth/facebook`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/auth/apple`, method: RequestMethod.POST },
  {
    path: `${GLOBAL_PREFIX}/auth/facebook/deletion`,
    method: RequestMethod.GET,
  },
  {
    path: `${GLOBAL_PREFIX}/auth/facebook/removeUser`,
    method: RequestMethod.POST,
  },
  {
    path: `${GLOBAL_PREFIX}/auth/verificationCode/request`,
    method: RequestMethod.POST,
  },
  
  {
    path: `${GLOBAL_PREFIX}/auth/verificationCode/verify`,
    method: RequestMethod.POST,
  },
  {
    path: `${GLOBAL_PREFIX}/auth/affiliate`,
    method: RequestMethod.GET,
  },
  {
    path: `${GLOBAL_PREFIX}/auth/affiliate/:id/approveProfile`,
    method: RequestMethod.PUT,
  },
  {
    path: `${GLOBAL_PREFIX}/auth/sendText`,
    method: RequestMethod.POST,
  },
  {
    path: `${GLOBAL_PREFIX}/subscription/subscribe`,
    method: RequestMethod.POST,
  },
  // {
  //   path: `${GLOBAL_PREFIX}/auth/businessProfile`,
  //   method: RequestMethod.POST,
  // },
  {
    path: `${GLOBAL_PREFIX}/auth/checkPhoneNumber`,
    method: RequestMethod.POST,
  },
  { path: `${GLOBAL_PREFIX}/payment/paypal/webhook`, method: RequestMethod.POST },
  { path: `${GLOBAL_PREFIX}/payment/paypal`, method: RequestMethod.GET },
];

@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'logs'),
      serveRoot: '/logs',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '.well-known/acme-challenge'),
      serveRoot: '/.well-known/acme-challenge',
    }),
    ScheduleModule.forRoot(),
    EventsModule,
    UsersModule,
    CounterModule,
    ChatModule,
    PaymentModule,
    RequestModule,
    NotificationModule,
    AppointmentModule,
    ZipCodeModule,
    NotificationSubscriptioneModule,
    DashboardModule,
    ScheduleJobsModule,
    ZipCodeSearchModule,
    MongooseModule.forRoot(process.env.DB_URL, {
      useNewUrlParser: true,
      useFindAndModify: false,
      autoIndex: false, // disables auto index creation
    }),
  ],
  controllers: [AppController,SubscriptionController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(tokenMiddleware)
      .exclude(...commonExcludeRoutes)
      .forRoutes('*')
      .apply(isPhoneNumberVerifiedMiddleware)
      .exclude(
        ...commonExcludeRoutes,
        { path: `${GLOBAL_PREFIX}/auth/update`, method: RequestMethod.PUT },
        {
          path: `${GLOBAL_PREFIX}/auth/socialLogin`,
          method: RequestMethod.PUT,
        },
        { path: `${GLOBAL_PREFIX}/notifications`, method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
