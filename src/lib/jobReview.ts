import { Base } from './base';
import { User, Request } from '.';

export interface JobReview extends Base {
    customer: User;
    affiliate: User;
    request: Request;
    name: string;
    professionalism: number;
    qualityOfAreaPressureWashed: number;
    handlingOfItemsSafely: number;
    timeliness: number;
    locationCleanliness: number;
    amountMade: number;
    advertising: number;
    totalSatisfaction: number;
    communication: number;
    overAllRating: number;
    comments: string;
    allowtestimonial: boolean;
}