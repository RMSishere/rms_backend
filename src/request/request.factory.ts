import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppointmentFactory } from 'src/appointment/appointment.factory';
import { JobUpdate, PaginatedData } from 'src/common/interfaces';
import { JobReviewDto } from 'src/jobReview/jobReview.dto';
import { NotificationFactory } from 'src/notification/notification.factory';
import { UserFactory } from 'src/users/users.factory';
import { getAgreement, getfullName } from 'src/util';
import { ZipCodeFactory } from 'src/zipCode/zipCode.factory';
import {
  CHARGE_BASIS,
  defaultLeadCalculations,
  MAIL_FROM,
  MAIL_TEMPLATES,
  NOTIFICATION_TYPES,
  paginationLimit,
  REQUEST_STATUS,
  SCHEDULE_JOB,
  SERVICES,
  USER_ROLES,
} from '../config';
import { BaseFactory } from '../lib/base.factory';
import { Appointment, Counter, JobReview, Request, User } from '../lib/index';
import { ScheduleFactory } from '../scheduleJob/scheduleJob.factory';
import { RequestDto } from './request.dto';

import moment = require('moment-timezone');
import { getCustomerPlanDetails } from 'src/subscription/subscription.utils';

@Injectable()
export class RequestFactory extends BaseFactory {
  constructor(
    @InjectModel('request') public readonly requestModel: Model<Request>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('JobReview') public readonly jobReviewModel: Model<JobReview>,
    @InjectModel('users') public readonly userModel: Model<User>,
    public notificationfactory: NotificationFactory,
    public appointmentfactory: AppointmentFactory,
    public zipCodeFactory: ZipCodeFactory,
    public userFactory: UserFactory,
    public scheduleFactory: ScheduleFactory,
  ) {
    super(countersModel);
  }

  async createRequest(data: Request, user: User): Promise<Request> {
    try {
      data.id = await this.generateSequentialId('request');
      data.requesterOwner = user;
      data.createdBy = this.getCreatedBy(user);
      const userdata = await this.userModel.findById(user.id);
          const plan = getCustomerPlanDetails(userdata.subscription?.type);

if (userdata.subscription.jobRequestCountThisMonth >= plan.jobRequestLimit) {
      throw new BadRequestException('Job request limit exceeded for this month');
    }
      const affiliates: User[] = await this.userFactory.getApprovedAffiliates({
        'businessProfile.nearByZipCodes': data.zip,
      });
      const admin = await this.userFactory.getAdmin();

      data.price = await this.findRequestPrice(data.zip, affiliates.length);

      const newRequest = new this.requestModel(data);
      const res = await newRequest.save();
      const request = new RequestDto(res);

      if (request && affiliates && affiliates.length) {
        let requestLabel = '';

        if (
          SERVICES[request.requestType] &&
          SERVICES[request.requestType].label
        ) {
          requestLabel = SERVICES[request.requestType].label;
        }

        const title = `New Service Request - ${requestLabel}`;
        const description =
          "Congrats! You've got a new service request in your area.";
        const adminDescription = `Congrats! There is a new service request in zip code ${request.zip}.`;

        // send notifications
        this.notificationfactory
          .sendNotification(affiliates, NOTIFICATION_TYPES.NEW_JOB, {
            inApp: {
              message: { requestId: request.id, title, description },
            },
            text: {
              message: `${title}\n${description}`,
            },
            email: {
              template: MAIL_TEMPLATES.NEW_REQUEST,
              locals: { title, description },
            },
          })
          .catch(() => null); // discard error

        this.notificationfactory
          .sendNotification(admin, NOTIFICATION_TYPES.NEW_JOB, {
            inApp: {
              message: {
                requestId: request.id,
                title,
                description: adminDescription,
              },
            },
            text: {
              message: `${title}\n${adminDescription}`,
            },
            email: {
              template: MAIL_TEMPLATES.NEW_REQUEST,
              locals: { title, description: adminDescription },
            },
          })
          .catch(() => null); // discard error
      }

      return request;
    } catch (err) {
      throw err;
    }
  }

  async getAllRequests(params: any, user: User): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const filter = { isActive: true, status: REQUEST_STATUS.INIT };

