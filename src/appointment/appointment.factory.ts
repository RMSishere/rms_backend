import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';

import { paginationLimit } from '../config';
import { BaseFactory } from '../lib/base.factory';
import { Appointment, Counter, User } from '../lib/index';
import { AppointmentDto } from './appointment.dto';
import moment = require('moment');

@Injectable()
export class AppointmentFactory extends BaseFactory {
  constructor(
    @InjectModel('Appointment')
    public readonly appointmentModel: Model<Appointment>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
  ) {
    super(countersModel);
  }

  async createAppointment(
    appointment: Appointment,
    user: User,
  ): Promise<Appointment> {
    try {
      appointment.id = await this.generateSequentialId('Appointment');
      appointment.appointer = user;
      appointment.createdBy = this.getCreatedBy(user);
      const newAppointment = new this.appointmentModel(appointment);
      let res = await newAppointment.save();
      res = await res
        .populate('appointee')
        .populate('appointer')
        .execPopulate();
      const result = new AppointmentDto(res);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async getAllAppointmentsAssignedToUser(
    params: any,
    user: User,
  ): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const filter = { isActive: true };

    try {
      if (params.type) {
        filter['type'] = { $in: params.type.split(',') };
      }

      if (params.timeType) {
        if (params.timeType === 'upcoming') {
          filter['startTime'] = {
            $gte: moment().toISOString(),
          };
        }
      }

      // if (params.onDate) {
      //   filter['createdAt'] = {
      //     $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
      //     $lt: moment(params.onDate, 'YYYY-MM-DD').add(1, 'day').toISOString()
      //   };
      // }

      filter['appointee'] = user;

      const count = await this.appointmentModel.countDocuments(filter);

      const Appointments = await this.appointmentModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .populate('appointer')
        .populate('appointmentFor')
        .sort({ createdAt: 'desc' });

      const result = Appointments.map(res => new AppointmentDto(res));

      const res = { result, count, skip };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async getAppointment(id: string): Promise<Appointment> {
    try {
      const appointment = await this.appointmentModel
        .findOne({ id: id, isActive: true })
        .populate('appointer')
        .populate('appointee')
        .populate('appointmentFor')
        .exec();

      const result = new AppointmentDto(appointment);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async updateAppointment(
    id: string,
    data: Partial<Appointment>,
    user: User,
  ): Promise<Appointment> {
    try {
      data.updatedBy = this.getUpdatedBy(user);

      const filter = { id, isActive: true };
      const newValue = { $set: data };
      const updatedAppointment = await this.appointmentModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const appointment = new AppointmentDto(updatedAppointment);

      return appointment;
    } catch (err) {
      throw err;
    }
  }
}
