  import { Injectable } from '@nestjs/common';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import { PaginatedData } from 'src/common/interfaces';

  import { paginationLimit, NOTIFICATION_TYPES } from '../config';
  import { BaseFactory } from '../lib/base.factory';
  import { Appointment, Counter, User } from '../lib/index';
  import { AppointmentDto } from './appointment.dto';
  import moment = require('moment');

  import { NotificationFactory } from 'src/notification/notification.factory';

  // ✅ PUSH moved out of NotificationFactory
  import { sendPushNotificationToUser } from 'src/util/notification.util';

  @Injectable()
  export class AppointmentFactory extends BaseFactory {
    constructor(
      @InjectModel('Appointment')
      public readonly appointmentModel: Model<Appointment>,
      @InjectModel('counters')
      public readonly countersModel: Model<Counter>,

      // ✅ in-app notifications only
      public readonly notificationFactory: NotificationFactory,
    ) {
      super(countersModel);
    }

    async createAppointment(appointment: Appointment, user: User): Promise<Appointment> {
      try {
        appointment.id = await this.generateSequentialId('Appointment');
        appointment.appointer = user;
        appointment.createdBy = this.getCreatedBy(user);

        const newAppointment = new this.appointmentModel(appointment);

        let res: any = await newAppointment.save();
        res = await res.populate('appointee').populate('appointer').execPopulate();

        const result = new AppointmentDto(res);

        // ✅ NOTIFICATIONS (real-time): appointment created
        try {
          const appointee: any = res?.appointee;
          const appointer: any = res?.appointer;

          const start = res?.startTime
            ? moment(res.startTime).format('MMMM Do YYYY, h:mm A')
            : 'Scheduled';

          const title = `You’re scheduled`;
          const description = `Your appointment is set for ${start}.`;

          // -------------------------
          // Appointee: In-App + Push
          // -------------------------
          if (appointee) {
            // In-app
            await this.notificationFactory.sendInAppNotification(
              {
                type: 'appointment_created',
                appointmentId: result.id,
                title,
                description,
                screen: 'Appointments',
                screenParams: { id: result.id },
              },
              [appointee],
              NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
            );

            // Push
            await sendPushNotificationToUser(
              appointee,
              {
                title,
                body: description,
                data: {
                  type: 'appointment_created',
                  appointmentId: String(result.id),
                },
              },
              { quietHours: false }, // real-time event
            );
          }

          // -------------------------
          // Appointer: optional notify
          // -------------------------
          if (
            appointer &&
            appointer?._id?.toString() !== appointee?._id?.toString()
          ) {
            // In-app
            await this.notificationFactory.sendInAppNotification(
              {
                type: 'appointment_created_appointer',
                appointmentId: result.id,
                title: 'Appointment created',
                description: `Appointment created for ${start}.`,
                screen: 'Appointments',
                screenParams: { id: result.id },
              },
              [appointer],
              NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
            );

            // Push
            await sendPushNotificationToUser(
              appointer,
              {
                title: 'Appointment created',
                body: `Appointment created for ${start}.`,
                data: {
                  type: 'appointment_created',
                  appointmentId: String(result.id),
                },
              },
              { quietHours: false },
            );
          }
        } catch (notifyErr: any) {
          console.error(
            '⚠️ Appointment create notification failed:',
            notifyErr?.message || notifyErr,
          );
        }

        return result;
      } catch (err) {
        throw err;
      }
    }

    async getAllAppointmentsAssignedToUser(params: any, user: User): Promise<PaginatedData> {
      const skip = parseInt(params.skip) || 0;
      const filter: any = { isActive: true };

      try {
        if (params.type) {
          filter['type'] = { $in: params.type.split(',') };
        }

        if (params.timeType) {
          if (params.timeType === 'upcoming') {
            filter['startTime'] = { $gte: moment().toISOString() };
          }
        }

        filter['appointee'] = user;

        const count = await this.appointmentModel.countDocuments(filter);

        const appointments = await this.appointmentModel
          .find(filter)
          .skip(skip)
          .limit(paginationLimit)
          .populate('appointer')
          .populate('appointmentFor')
          .sort({ createdAt: 'desc' });

        const result = appointments.map((res: any) => new AppointmentDto(res));

        return { result, count, skip };
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

        return new AppointmentDto(appointment as any);
      } catch (err) {
        throw err;
      }
    }

    async updateAppointment(id: string, data: Partial<Appointment>, user: User): Promise<Appointment> {
      try {
        // ✅ fetch old appointment to detect reschedule
        const prev: any = await this.appointmentModel
          .findOne({ id, isActive: true })
          .populate('appointee')
          .populate('appointer')
          .exec();

        data.updatedBy = this.getUpdatedBy(user);

        const filter = { id, isActive: true };
        const newValue = { $set: data };

        const updated: any = await this.appointmentModel
          .findOneAndUpdate(filter, newValue, { new: true })
          .populate('appointee')
          .populate('appointer')
          .exec();

        const appointmentDto = new AppointmentDto(updated);

        // ✅ NOTIFICATIONS (real-time): rescheduled (if startTime changed)
        try {
          const prevStart = prev?.startTime ? new Date(prev.startTime).getTime() : null;
          const nextStart = updated?.startTime ? new Date(updated.startTime).getTime() : null;

          const startTimeChanged =
            prevStart !== null && nextStart !== null && prevStart !== nextStart;

          if (startTimeChanged) {
            const appointee: any = updated?.appointee;
            const appointer: any = updated?.appointer;

            const start = updated?.startTime
              ? moment(updated.startTime).format('MMMM Do YYYY, h:mm A')
              : 'Updated';

            const title = `Appointment Rescheduled`;
            const description = `Your appointment was rescheduled to ${start}.`;

            // -------------------------
            // Appointee: In-App + Push
            // -------------------------
            if (appointee) {
              await this.notificationFactory.sendInAppNotification(
                {
                  type: 'appointment_rescheduled',
                  appointmentId: appointmentDto.id,
                  title,
                  description,
                  screen: 'Appointments',
                  screenParams: { id: appointmentDto.id },
                },
                [appointee],
                NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
              );

              await sendPushNotificationToUser(
                appointee,
                {
                  title,
                  body: description,
                  data: {
                    type: 'appointment_rescheduled',
                    appointmentId: String(appointmentDto.id),
                  },
                },
                { quietHours: false },
              );
            }

            // -------------------------
            // Appointer: In-App + Push
            // -------------------------
            if (
              appointer &&
              appointer?._id?.toString() !== appointee?._id?.toString()
            ) {
              await this.notificationFactory.sendInAppNotification(
                {
                  type: 'appointment_rescheduled_appointer',
                  appointmentId: appointmentDto.id,
                  title,
                  description: `Appointment rescheduled to ${start}.`,
                  screen: 'Appointments',
                  screenParams: { id: appointmentDto.id },
                },
                [appointer],
                NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
              );

              await sendPushNotificationToUser(
                appointer,
                {
                  title,
                  body: `Appointment rescheduled to ${start}.`,
                  data: {
                    type: 'appointment_rescheduled',
                    appointmentId: String(appointmentDto.id),
                  },
                },
                { quietHours: false },
              );
            }
          }
        } catch (notifyErr: any) {
          console.error(
            '⚠️ Appointment update notification failed:',
            notifyErr?.message || notifyErr,
          );
        }

        return appointmentDto;
      } catch (err) {
        throw err;
      }
    }
  }
