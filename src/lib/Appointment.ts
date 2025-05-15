import { Base } from './base';
import { User } from './user';

export interface Appointment extends Base {
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
