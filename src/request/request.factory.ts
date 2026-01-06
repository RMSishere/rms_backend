import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Twilio } from 'twilio';
import { AppointmentFactory } from 'src/appointment/appointment.factory';
import { JobUpdate, PaginatedData } from 'src/common/interfaces';
import { JobReviewDto } from 'src/jobReview/jobReview.dto';
import { NotificationFactory } from 'src/notification/notification.factory';
import { UserFactory } from 'src/users/users.factory';
import { GHLService } from 'src/ghl/ghl.service'; // adjust path
import { getAgreement, getfullName } from 'src/util';
import { ZipCodeFactory } from 'src/zipCode/zipCode.factory';
import { NotificationSubscription } from 'src/lib'; // adjust path if needed
import { GHL_STAGES, GHL_PIPELINES } from 'src/ghl/ghl.mapper'; // adjust path

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
import { sendTemplateEmail } from 'src/util/sendMail';
import { User2Dto } from '../users/users.dto'; // adjust path as needed
@Injectable()
export class RequestFactory extends BaseFactory {
constructor(
  @InjectModel('request') public readonly requestModel: Model<Request>,
  @InjectModel('counters') public readonly countersModel: Model<Counter>,
  @InjectModel('JobReview') public readonly jobReviewModel: Model<JobReview>,
  @InjectModel('users') public readonly userModel: Model<User>,
  @InjectModel('NotificationSubscription') public readonly notificationSubscriptionModel: Model<NotificationSubscription>,
  public notificationfactory: NotificationFactory,
  public appointmentfactory: AppointmentFactory,
  public zipCodeFactory: ZipCodeFactory,
  public userFactory: UserFactory,
  public scheduleFactory: ScheduleFactory,
  public ghlService: GHLService,     // <-- ADD THIS ✔️
) {
  super(countersModel);
}

 twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

async createRequest(data: Request, user: User): Promise<any> {
  try {
    // --------------------------------------------
    // ✅ 1) Basic validation
    // --------------------------------------------
    const rawZip = String((data as any)?.zip ?? '').trim();

    if (!rawZip) {
      throw new BadRequestException('Zip code is required.');
    }

    // US ZIP only (5 digits)
    const isValidZip = /^\d{5}$/.test(rawZip);
    if (!isValidZip) {
      // This also blocks PK style zip early because it's not 5 digits
      throw new BadRequestException('Invalid zip code. Please provide a 5-digit zip code.');
    }

    (data as any).zip = rawZip;

    // --------------------------------------------
    // ✅ 2) CASE #3: Stop if ZIP is NOT a real US ZIP
    // (NO schema change) - uses external validation
    // --------------------------------------------
    const isUS = await this.zipCodeFactory.isUSZip(rawZip);
    if (!isUS) {
      throw new BadRequestException(
        'Thank you for submitting your request, but we currently only serve the United States. We do hope to serve your area in the future.',
      );
    }

    // --------------------------------------------
    // ✅ 3) Validate user + subscription
    // --------------------------------------------
    const userdata = await this.userModel.findById(user._id);
    if (!userdata) {
      throw new BadRequestException('User not found.');
    }

    const plan = getCustomerPlanDetails(userdata.subscription?.type);
    if (!plan) {
      throw new BadRequestException('Unable to determine your subscription plan.');
    }

    if ((userdata.subscription?.jobRequestCountThisMonth ?? 0) >= plan.jobRequestLimit) {
      throw new BadRequestException('Job request limit exceeded for this month.');
    }

    // --------------------------------------------
    // ✅ 4) Build request
    // --------------------------------------------
    data.id = await this.generateSequentialId('request');
    data.requesterOwner = user;
    data.createdBy = this.getCreatedBy(user);

    const admin = await this.userFactory.getAdmin();

    // --------------------------------------------
    // ✅ 5) CASE #1 / #2: Affiliate coverage check
    // zipInfo is ONLY for affiliate/service-area record (not US validation)
    // --------------------------------------------
    const zipInfo = await this.zipCodeFactory.getZipCode(rawZip);

    const affiliates: User[] = await this.userFactory.getApprovedAffiliates({
      'businessProfile.nearByZipCodes': rawZip,
    });

    // Case #2 if there is no service-area zip record OR no affiliates returned
    const isOutOfAffiliateArea = !zipInfo || (affiliates?.length ?? 0) === 0;

    // --------------------------------------------
    // ✅ 6) Pricing (must NEVER break case #2)
    // Your findRequestPrice now always returns a number (fallback)
    // --------------------------------------------
    const computedPrice = await this.findRequestPrice(rawZip, affiliates.length);

    if (computedPrice === undefined || computedPrice === null) {
      // should never happen with updated findRequestPrice
      throw new BadRequestException(
        `Pricing is not configured for zip code (${rawZip}). Please contact support.`,
      );
    }

    (data as any).price = computedPrice;

    // --------------------------------------------
    // ✅ 7) Save
    // --------------------------------------------
    const newRequest = new this.requestModel(data);
    const res = await newRequest.save();
    const request = new RequestDto(res);

    // --------------------------------------------
    // 🟩 GHL: Move Customer → ACTIVE_JOB (non-blocking)
    // --------------------------------------------
    try {
      if (user.role === USER_ROLES.CLIENT && userdata?.ghlCustomerOpportunityId) {
        await this.ghlService.moveStage(
          userdata.ghlCustomerOpportunityId,
          GHL_STAGES.CUSTOMERS.ACTIVE_JOB,
        );
      }
    } catch (err: any) {
      console.error('⚠️ GHL ACTIVE_JOB Error:', err?.message || err);
    }

    // --------------------------------------------
    // ✅ Notifications (non-blocking)
    // Case #1: affiliates + admin
    // Case #2: admin only
    // --------------------------------------------
    try {
      let requestLabel = '';
      if (SERVICES[request.requestType]?.label) {
        requestLabel = SERVICES[request.requestType].label;
      }

      const title = `New Service Request - ${requestLabel}`;
      const description = "Congrats! You've got a new service request in your area.";
      const adminDescription = `Congrats! There is a new service request in zip code ${request.zip}.`;

      if (affiliates?.length) {
        this.notificationfactory
          .sendNotification(affiliates, NOTIFICATION_TYPES.NEW_JOB, {
            inApp: { message: { requestId: request.id, title, description } },
            text: { message: `${title}\n${description}` },
            email: { template: MAIL_TEMPLATES.NEW_REQUEST, locals: { title, description } },
          })
          .catch(() => null);
      }

      // Always notify admin
      this.notificationfactory
        .sendNotification(admin, NOTIFICATION_TYPES.NEW_JOB, {
          inApp: { message: { requestId: request.id, title, description: adminDescription } },
          text: { message: `${title}\n${adminDescription}` },
          email: {
            template: MAIL_TEMPLATES.NEW_REQUEST,
            locals: { title, description: adminDescription },
          },
        })
        .catch(() => null);
    } catch (err: any) {
      console.error('⚠️ Notification Error:', err?.message || err);
    }

    // --------------------------------------------
    // ✅ Tagging (non-blocking)
    // --------------------------------------------
    try {
      const customerTags = ['customer-new', 'approved', 'background_check_passed'];
      if (user?.ghlContactId && customerTags.length) {
        await this.ghlService.addTag(user.ghlContactId, customerTags[0]);
      }
    } catch (err: any) {
      console.error('⚠️ GHL Customer Tag add error:', err?.message || err);
    }

    try {
      const affiliateTags = ['affiliate_active', 'affiliate_approved'];
      if (affiliates?.length) {
        for (const affiliate of affiliates) {
          if (affiliate?.ghlContactId) {
            await this.ghlService.addTag(affiliate.ghlContactId, affiliateTags[0]);
          }
        }
      }
    } catch (err: any) {
      console.error('⚠️ GHL Affiliate Tag add error:', err?.message || err);
    }

    // --------------------------------------------
    // ✅ Final response (adds meta for frontend)
    // Case #2: frontend should show warning & allow continue
    // --------------------------------------------
    return {
      ...request,
      meta: {
        isOutOfAffiliateArea,
        warning: isOutOfAffiliateArea
          ? "Thank you! We currently don't have affiliates in your area yet, but you can still submit the request."
          : null,
      },
    };
  } catch (err: any) {
    // --------------------------------------------
    // ✅ Return proper HTTP errors instead of 500
    // --------------------------------------------
    if (err instanceof BadRequestException || err instanceof ForbiddenException) {
      throw err;
    }

    if (err?.name === 'ValidationError') {
      throw new BadRequestException(err?.message || 'Validation failed.');
    }

    if (err?.name === 'CastError') {
      throw new BadRequestException('Invalid data provided.');
    }

    console.error('🔥 createRequest unexpected error:', err?.message || err);
    throw new InternalServerErrorException(
      'Failed to create request. Please try again or contact support.',
    );
  }
}



async getAllRequests(params: any, user: User): Promise<PaginatedData> {
  console.log("📥 Params:", params);
  console.log("👤 Current User:", user);

  const skip = parseInt(params.skip) || 0;
  const filter: any = { isActive: true, status: REQUEST_STATUS.INIT };

  try {
    if (params.requestType) {
      filter['requestType'] = { $in: params.requestType.split(',') };
      console.log("🔍 Applied requestType filter:", filter['requestType']);
    }

    if (params.status) {
      const statusList = params.status.split(',');
      console.log("📌 Status List:", statusList);

      if (statusList.includes('new')) {
        const oneMonthAgo = moment().subtract(1, 'month').toISOString();
        filter['createdAt'] = { $gte: oneMonthAgo };
        console.log("🕒 Applied 'new' createdAt filter:", filter['createdAt']);
      }

      if (statusList.includes('interestedAffiliates')) {
        filter['leads'] = { $exists: true, $ne: [] };
        console.log("👥 Applied interestedAffiliates filter");
      }
    }

    if (params.onDate) {
      filter['createdAt'] = {
        $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
        $lt: moment(params.onDate, 'YYYY-MM-DD').add(1, 'day').toISOString(),
      };
      console.log("📅 Applied onDate filter:", filter['createdAt']);
    }

    if (user.role === USER_ROLES.CLIENT || user.role === 1) {
      filter['requesterOwner'] = user._id;
      console.log("🙋 Applied requesterOwner filter (CLIENT):", filter['requesterOwner']);
    } else if (user.role === USER_ROLES.AFFILIATE || user.role === 2) {
      console.log("🔐 Affiliate role detected, verifying subscription...");

      const subscribedToNewJobs = await this.notificationSubscriptionModel.findOne({
        isActive: true,
        id: '303',
        forRoles: { $in: [user.role] },
      });

      if (!subscribedToNewJobs) {
        console.warn(`⛔ Affiliate not subscribed to New Jobs. User ID: ${user.id}`);
        return { result: [], count: 0, skip: 0 };
      }

      console.log("✅ Affiliate is subscribed to New Jobs");

      const affiliate = await this.userFactory.getApprovedAffiliate({ _id: user._id });
      console.log("📄 Fetched affiliate profile:", affiliate);

      if (!affiliate || !affiliate.businessProfile) {
        console.warn(`⛔ Invalid affiliate profile for User ID: ${user.id}`);
        return { result: [], count: 0, skip: 0 };
      }

      const { businessProfile } = affiliate;

      // ✅ ZIP filter logic: prefer nearByZipCodes, fallback to affiliate.zipCode
      if (
        Array.isArray(businessProfile.nearByZipCodes) &&
        businessProfile.nearByZipCodes.length > 0
      ) {
        filter['zip'] = { $in: businessProfile.nearByZipCodes };
        console.log("📍 Applied zip filter from nearByZipCodes:", filter['zip']);
      } else {
        const fallbackZip = String(affiliate.zipCode || affiliate.businessProfile?.zip_code || '').trim();
        console.log("📦 Fallback zip from affiliate object:", fallbackZip);

        if (fallbackZip.length > 0) {
          filter['zip'] = fallbackZip;
          console.warn(`⚠️ No nearByZipCodes — using fallback zip: ${fallbackZip}`);
        } else {
          console.warn(`⛔ No zip filtering possible — missing both nearByZipCodes and fallback zip`);
          return { result: [], count: 0, skip: 0 };
        }
      }

      // ✅ Filter based on services
      if (businessProfile.services?.length) {
        filter['requestType'] = { $in: businessProfile.services };
        console.log("🔧 Applied services filter:", filter['requestType']);
      } else {
        console.warn(`⛔ Affiliate does not offer any services. User ID: ${user.id}`);
        return { result: [], count: 0, skip: 0 };
      }
    } else if (user.role !== USER_ROLES.ADMIN) {
      console.error("🚫 Forbidden role:", user.role);
      throw new ForbiddenException();
    }

    console.log("📦 Final DB Filter:", JSON.stringify(filter, null, 2));

    const count = await this.requestModel.countDocuments(filter);
    console.log("📊 Matching Request Count:", count);

    let requests = await this.requestModel.find(filter).populate('requesterOwner');
    console.log("📥 Raw Requests Fetched:", requests.length);

    const sevenDaysAgo = moment().subtract(7, 'days');

    requests = requests.filter((req, idx) => {
      if (!req.requesterOwner) {
        console.warn(`⛔ Skipping request with null requesterOwner. Index: ${idx}, ID: ${req._id}`);
        return false;
      }
      return true;
    });

    console.log("✅ Filtered Requests With Valid Owners:", requests.length);

    requests = requests.sort((a, b) => {
      const aUser = new User2Dto(a.requesterOwner);
      const bUser = new User2Dto(b.requesterOwner);

      const aSub = aUser.subscription?.type;
      const bSub = bUser.subscription?.type;

      const aIsPremium =
        (aSub === 'SIMPLIFY' || aSub === 'WHITE_GLOVE') &&
        moment(a.createdAt).isAfter(sevenDaysAgo);

      const bIsPremium =
        (bSub === 'SIMPLIFY' || bSub === 'WHITE_GLOVE') &&
        moment(b.createdAt).isAfter(sevenDaysAgo);

      if (aIsPremium && !bIsPremium) return -1;
      if (!aIsPremium && bIsPremium) return 1;

      return moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf();
    });

    const paginated = requests.slice(skip, skip + paginationLimit);
    const result = paginated.map(res => new RequestDto(res));

    console.log("📤 Final Paginated Result Count:", result.length);
    return { result, count, skip };
  } catch (error) {
    console.error('🔥 Error in getAllRequests:', error);
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
  if (!appointment?.notify) return;

  const today = moment();
  const appointmentDate = moment(appointment.startTime);

  // Only schedule future/same-day appointments
  if (!appointmentDate.isSameOrAfter(today, 'day')) return;

  const serviceLabel = SERVICES[request.requestType]?.label || 'Service';

  // ----------------------------------------------------
  // ✅ EMAIL REMINDERS (existing)
  // ----------------------------------------------------
  const emailData = {
    appointment,
    service: SERVICES[request.requestType],
  };

  const to = (appointment as any)?.appointee?.email || (appointment as any)?.appointee?.['email'];

  if (to) {
    const twoWeeksBeforeDate = moment(appointmentDate).subtract(2, 'weeks');
    if (twoWeeksBeforeDate.isSameOrAfter(today, 'day')) {
      await this.scheduleFactory.addScheduleJob({
        jobDate: twoWeeksBeforeDate.tz('US/Pacific').hours(11).minute(0).toDate(),
        jobType: SCHEDULE_JOB.SEND_MAIL,
        jobFor: (appointment as any)._id,
        jobForModel: 'appointment',
        jobData: {
          to,
          template: MAIL_TEMPLATES.APPOINTMENT_REMINDERS.TWO_WEEKS_BEFORE,
          emailData,
          from: MAIL_FROM.AFFILIATE,
        },
      });
    }

    const oneWeekBeforeDate = moment(appointmentDate).subtract(1, 'week');
    if (oneWeekBeforeDate.isSameOrAfter(today, 'day')) {
      await this.scheduleFactory.addScheduleJob({
        jobDate: oneWeekBeforeDate.tz('US/Pacific').hours(11).minute(0).toDate(),
        jobType: SCHEDULE_JOB.SEND_MAIL,
        jobFor: (appointment as any)._id,
        jobForModel: 'appointment',
        jobData: {
          to,
          template: MAIL_TEMPLATES.APPOINTMENT_REMINDERS.ONE_WEEK_BEFORE,
          emailData,
          from: MAIL_FROM.AFFILIATE,
        },
      });
    }

    await this.scheduleFactory.addScheduleJob({
      jobDate: appointmentDate.tz('US/Pacific').hours(11).minute(0).toDate(),
      jobType: SCHEDULE_JOB.SEND_MAIL,
      jobFor: (appointment as any)._id,
      jobForModel: 'appointment',
      jobData: {
        to,
        template: MAIL_TEMPLATES.APPOINTMENT_REMINDERS.ON_APPOINTMENT_DATE,
        emailData,
        from: MAIL_FROM.AFFILIATE,
      },
    });
  }

  // ----------------------------------------------------
  // ✅ PUSH REMINDERS (NEW) — 24h and 3h before (Customer)
  // Uses ScheduleFactory jobType: SCHEDULE_JOB.SEND_PUSH
  // ----------------------------------------------------
  try {
    const appointeeId =
      (appointment as any)?.appointee?._id || (appointment as any)?.appointee;

    if (!appointeeId) return;

    // 🔔 24 hours before (quiet hours ON)
    const push24hDate = moment(appointmentDate).subtract(24, 'hours');
    if (push24hDate.isAfter(today)) {
      await this.scheduleFactory.addScheduleJob({
        jobDate: push24hDate.toDate(),
        jobType: SCHEDULE_JOB.SEND_PUSH,
        jobFor: (appointment as any)._id,
        jobForModel: 'appointment',
        jobData: {
          userId: String(appointeeId),
          title: 'Reminder for tomorrow',
          body: `Your ${serviceLabel} is tomorrow at ${appointmentDate.format('h:mm A')}.`,
          data: {
            type: 'appointment_reminder_24h',
            requestId: request.id,
            appointmentId: (appointment as any).id,
          },
          quietHours: true,
        },
      });
    }

    // 🔔 3 hours before (quiet hours OFF because critical)
    const push3hDate = moment(appointmentDate).subtract(3, 'hours');
    if (push3hDate.isAfter(today)) {
      await this.scheduleFactory.addScheduleJob({
        jobDate: push3hDate.toDate(),
        jobType: SCHEDULE_JOB.SEND_PUSH,
        jobFor: (appointment as any)._id,
        jobForModel: 'appointment',
        jobData: {
          userId: String(appointeeId),
          title: `Today’s the day`,
          body: `Your ${serviceLabel} is at ${appointmentDate.format('h:mm A')}.`,
          data: {
            type: 'appointment_reminder_3h',
            requestId: request.id,
            appointmentId: (appointment as any).id,
          },
          quietHours: false,
        },
      });
    }
  } catch (err: any) {
    console.error('⚠️ schedule PUSH reminders failed:', err?.message || err);
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

      const requestDoc = await this.requestModel
        .findOne({ id: requestId })
        .populate('requesterOwner');

      if (requestDoc && requestDoc.requesterOwner) {
        const requester = requestDoc.requesterOwner as any;
        const serviceLabel = SERVICES[requestDoc.requestType]?.label || 'Service';
        const appointmentDate = moment(jobUpdate.appointment.startTime).format(
          'MMMM Do YYYY, h:mm A',
        );

        const title = `Appointment Scheduled`;
        const description = `Your ${serviceLabel} appointment has been scheduled for ${appointmentDate}.`;

        // ✅ In-App Notification (ADDED)
        try {
          await this.notificationfactory.sendNotification(
            requester,
            NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
            {
              inApp: {
                message: {
                  requestId,
                  title,
                  description,
                  screen: 'JobUpdates',
                  screenParams: { id: requestId },
                },
              },
            },
          );
        } catch (inAppErr: any) {
          console.error('⚠️ InApp notify failed (addJobUpdate):', inAppErr?.message || inAppErr);
        }

        // ✅ Email via NotificationFactory (KEPT)
        await this.notificationfactory.sendNotification(
          requester,
          NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
          {
            email: {
              template: MAIL_TEMPLATES.NEW_MESSAGE,
              locals: {
                subject: title,
                body: description,
                message: {
                  sender: {
                    firstName: requester.firstName || 'Unknown',
                    lastName: requester.lastName || 'User',
                  },
                  messageFor: {
                    id: requestId,
                  },
                },
                service: {
                  label: serviceLabel,
                },
              },
            },
          },
        );

        // ✅ SMS via Twilio (KEPT, just safer E.164 formatting)
        if (requester.phoneNumber) {
          const raw = String(requester.phoneNumber).trim();
          const toPhoneNumber = raw.startsWith('+') ? raw : `+1${raw}`;

          await this.twilioClient.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: toPhoneNumber,
            body: `${title}: ${description}`,
          });
        }
      }
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

    return new RequestDto(updatedRequest);
  } catch (err) {
    throw err;
  }
}


