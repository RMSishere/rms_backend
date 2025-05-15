import { Base } from "./base";

export interface ScheduleJob extends Base {
  jobType: string;
  jobDate: Date;
  jobData: object;
  jobFor: string;
  jobForModel: string;
  completed?: boolean;
}
