import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { AppointmentFactory } from './appointment.factory';

@Controller('appointment')
export class AppointmentController {
  constructor(public readonly appointmentFactory: AppointmentFactory) { }
  @Get('')
  async getAllAppointmentsAssignedToUser(
    @Req() req,
    @Query() params: any
  ) {
    return this.appointmentFactory.getAllAppointmentsAssignedToUser(
      params,
      req.user
    );
  }

  @Get(':id')
  async getAppointment(
    @Param('id') id: string,
  ) {
    return this.appointmentFactory.getAppointment(
      id,
    );
  }

  @Put(':id')
  async updateAppointment(
    @Req() req,
    @Param('id') id: string,
    @Body() data,
  ) {
    return this.appointmentFactory.updateAppointment(
      id,
      data,
      req.user
    );
  }
}