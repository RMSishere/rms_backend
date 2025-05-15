import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { USER_ROLES } from '../config';
import { DashboardService } from './dashboard.service';

@UseGuards(RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(public readonly dashboardService: DashboardService) {}

  @Roles(USER_ROLES.ADMIN)
  @Get('/summary/request')
  getRequestsSummary() {
    return this.dashboardService.getRequestsSummary();
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('/summary/payment')
  getPaymentsSummary(@Query() params: any) {
    return this.dashboardService.getPaymentsSummary(params);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('/summary/user')
  getUsersSummary(@Query() params: any) {
    return this.dashboardService.getUsersSummary(params);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('/summary/zipCodesJobsCount')
  getZipCodesSummary(@Query() params: any) {
    return this.dashboardService.getZipCodesWithNumberOfJobs(params);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('/summary/saleCategoryStats')
  getSaleCategoryStats(@Query() params: any) {
    return this.dashboardService.getSaleCategoryStats(params);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('/userSurvey')
  getUserSurveys(@Query('skip') skip: string) {
    return this.dashboardService.getUserSurveys(parseInt(skip));
  }
}
