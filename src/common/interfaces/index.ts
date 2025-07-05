import { Appointment } from 'src/lib';

export interface PaginatedData {
  result: Array<any>;
  count?: number;
  skip?: number;
  unreadCount?: number; // ✅ add this line
}


export interface JobUpdate {
  title: string;
  notes: string;
  type: string;
  appointment: Appointment;
  createdAt: Date;
}
