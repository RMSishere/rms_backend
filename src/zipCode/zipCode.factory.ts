import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseFactory } from '../lib/base.factory';
import { Counter, User, ZipCode } from '../lib/index';
import { ZipCodeDto } from './zipCode.dto';

@Injectable()
export class ZipCodeFactory extends BaseFactory {
  constructor(
    @InjectModel('ZipCode') public readonly zipCodeModel: Model<ZipCode>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
  ) {
    super(countersModel);
  }

  async createZipCode(data: ZipCode, user: User): Promise<ZipCode> {
    try {
      data.id = await this.generateSequentialId('ZipCode');
      data.createdBy = this.getCreatedBy(user);
      const newZipCode = new this.zipCodeModel(data);
      const res = await newZipCode.save();

      const result = new ZipCodeDto(res);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async getZipCode(zipCode: string): Promise<ZipCode> {
    try {
      const zipCodeData = await this.zipCodeModel
        .findOne({ zipCode, isActive: true })
        .exec();

      const result = zipCodeData && new ZipCodeDto(zipCodeData);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async updateZipCodeData(
    id: string,
    data: ZipCode,
    user: User,
  ): Promise<ZipCode> {
    try {
      data.updatedBy = this.getUpdatedBy(user);

      const filter = { id, isActive: true };
      const newValue = { $set: data };
      const updatedZipCode = await this.zipCodeModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );

      const res = new ZipCodeDto(updatedZipCode);

      return res;
    } catch (err) {
      throw err;
    }
  }
}
