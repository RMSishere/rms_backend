import { Body, Controller, Post, Query, Req, UseGuards, Get } from "@nestjs/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/config";
import { NotificationSubscriptionFactory } from './notificationSubscription.factory';

@UseGuards(RolesGuard)
@Controller('notificationSubscription')
export class NotificationSubscriptionController {
    constructor(public readonly notificationSubscriptionFactory: NotificationSubscriptionFactory) { }

    @Get()
    async getAll(
        @Query() parmas,
        @Req() req
    ) {
        return this.notificationSubscriptionFactory.getAllNotificationSubscriptions(parmas, req.user);
    }

    @Roles(USER_ROLES.ADMIN)
    @Post()
    async add(
        @Req() req,
        @Body() data: any,
    ) {
        return this.notificationSubscriptionFactory.addNotificationSubscription(data);
    }
}