    try {
      if (params.requestType) {
        filter['requestType'] = { $in: params.requestType.split(',') };
      }

      if (params.status) {
        const statusList = params.status.split(',');
        if (statusList.includes('new')) {
          filter['createdAt'] = {
            $gte: moment()
              .subtract(1, 'month')
              .toISOString(),
          };
        }

        if (statusList.includes('interestedAffiliates')) {
          filter['leads'] = { $exists: true, $ne: [] }; // where leads array is not empty
        }
      }

      if (params.onDate) {
        filter['createdAt'] = {
          $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
          $lt: moment(params.onDate, 'YYYY-MM-DD')
            .add(1, 'day')
            .toISOString(),
        };
      }

      if (user.role === USER_ROLES.CLIENT) {
        filter['requesterOwner'] = user._id;
      } else if (user.role === USER_ROLES.AFFILIATE) {
        const affiliate = await this.userFactory.getApprovedAffiliate({
          _id: user,
        });
        if (affiliate && affiliate.businessProfile.areaServices.length) {
          filter['zip'] = { $in: affiliate.businessProfile.nearByZipCodes };
        } else {
          return { result: [] };
        }
      } else if (user.role === USER_ROLES.ADMIN) {
        // do nothing
      } else {
        throw new ForbiddenException();
      }

      const count = await this.requestModel.countDocuments(filter);

      const requests = await this.requestModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .populate('requesterOwner')
        .sort({ createdAt: 'desc' });

      const result = requests.map(res => new RequestDto(res));

      const res = { result, count, skip };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async getAllJobs(params: any, user: User): Promise<PaginatedData> {
    try {
      const skip = parseInt(params.skip) || 0;
      const filter = { isActive: true, status: { $ne: REQUEST_STATUS.INIT } };

      if (params.requestType) {
        filter['requestType'] = { $in: params.requestType.split(',') };
      }

      if (params.status) {
        const statusList = params.status.split(',');
        const jobStatusList = [];
        if (statusList.includes('new')) {
          filter['jobDate'] = {
            $gte: moment()
              .subtract(1, 'month')
              .toISOString(),
          };
        }

        if (statusList.includes('finalized')) {
          filter['isFinalized'] = true;
        }

        if (statusList.includes(REQUEST_STATUS.JOB)) {
          jobStatusList.push(REQUEST_STATUS.JOB);
        }

        if (statusList.includes(REQUEST_STATUS.PAUSE)) {
          jobStatusList.push(REQUEST_STATUS.PAUSE);
        }

        if (statusList.includes(REQUEST_STATUS.CLOSE)) {
          jobStatusList.push(REQUEST_STATUS.CLOSE);
        }

        if (jobStatusList.length) {
          filter.status['$in'] = jobStatusList;
        }
      }

      if (params.onDate) {
        filter['jobDate'] = {
          $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
          $lt: moment(params.onDate, 'YYYY-MM-DD')
            .add(1, 'day')
            .toISOString(),
        };
      }

      if (user.role === USER_ROLES.CLIENT) {
        filter['requesterOwner'] = user;
      } else if (user.role === USER_ROLES.AFFILIATE) {
        filter['hiredAffiliate'] = user;
      }

      const count = await this.requestModel.countDocuments(filter);

      const jobs = await this.requestModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .sort({ jobDate: 'desc' })
        .populate('requesterOwner')
        .populate('hiredAffiliate');

      const result = jobs.map(res => new RequestDto(res));
      const res = { result, count, skip };

      return res;
    } catch (err) {
      throw err;
    }
  }

  async purchaseLead(leadId: string, user: User): Promise<Request> {
    try {
      const filter = { id: leadId, isActive: true };
      const newValue = {
        $push: { leads: { affiliate: user, requestedAt: new Date() } },
      };
      const updatedRequest = await this.requestModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const request = new RequestDto(updatedRequest);

      return request;
    } catch (err) {
      throw err;
    }
  }

  async createAppointment(
    requestId: string,
    appointment: Appointment,
    user: User,
  ): Promise<Appointment> {
    try {
      const request: Request = await this.requestModel.findOne({
        id: requestId,
      });
      appointment.appointee = request.requesterOwner;
      appointment.appointmentFor = request;
      appointment.appointmentForModel = 'request';

      const newAppointment = await this.appointmentfactory.createAppointment(
        appointment,
        user,
      );

      await this.scheduleAppointmentJobsForRequest(newAppointment, request);

      return newAppointment;
    } catch (err) {
      throw err;
    }
  }

  async scheduleAppointmentJobsForRequest(
    appointment: Appointment,
    request: Request,
  ) {
    if (appointment.notify) {
      // create scheduled email jobs for customer
      const today = moment();
      const appointmentDate = moment(appointment.startTime);

      if (appointmentDate.isSameOrAfter(today, 'day')) {
        // if appointment date is not behind today
        const emailData = {
          appointment: appointment,
          service: SERVICES[request.requestType],
        };

        const to = appointment.appointee.email;

        if (to) {
          const twoWeeksBeforeDate = moment(appointmentDate).subtract(
            2,
            'weeks',
          );
          if (twoWeeksBeforeDate.isSameOrAfter(today, 'day')) {
            // 2 weeks before
            // 11 AM US Pacific Standard Time
            this.scheduleFactory.addScheduleJob({
              jobDate: twoWeeksBeforeDate
                .tz('US/Pacific')
                .hours(11)
                .minute(0)
                .toDate(),
              jobType: SCHEDULE_JOB.SEND_MAIL,
              jobFor: appointment._id,
              jobForModel: 'appointment',
              jobData: {
                to: to,
                template: MAIL_TEMPLATES.APPOINTMENT_REMINDERS.TWO_WEEKS_BEFORE,
                emailData,
                from: MAIL_FROM.AFFILIATE,
              },
            });
          }

          // 1 week before
          // 11 AM US Pacific Standard Time
          const oneWeekBeforeDate = moment(appointmentDate).subtract(1, 'week');

          if (oneWeekBeforeDate.isSameOrAfter(today, 'day')) {
            this.scheduleFactory.addScheduleJob({
              jobDate: oneWeekBeforeDate
                .tz('US/Pacific')
                .hours(11)
                .minute(0)
                .toDate(),
              jobType: SCHEDULE_JOB.SEND_MAIL,
              jobFor: appointment._id,
              jobForModel: 'appointment',
              jobData: {
                to: to,
                template: MAIL_TEMPLATES.APPOINTMENT_REMINDERS.ONE_WEEK_BEFORE,
                emailData,
                from: MAIL_FROM.AFFILIATE,
              },
            });
          }

          // on the day of appointment
          // 11 AM US Pacific Standard Time
          this.scheduleFactory.addScheduleJob({
            jobDate: appointmentDate
              .tz('US/Pacific')
              .hours(11)
              .minute(0)
              .toDate(),
            jobType: SCHEDULE_JOB.SEND_MAIL,
            jobFor: appointment._id,
            jobForModel: 'appointment',
            jobData: {
              to: to,
              template:
                MAIL_TEMPLATES.APPOINTMENT_REMINDERS.ON_APPOINTMENT_DATE,
              emailData,
              from: MAIL_FROM.AFFILIATE,
            },
          });
        }
      }
    }
  }

  async addJobUpdate(
    requestId: string,
    jobUpdate: JobUpdate,
    user: User,
  ): Promise<Request> {
    try {
      const filter = { id: requestId, isActive: true, hiredAffiliate: user };

      if (jobUpdate.appointment) {
        jobUpdate.appointment = await this.createAppointment(
          requestId,
          jobUpdate.appointment,
          user,
        );
      }

      const newValue = {
        $push: {
          jobUpdates: {
            ...jobUpdate,
            createdAt: new Date(),
          },
        },
      };

      const updatedRequest = await this.requestModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const result = new RequestDto(updatedRequest);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async addJobAgreement(
    requestId: string,
    agreement: object,
    user: User,
  ): Promise<Request> {
    try {
      const filter = { id: requestId, isActive: true, 'leads.affiliate': user };
      const newValue = { $set: { 'leads.$.agreement': agreement } };

      const updatedRequest = await this.requestModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const request = new RequestDto(updatedRequest);

      if (request && request.requesterOwner) {
        let requestLabel = '';
        if (
          SERVICES[request.requestType] &&
          SERVICES[request.requestType].label
        ) {
          requestLabel = SERVICES[request.requestType].label;
        }

        await this.notificationfactory.sendNotification(
          request.requesterOwner,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            inApp: {
              message: {
                requestId: request.id,
                title: `New Interested Affiliate - ${requestLabel}`,
                description:
                  'Congrats! An affiliate is interested in your service request.',
              },
            },
          },
        );
      }

      return request;
    } catch (err) {
      throw err;
    }
  }

  async hireAffiliate(
    leadId: string,
    affiliateToBeHired: any,
    user: User,
  ): Promise<Request> {
    try {
      if (affiliateToBeHired && affiliateToBeHired._id) {
        const filter = { id: leadId, isActive: true };

        const newValue = {
          $set: {
            hiredAffiliate: affiliateToBeHired,
            jobDate: new Date(),
            status: 'JOB',
          },
        };
        const updatedRequest = await this.requestModel.findOneAndUpdate(
          filter,
          newValue,
          { new: true },
        );

        const request = new RequestDto(updatedRequest);

        // create notification for hired affiliate
        let requestLabel = '';
        if (
          SERVICES[request.requestType] &&
          SERVICES[request.requestType].label
        ) {
          requestLabel = SERVICES[request.requestType].label;
        }

        await this.notificationfactory.sendNotification(
          affiliateToBeHired,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            inApp: {
              message: {
                requestId: request.id,
                title: `Hired for Job - ${requestLabel}`,
                description:
                  'Congrats! You are hired for a job. We wish you success.',
              },
            },
          },
        );

        return request;
      } else {
        throw new BadRequestException();
      }
    } catch (err) {
      throw err;
    }
  }

  async getRequestById(id: string): Promise<Request> {
    try {
      const result = await this.requestModel.findOne({
        id: id,
        isActive: true,
      });

      const resDto = new RequestDto(result);

      return resDto;
    } catch (err) {
      throw err;
    }
  }

  async updateRequest(id: string, data: Request, user: User): Promise<Request> {
    try {
      data.updatedBy = this.getUpdatedBy(user);

      const filter = { id, isActive: true };
      const newValue = { $set: data };
      const updatedRequest = await this.requestModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const request = new RequestDto(updatedRequest);

      return request;
    } catch (err) {
      throw err;
    }
  }

  async finalizeSale(id: string, user: User): Promise<Request> {
    try {
      const res = await this.updateRequest(id, { isFinalized: true }, user);
      const subscriptionIndex = res.requesterOwner.notificationSubscriptions.findIndex(
        dt => dt.title === NOTIFICATION_TYPES.JOB_STATUS_UPDATES.title,
      );
      if (subscriptionIndex >= 0) {
        // if request owner subscribed for job status updates
        this.notificationfactory.sendNotification(
          res.requesterOwner,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            text: {
              message: `Congrats! Your sale # ${res.id} has been finalized`,
            },
          },
        );
      }

      return res;
    } catch (err) {
      throw err;
    }
  }

