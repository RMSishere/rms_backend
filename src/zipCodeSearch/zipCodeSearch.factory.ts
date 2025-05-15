import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedData } from 'src/common/interfaces';

import { paginationLimit } from '../config';
import { ZipCodeSearch } from '../lib/index';
import { ZipCodeSearchDto } from './zipCodeSearch.dto';

@Injectable()
export class ZipCodeSearchFactory {
  constructor(
    @InjectModel('ZipCodeSearch')
    public readonly zipCodeSearchModel: Model<ZipCodeSearch>,
  ) {}

  async getAllZipCodeSearch(params: any): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const count = await this.zipCodeSearchModel.countDocuments();

    const zipCodeSearches = await this.zipCodeSearchModel
      .find()
      .skip(skip)
      .limit(paginationLimit)
      .sort({ affiliatesCount: 1, searchCount: -1 })
      .populate('users')
      .lean();

    const result = zipCodeSearches.map(res => new ZipCodeSearchDto(res));

    const res = { result, count, skip };

    return res;
  }
  catch(error) {
    throw error;
  }
}
