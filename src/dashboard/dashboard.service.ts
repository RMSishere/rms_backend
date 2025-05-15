import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'aws-sdk/clients/appstream';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';
import { UserMiscInfoDto } from 'src/userMiscInfo/userMiscInfo.dto';
import { weekOfMonth } from 'src/util';

import { paginationLimit, REQUEST_STATUS, USER_ROLES } from '../config';
import { PAYMENT_STATUS } from '../config/index';
import { BaseFactory } from '../lib/base.factory';
import { Counter,Request, Payment, UserMiscInfo } from '../lib/index';
import { UserFactory } from '../users/users.factory';
import moment = require('moment');

@Injectable()
export class DashboardService extends BaseFactory {
  constructor(
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('userMiscInfo')
    public readonly userMiscInfoModel: Model<UserMiscInfo>,
    @InjectModel('payment') public readonly paymentModel: Model<Payment>,
    @InjectModel('request') public readonly requestModel: Model<Request>,
    @InjectModel('users') public readonly usersModel: Model<User>,
    public userFactory: UserFactory,
  ) {
    super(countersModel);
  }

  async getRequestsSummary(): Promise<any> {
    try {
      const activeRequests = await this.requestModel.countDocuments({
        status: REQUEST_STATUS.INIT,
      });
      const activeJobs = await this.requestModel.countDocuments({
        status: REQUEST_STATUS.JOB,
      });
      const pausedJobs = await this.requestModel.countDocuments({
        status: REQUEST_STATUS.PAUSE,
      });
      const closedJobs = await this.requestModel.countDocuments({
        status: REQUEST_STATUS.CLOSE,
      });

      let zipCodesGraphData = [];

      // top 10 performant zip codes
      zipCodesGraphData = await this.requestModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$zip',
            total: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]);

