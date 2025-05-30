import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Render,
  Req,
} from '@nestjs/common';
import { SERVICES } from 'src/config/services';
import { Appointment, JobReview, Request } from 'src/lib';
import { sendTemplateEmail } from 'src/util/sendMail';
import { MAIL_TEMPLATES } from '../config';
import {
  capitalize,
  formatMoney,
  getAffilaiteChargeForItem,
  getClientCutForItem,
} from '../util/index';
import { RequestDto } from './request.dto';
import { RequestFactory } from './request.factory';
import moment = require('moment');
import { JobUpdate } from 'src/common/interfaces';

@Controller('request')
export class RequestController {
  constructor(public readonly requestFactory: RequestFactory) {}

  @Get('')
  async getAllRequests(@Req() req, @Query() params: any) {
    return this.requestFactory.getAllRequests(params, req.user);
  }

  @Post()
  async createRequest(@Req() req, @Body() data: RequestDto) {
    return this.requestFactory.createRequest(data, req.user);
  }

  @Put(':id/lead')
  async purchaseLead(@Req() req, @Param('id') leadId: string) {
    return this.requestFactory.purchaseLead(leadId, req.user);
  }

  @Post(':id/lead/hire')
  async hireAffiliate(
    @Req() req,
    @Body('affiliate') affiliate: object,
    @Param('id') leadId: string,
  ) {
    return this.requestFactory.hireAffiliate(leadId, affiliate, req.user);
  }

  @Get(':id/report')
  @Render('requestReport')
  async getRequestReport(@Param('id') id: string) {
    const request: Request = await this.requestFactory.getRequestById(id);
 console.log(request,SERVICES[request.requestType],capitalize,formatMoney,getClientCutForItem,getAffilaiteChargeForItem,moment,'//////');
    return {
      request,
      service: SERVICES[request.requestType],
      capitalize,
      moment,
      formatMoney,
      getAffilaiteChargeForItem,
      getClientCutForItem,
    };
  }

  @Get(':id/finances')
  async getRequestFinances(@Param('id') id: string, @Req() req) {
    return this.requestFactory.getRequestFinances(id, req.user);
  }

  @Post(':id/emailReport')
  async emailReportToSelf(@Param('id') id: string, @Req() req) {
    const request: Request = await this.requestFactory.getRequestById(id);

    await sendTemplateEmail(req.user.email, MAIL_TEMPLATES.REQUEST_REPORT, {
      request,
      service: SERVICES[request.requestType],
      capitalize,
      moment,
      formatMoney,
      getAffilaiteChargeForItem,
      getClientCutForItem,
    });

    return;
  }

  @Post(':id/appointment')
  async createAppointment(
    @Param('id') id: string,
    @Body() data: Appointment,
    @Req() req,
  ) {
    return this.requestFactory.createAppointment(id, data, req.user);
  }

  @Put(':id/appointment/:appointmentId/requestReschedule')
  async rescheduleAppointment(
    @Param('id') id: string,
    @Param('appointmentId') appointmentId: string,
    @Req() req,
  ) {
    return this.requestFactory.requestRescheduleJobAppointment(
      id,
      appointmentId,
      req.user,
    );
  }

  @Put(':id/appointment/:appointmentId/reschedule')
  async rescheduleJobAppointment(
    @Param('id') id: string,
    @Param('appointmentId') appointmentId: string,
    @Body() data,
    @Req() req,
  ) {
    return this.requestFactory.rescheduleJobAppointment(
      id,
      appointmentId,
      data,
      req.user,
    );
  }

  @Get('jobs')
  async getAllJobs(@Req() req, @Query() params: any) {
    return this.requestFactory.getAllJobs(params, req.user);
  }

  @Get(':id')
  async getRequestById(@Param('id') id: string) {
    return this.requestFactory.getRequestById(id);
  }

  @Put(':id')
  async updateRequest(
    @Req() req,
    @Body() data: Request,
    @Param('id') id: string,
  ) {
    return this.requestFactory.updateRequest(id, data, req.user);
  }

  @Put(':id/finalizeSale')
  async finalizeSale(@Req() req, @Param('id') id: string) {
    return this.requestFactory.finalizeSale(id, req.user);
  }

  @Put(':id/closeJob')
  async closeJob(@Req() req, @Param('id') requestId: string) {
    return this.requestFactory.closeJob(requestId, req.user);
  }

  @Post(':id/review')
  async addJobReview(
    @Req() req,
    @Param('id') id: string,
    @Body() reviewData: JobReview,
  ) {
    return this.requestFactory.addJobReview(id, reviewData, req.user);
  }

  @Post(':id/agreement')
  async addJobAgreement(
    @Req() req,
    @Param('id') id: string,
    @Body() agreement: object,
  ) {
    return this.requestFactory.addJobAgreement(id, agreement, req.user);
  }

  @Post(':id/jobUpdate')
  async addJobUpdate(
    @Req() req,
    @Param('id') id: string,
    @Body() jobUpdate: JobUpdate,
  ) {
    return this.requestFactory.addJobUpdate(id, jobUpdate, req.user);
  }
}
