import { Controller, Get, Param, Put, Query, Req } from "@nestjs/common";
import { NotificationFactory } from './notification.factory';

@Controller('notifications')
export class NotificationController {
  constructor(public readonly notificationFactory: NotificationFactory) { }

  @Put(':id/read')
  async readNotification(
    @Param('id') id: string,
  ) {
    return this.notificationFactory.readNotification(id);
  }

  @Get()
  async getUserNotificatons(
    @Req() req,
    @Query() params: any
  ) {
    return this.notificationFactory
      .getUserNotificatons(params, req.user);
  }
}