// inside your factory/service
async addJobAgreement(
  requestId: string,
  agreement: any,
  user: User,
): Promise<Request> {
  // Coerce numeric strings => numbers; leave undefined if bad
  const num = (v: any) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const unwrap = (a: any) => (a && a.data ? a.data : a) || {};

  // Normalize paymentWay (now uses "percent")
  const normalizePaymentWay = (pwRaw: any = {}) => {
    const type =
      pwRaw.type ||
      (pwRaw.deposit != null || pwRaw.completion != null ? 'DEPOSIT' : 'FULL');

    const base: any = {
      type,
      name: pwRaw.name ?? undefined,
      note: pwRaw.note ?? undefined,
    };

    if (type === 'DEPOSIT') {
      base.deposit = num(pwRaw.deposit) ?? 0;
      base.completion = num(pwRaw.completion) ?? 0;

      // Accept both "percent" and legacy "%", but persist as "percent"
      const rawPct =
        pwRaw.percent !== undefined ? pwRaw.percent : pwRaw['%'];
      const truthy = new Set([true, 'true', 1, '1', 'yes', 'YES', '%']);
      base.percent = truthy.has(rawPct) ? true : !!rawPct;

      // Optional inference if omitted:
      // if (base.percent === false && base.deposit <= 100 && base.completion <= 100) {
      //   base.percent = true;
      // }
    } else {
      // FULL/other legacy
      if (pwRaw.amount != null) base.amount = num(pwRaw.amount) ?? 0;
    }

    return base;
  };

  try {
    const payload = unwrap(agreement);

    if (payload.paymentWay) {
      payload.paymentWay = normalizePaymentWay(payload.paymentWay);
    }

    // Trim UI-only bits
    if (Array.isArray(payload.itemServiceAreas)) {
      payload.itemServiceAreas = payload.itemServiceAreas.map((x: any) => ({
        name: x?.name,
        note: x?.note,
      }));
    }

    const filter = { id: requestId, isActive: true, 'leads.affiliate': user };
    const newValue = { $set: { 'leads.$.agreement': payload } };

    const updatedRequest = await this.requestModel.findOneAndUpdate(
      filter,
      newValue,
      { new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const request = new RequestDto(updatedRequest);

    if (request && request.requesterOwner) {
      let requestLabel = '';
      if (SERVICES[request.requestType]?.label) {
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
async getRequestById2(id: string, viewer: User): Promise<Request> {
  try {
    console.log('here');
    const requestDoc = await this.requestModel
      .findOne({ id: id, isActive: true })
      .populate('requesterOwner')
      .populate('hiredAffiliate')
      .populate('leads.affiliate');

    if (!requestDoc) {
      throw new Error('Request not found');
    }

    const isAffiliate = viewer?.role === USER_ROLES.AFFILIATE;
    const rating = viewer?.businessProfile?.rating;
    const isTopRated = isAffiliate && rating >= 4.8;

    if (isTopRated) {
      const requester: any = requestDoc.requesterOwner;

      // ✅ FIX: use the correct signature consistently:
      // sendNotification(to, NOTIFICATION_TYPES.X, payload)
      await this.notificationfactory.sendNotification(
        requester,
        NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
        {
          inApp: {
            message: {
              requestId: id,
              title: 'Top-Rated Affiliate Viewed Your Job',
              description: `A top-rated affiliate (${viewer.firstName} ${viewer.lastName}) viewed your job.`,
              screen: 'JobDetails',
              screenParams: { id },
            },
          },
          email: {
            template: MAIL_TEMPLATES.NEW_MESSAGE,
            locals: {
              subject: 'A top-rated affiliate viewed your job',
              body: `A top-rated affiliate (${viewer.firstName} ${viewer.lastName}) just viewed your job.`,
            },
          },
          text: {
            message: `A top-rated affiliate (${viewer.firstName} ${viewer.lastName}) viewed your job.`,
          },
        },
      );
    }

    return new RequestDto(requestDoc);
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

    // ----------------------------------------------------
    // 🟩 GHL SYNC — Move CUSTOMER Opportunity → REPEAT_CUSTOMER
    // ----------------------------------------------------
    try {
      const requester = res.requesterOwner;

      if (requester?.role === USER_ROLES.CLIENT && requester?.ghlCustomerOpportunityId) {
        await this.ghlService.moveStage(
          requester.ghlCustomerOpportunityId,
          GHL_STAGES.CUSTOMERS.REPEAT_CUSTOMER,
        );
      }
    } catch (err: any) {
      console.error('⚠️ GHL finalizeSale ERROR:', err?.message || err);
    }

    // ----------------------------------------------------
    // 🟩 GHL TAGGING - Add Appropriate Tags for Finalized Sale
    // ----------------------------------------------------
    try {
      const requester = res.requesterOwner;
      const customerTags = ['customer-new', 'approved', 'background_check_passed'];

      if (requester?.ghlContactId && customerTags.length) {
        for (const tag of customerTags) {
          await this.ghlService.addTag(requester.ghlContactId, tag);
        }
      }
    } catch (err: any) {
      console.error('⚠️ GHL TAGGING ERROR:', err?.message || err);
    }

    // ----------------------------------------------------
    // NOTIFICATIONS TO REQUESTER - SALE FINALIZED
    // ----------------------------------------------------
    const subscriptionIndex =
      res.requesterOwner.notificationSubscriptions.findIndex(
        (dt) => dt.title === NOTIFICATION_TYPES.JOB_STATUS_UPDATES.title,
      );

    if (subscriptionIndex >= 0) {
      // ✅ keep your existing text notification (as-is)
      this.notificationfactory.sendNotification(
        res.requesterOwner,
        NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
        {
          text: {
            message: `Congrats! Your sale # ${res.id} has been finalized.`,
          },
          // ✅ add inApp + email (ADDED)
          inApp: {
            message: {
              requestId: res.id,
              title: 'Sale Finalized ✅',
              description: `Congrats! Your sale #${res.id} has been finalized.`,
              screen: 'JobDetails',
              screenParams: { id: res.id },
            },
          },
          email: {
            template: MAIL_TEMPLATES.NEW_MESSAGE,
            locals: {
              subject: 'Sale Finalized ✅',
              body: `Congrats! Your sale #${res.id} has been finalized.`,
            },
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

    const requestDoc = await this.requestModel.findOneAndUpdate(
      filter,
      update,
      { new: true }
    );

    if (!requestDoc) {
      throw new InternalServerErrorException('Job not found or already closed.');
    }

    const request = new RequestDto(requestDoc);

    // ----------------------------------------------------
    // 🟩 GHL SYNC — Move CUSTOMER Opportunity → LOST (Job Closed)
    // ----------------------------------------------------
    try {
      const requester = request.requesterOwner;

      if (
        requester?.role === USER_ROLES.CLIENT &&
        requester?.ghlCustomerOpportunityId
      ) {
        await this.ghlService.moveStage(
          requester.ghlCustomerOpportunityId,
          GHL_STAGES.CUSTOMERS.LOST  // Use the actual "LOST" stage in GHL
        );
      }
    } catch (err) {
      console.error("⚠️ GHL closeJob ERROR:", err.message);
    }
    // ----------------------------------------------------

    // ----------------------------------------------------
    // 🟩 GHL TAGGING — Add Appropriate Tags for Closed Job
    // ----------------------------------------------------
    try {
      const requester = request.requesterOwner;
      const customerTags = ['customer-new', 'job-closed', 'background_check_passed'];

      // Add tags to the customer if the requester is a client
      if (requester?.ghlContactId && customerTags.length) {
        for (const tag of customerTags) {
          await this.ghlService.addTag(requester.ghlContactId, tag);
        }
      }

      // Optional: Add tags to the affiliate if needed
      if (request.hiredAffiliate?.ghlContactId) {
        const affiliateTags = ['affiliate-active', 'affiliate-job-closed'];
        for (const tag of affiliateTags) {
          await this.ghlService.addTag(request.hiredAffiliate.ghlContactId, tag);
        }
      }
    } catch (err) {
      console.error("⚠️ GHL TAGGING ERROR:", err.message);
    }
    // ----------------------------------------------------

    // ----------------------------------------------------
    // Send Notifications to Requester & Hired Affiliate
    // ----------------------------------------------------
    this.notificationfactory
      .sendNotification(
        [request.requesterOwner, request.hiredAffiliate],
        NOTIFICATION_TYPES.JOB_STATUS_UPDATES,
        {
          text: {
            message: `The request # ${request.id} has been closed.`,
          },
        }
      )
      .catch(() => null);
    // ----------------------------------------------------

    return request;
  } catch (error) {
    throw error;
  }
}



 async findRequestPrice(zip: string, count: number): Promise<number> {
  let leadCalculations = [];

  // If zip exists in DB, use its leadCalculations
  const zipCodeData = await this.zipCodeFactory.getZipCode(zip);

  if (zipCodeData?.leadCalculations?.length) {
    leadCalculations = zipCodeData.leadCalculations;
  } else {
    // fallback for case #2
    leadCalculations = defaultLeadCalculations;
  }

  for (let i = 0; i < leadCalculations.length; i++) {
    const item = leadCalculations[i];
    if (count >= item.minCount && count <= item.maxCount) {
      return item.price;
    }
  }

  // ✅ Extra safety fallback (if config ranges are wrong)
  if (leadCalculations?.length) {
    // Return last slab price
    return leadCalculations[leadCalculations.length - 1].price;
  }

  // Absolute last fallback (should not happen)
  return 0;
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