      const res = {
        activeRequests,
        activeJobs,
        pausedJobs,
        closedJobs,
        zipCodesGraphData,
      };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async getZipCodesWithNumberOfJobs(params: any): Promise<any> {
    try {
      const skip = parseInt(params.skip) || 0;
      const sort = JSON.parse(params.sort || null) || { jobsCount: -1 };

      const filter = { status: { $ne: REQUEST_STATUS.INIT } };

      const [{ count }] = await this.requestModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$zip',
          },
        },
        { $count: 'count' },
      ]);

      const result = await this.requestModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$zip',
            jobsCount: { $sum: 1 },
          },
        },
        { $sort: sort },
        { $skip: skip },
        { $limit: paginationLimit },
        { $project: { zipCode: '$_id', jobsCount: 1 } },
      ]);

      return { count, result, skip };
    } catch (error) {
      throw error;
    }
  }

  async getSaleCategoryStats(params: any): Promise<any> {
    try {
      const groupBy = params.groupBy;

      const filter = { status: { $ne: REQUEST_STATUS.INIT } };

      const result = await this.requestModel.aggregate([
        { $match: filter },
        {
          $unwind: {
            path: '$items',
            // preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: '$items.typeOfItem',
            // preserveNullAndEmptyArrays: true,
          },
        },
        // {
        //   $group: {
        //     _id: `$zip`,
        //     typeOfItem: '',
        //   },
        // },
        {
          $group: {
            _id: '$items.typeOfItem',
            averageSalesAmount: {
              $avg: '$items.amount',
            },
            totalSalesAmount: {
              $sum: '$items.amount',
            },
            itemsCount: { $sum: 1 },
          },
        },
        {
          $project: {
            typeOfItem: '$_id',
            averageSalesAmount: 1,
            totalSalesAmount: 1,
            itemsCount: 1,
          },
        },
      ]);

      return { result };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentsSummary(params): Promise<any> {
    try {
      const summaryBy = params.summaryBy;
      const availableSummaryBy = ['dayOfWeek', 'week', 'month', 'year'];
      let summaryGraphData = [];
      if (summaryBy && availableSummaryBy.includes(summaryBy)) {
        summaryGraphData = await this.paymentModel.aggregate([
          { $match: { status: PAYMENT_STATUS.COMPLETED.value } },
          {
            $group: {
              _id: { [`$${summaryBy}`]: '$createdAt' },
              total: { $sum: '$amount' },
            },
          },
        ]);

        if (summaryBy === 'month') {
          summaryGraphData.forEach(dt => {
            dt._id = moment.monthsShort(dt._id - 1);
          });
        } else if (summaryBy === 'dayOfWeek') {
          summaryGraphData.forEach(dt => {
            dt._id = moment.weekdaysShort(dt._id - 1);
          });
        } else if (summaryBy === 'week') {
          summaryGraphData.forEach(dt => {
            dt._id = `Week ${weekOfMonth(moment(dt._id, 'ww'))}, ${moment(
              dt._id,
              'ww',
            ).format('MMM')}`;
          });
        }
      }

      const totalRevenueData = await this.paymentModel.aggregate([
        { $match: { status: PAYMENT_STATUS.COMPLETED.value } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const totalRevenueBreakDown = await this.paymentModel.aggregate([
        { $match: { status: PAYMENT_STATUS.COMPLETED.value } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ]);

      const totalRevenue =
        totalRevenueData &&
        totalRevenueData.length &&
        totalRevenueData[0].total;

      // return await this.paymentModel.aggregate([
      //   // First total per day. Rounding dates with math here
      //   {
      //     $group: {
      //       _id: { $dayOfWeek: '$createdAt' },
      //       week: { $first: { $week: '$createdAt' } },
      //       // day: { $first: { $dayOfWeek: '$createdAt' } },
      //       month: { $first: { $month: '$createdAt' } },
      //       year: { $first: { $year: '$createdAt' } },
      //       total: { $sum: '$amount' },
      //     },
      //   },

      //   // Then group by week
      //   {
      //     $group: {
      //       _id: '$week',
      //       month: { $first: '$month' },
      //       days: {
      //         $push: {
      //           day: '$_id',
      //           total: '$total',
      //         },
      //       },
      //       total: { $sum: '$total' },
      //     },
      //   },
      //   // Then group by month
      //   {
      //     $group: {
      //       _id: '$month',
      //       year: { $first: '$year' },
      //       weeks: {
      //         $push: {
      //           week: '$_id',
      //           total: '$total',
      //           days: '$days',
      //         },
      //       },
      //       total: { $sum: '$total' },
      //     },
      //   },

      //   // Then group by year
      //   {
      //     $group: {
      //       _id: '$year',
      //       months: {
      //         $push: {
      //           month: '$_id',
      //           total: '$total',
      //           weeks: '$weeks',
      //         },
      //       },
      //       total: { $sum: '$total' },
      //     },
      //   },
      // ]);
      // const payments = await this.paymentModel
      //   .find()
      //   .limit(paginationLimit)
      //   .populate('payee')
      //   .sort({ createdAt: 'desc' });

      const res = {
        summaryGraphData,
        totalRevenue,
        totalRevenueBreakDown,
      };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async getUserSurveys(skip: number): Promise<PaginatedData> {
    try {
      const count = await this.userMiscInfoModel.countDocuments();

      const surveys = await this.userMiscInfoModel
        .find()
        .skip(skip)
        .limit(paginationLimit)
        .populate('user')
        .sort({ createdAt: 'desc' });

      const result = surveys.map(res => new UserMiscInfoDto(res));

      const finalData = { result, count, skip };

      return finalData;
    } catch (error) {
      throw error;
    }
  }

  async getUsersSummary(params): Promise<any> {
    try {
      const totalAffiliates = await this.usersModel.countDocuments({
        role: USER_ROLES.AFFILIATE,
      });
      const totalCustomers = await this.usersModel.countDocuments({
        role: USER_ROLES.CLIENT,
      });

      const res = {
        totalAffiliates,
        totalCustomers,
      };

      return res;
    } catch (error) {
      throw error;
    }
  }
}
