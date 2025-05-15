import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentController } from './appointment.controller';
import { AppointmentFactory } from './appointment.factory';
import { appointmentSchema } from './appointment.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Appointment', schema: appointmentSchema }]),
    ],
    exports: [
        MongooseModule.forFeature([{ name: 'Appointment', schema: appointmentSchema }]),
        AppointmentFactory
    ],
    controllers: [AppointmentController],
    providers: [AppointmentFactory]
})

export class AppointmentModule { }