  async closeJob(id: string, user: User): Promise<Request> {
    try {
      const filter = { id: id, requesterOwner: user };
      const update = { $set: { status: 'CLOSE' } };
      const request = await this.requestModel.findOneAndUpdate(filter, update, {
        new: true,
      });

      this.notificationfactory
        .sendNotification(
          [request.requesterOwner, request.hiredAffiliate],
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            text: {
              message: `The request # ${request.id} has been closed.`,
            },
          },
        )
        .catch(() => null); // discard error

      if (request) {
        return new RequestDto(request);
      }
      throw new InternalServerErrorException();
    } catch (error) {
      throw error;
    }
  }

  async findRequestPrice(zip: string, count: number): Promise<number> {
    let leadCalculations = [];
    const zipCodeData = await this.zipCodeFactory.getZipCode(zip);

    if (zipCodeData && zipCodeData.leadCalculations) {
      leadCalculations = zipCodeData.leadCalculations;
    } else {
      leadCalculations = defaultLeadCalculations;
    }

    for (let i = 0; i < leadCalculations.length; i++) {
      const item = leadCalculations[i];
      if (count >= item.minCount && count <= item.maxCount) {
        return item.price;
      }
    }
  }

  async addJobReview(
    id: string,
    reviewData: JobReview,
    user: User,
  ): Promise<JobReview> {
    try {
      const ratingFields = [
        'professionalism',
        'qualityOfAreaPressureWashed',
        'handlingOfItemsSafely',
        'timeliness',
        'locationCleanliness',
        'amountMade',
        'advertising',
        'totalSatisfaction',
      ];

      reviewData['overAllRating'] = 0.0;

      Object.keys(reviewData).map(key => {
        if (
          ratingFields.includes(key) &&
          reviewData[key] > 0 &&
          reviewData[key] <= 5
        ) {
          reviewData['overAllRating'] +=
            Math.round((reviewData[key] / 5 + Number.EPSILON) * 100) / 100;
        }
      });

      const request = await this.requestModel
        .findOne({ id, isActive: true })
        .populate('hiredAffiliate');
      reviewData['id'] = await this.generateSequentialId('JobReview');
      reviewData['customer'] = request.requesterOwner;
      reviewData['affiliate'] = {
        ...request.hiredAffiliate.businessProfile,
        firstName: request.hiredAffiliate.firstName,
        lastName: request.hiredAffiliate.lastName,
        avatar: request.hiredAffiliate.avatar,
        email: request.hiredAffiliate.email,
        _id: request.hiredAffiliate._id,
      } as unknown as User;
      
            reviewData['request'] = request;
      reviewData.createdBy = this.getCreatedBy(user);

      const newReview = new this.jobReviewModel(reviewData);
      const res = await newReview.save();
      const jobReview = new JobReviewDto(res);

      const aggregationResult = await this.jobReviewModel.aggregate([
        { $match: { affiliate: jobReview.affiliate } },
        {
          $group: {
            _id: null,
            ratingSum: { $sum: '$overAllRating' },
            ratingCount: { $sum: 1 },
          },
        },
      ]);
      
      const { ratingSum = 0, ratingCount = 0 } = aggregationResult[0] || {};
      

      await this.userModel.updateOne(
        { _id: jobReview.affiliate._id },
        {
          'businessProfile.rating':
            (ratingSum + jobReview.overAllRating) / (ratingCount + 1),
          'businessProfile.ratingCount': ratingCount + 1,
        },
      );

      return jobReview;
    } catch (err) {
      throw err;
    }
  }

  async requestRescheduleJobAppointment(
    requestId: string,
    appointmentId: string,
    user: User,
  ): Promise<Request> {
    await this.appointmentfactory.updateAppointment(
      appointmentId,
      {
        rescheduleRequested: true,
      },
      user,
    );
    const req = await this.requestModel.findOne({ id: requestId });
    const request = new RequestDto(req);

    const title = `Appointment Reschedule Request`;
    const description = `${getfullName(
      request.requesterOwner,
    )} requested appointment reschedule for ${
      SERVICES[request.requestType].label
    }`;

    // send notifications
    this.notificationfactory
      .sendNotification(
        [request.hiredAffiliate],
        NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
        {
          inApp: {
            message: {
              requestId: request.id,
              title,
              description,
              screen: 'JobUpdates',
              screenParams: { id: request.id },
            },
          },
        },
      )
      .catch(() => null); // discard error
    return request;
  }

  async rescheduleJobAppointment(
    requestId: string,
    appointmentId: string,
    appointmentData: any,
    user: User,
  ): Promise<Request> {
    await this.appointmentfactory.updateAppointment(
      appointmentId,
      {
        rescheduleRequested: false,
        startTime: appointmentData.appointmentDate,
        endTime: appointmentData.appointmentDate,
      },
      user,
    );
    const updatedAppointment = await this.appointmentfactory.getAppointment(
      appointmentId,
    );

    const req = await this.requestModel.findOne({ id: requestId });
    const request = new RequestDto(req);

    // remove schedule jobs for the previous appointment
    await this.scheduleFactory.removeIncompleteJobs({
      jobFor: updatedAppointment._id,
      jobForModel: 'appointment',
    });

    // add schedule jobs for the updated appointment
    await this.scheduleAppointmentJobsForRequest(updatedAppointment, request);

    const title = `Appointment Rescheduled`;
    const description = `The appointment has been rescheduled for ${
      SERVICES[request.requestType].label
    }`;

    // send notifications
    this.notificationfactory
      .sendNotification(
        [request.requesterOwner],
        NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
        {
          inApp: {
            message: {
              requestId: request.id,
              title,
              description,
              screen: 'JobUpdates',
              screenParams: { id: request.id },
            },
          },
        },
      )
      .catch(() => null); // discard error
    return request;
  }

 async getRequestFinances(requestId: string, user: User): Promise<any> {
    let totalSaleRevenue = 0;
    let totalAffiliateCharge = 0;
    let rmsCommision = 0;
    const itemFormula: any = {};
    const overAllFormula: any = {};

    const request = await this.getRequestById(requestId);
    const aggrement = getAgreement(request.leads, request.hiredAffiliate);

    const addToTotalAffiliateCharge = (mainKey: string ,key: string, value: number, percentValue?: any) => {
      if (value) {
        totalAffiliateCharge += value;
      }
      if(value && percentValue){
        mainKey[key] =
          (mainKey[key] || 0) + percentValue;
      }
    };

    request.items.map((item: any) => {
      if (item.amount) {
        totalSaleRevenue += item.amount;
        if (item.affiliateFlatFeeCharge) {
          addToTotalAffiliateCharge(
            itemFormula,
            'Flat Fee',
            item.affiliateFlatFeeCharge,
            item.affiliateFlatFeeCharge,
          );
        }
        if (item.affiliateCommissionCharge) {
          addToTotalAffiliateCharge(
            itemFormula,
            'Commission',
            item.amount * (item.affiliateCommissionCharge / 100),
            item.affiliateCommissionCharge 
          );
        }
      }
    });

    if (aggrement.jobFeeChargeBasis === CHARGE_BASIS.FLAT_FEE) {
      addToTotalAffiliateCharge('overAllFormula','Flat Fee', aggrement.jobFee, aggrement.jobFee);
    } else if (aggrement.jobFeeChargeBasis === CHARGE_BASIS.COMMISSION) {
      addToTotalAffiliateCharge(
        overAllFormula,
        'Commission',
        totalSaleRevenue * (aggrement.jobFee / 100),
        aggrement.jobFee 
      );
    }

    aggrement.jobFeeChargeMethods?.map(dt => {
      if (dt.type === CHARGE_BASIS.FLAT_FEE) {
        if (dt.isSlidingScale) {
          for (let i = 0; i < dt.feeRange.length; i++) {
            const feeRange = dt.feeRange[i];
            if (
              totalSaleRevenue >= feeRange.from &&
              totalSaleRevenue <= feeRange.to
            ) {
              addToTotalAffiliateCharge(
                overAllFormula,
                'Flat Fee (with Sliding Scale)',
                feeRange.charge || 0,
                feeRange.charge || 0
              );
              break;
            }
          }
        } else {
          addToTotalAffiliateCharge(
            overAllFormula,
            'Flat Fee',
            dt.feeRange?.[0].charge || 0,
            dt.feeRange?.[0].charge || 0,
          );
        }
      } else if (dt.type === CHARGE_BASIS.COMMISSION) {
        if (dt.isSlidingScale) {
          for (let i = 0; i < dt.feeRange.length; i++) {
            const feeRange = dt.feeRange[i];
            if (
              totalSaleRevenue >= feeRange.from &&
              totalSaleRevenue <= feeRange.to
            ) {
              addToTotalAffiliateCharge(
                overAllFormula,
                'Commission (with Sliding Scale)',
                totalSaleRevenue * (feeRange.charge / 100),
                feeRange.charge
              );
              break;
            }
          }
        } else {
          addToTotalAffiliateCharge(
            overAllFormula,
            'Commission',
            totalSaleRevenue * (dt.feeRange?.[0].charge / 100),
            dt.feeRange?.[0].charge
          );
        }
      }
    });

    rmsCommision =
      (totalSaleRevenue * parseFloat(process.env.AFFILIATE_SALE_COMMISION)) /
      100;

    return {
      totalSaleRevenue,
      totalAffiliateCharge,
      totalCustomerProfit: totalSaleRevenue - totalAffiliateCharge,
      totalAffiliateProfit:
        totalAffiliateCharge - (request.price + rmsCommision),
      rmsCommision,
      itemFormula,
      overAllFormula
    };
  }
}
