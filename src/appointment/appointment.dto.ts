import { Appointment, BaseDto, User } from '../lib/index';

export class AppointmentDto extends BaseDto implements Appointment {
  constructor(appointment: Appointment) {
    super(appointment);
    this.title = appointment.title;
    this.type = appointment.type;
    this.notes = appointment.notes;
    this.isActive = appointment.isActive;
    this.appointmentFor = appointment.appointmentFor;
    this.appointmentForModel = appointment.appointmentForModel;
    this.startTime = appointment.startTime;
    this.endTime = appointment.endTime;
    this.appointee = appointment.appointee;
    this.appointer = appointment.appointer;
    this.setOnAppointeeDevice = appointment.setOnAppointeeDevice;
    this.setOnAppointerDevice = appointment.setOnAppointerDevice;
    this.notify = appointment.notify;
    this.rescheduleRequested = appointment.rescheduleRequested;
  }

  title: string;
  type: string;
  notes: string;
  isActive: boolean;
  appointmentFor: any;
  appointmentForModel: string;
  startTime: Date;
  endTime: Date;
  appointee: User;
  appointer: User;
  setOnAppointeeDevice: boolean;
  setOnAppointerDevice: boolean;
  notify: boolean;
  rescheduleRequested: boolean;
}
