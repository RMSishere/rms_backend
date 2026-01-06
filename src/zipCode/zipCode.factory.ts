import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseFactory } from '../lib/base.factory';
import { Counter, User, ZipCode } from '../lib/index';
import { ZipCodeDto } from './zipCode.dto';

type CacheEntry = { value: boolean; expiresAt: number };

@Injectable()
export class ZipCodeFactory extends BaseFactory {
  // ✅ simple in-memory cache to avoid repeated external calls
  private readonly usZipCache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 1000 * 60 * 60 * 24; // 24h

  constructor(
    @InjectModel('ZipCode') public readonly zipCodeModel: Model<ZipCode>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
  ) {
    super(countersModel);
  }

  async createZipCode(data: ZipCode, user: User): Promise<ZipCode> {
    data.id = await this.generateSequentialId('ZipCode');
    data.createdBy = this.getCreatedBy(user);

    const newZipCode = new this.zipCodeModel(data);
    const res = await newZipCode.save();
    return new ZipCodeDto(res);
  }

  // ✅ Your existing lookup: this is "affiliate/service area" zip
  async getZipCode(zipCode: string): Promise<ZipCode | null> {
    const zipCodeData = await this.zipCodeModel
      .findOne({ zipCode, isActive: true })
      .exec();

    return zipCodeData ? new ZipCodeDto(zipCodeData) : null;
  }

  /**
   * ✅ NEW: Check if zip is a real US zip (Case #3 blocker)
   * - NO schema changes needed
   * - Uses Zippopotam.us public endpoint:
   *   GET https://api.zippopotam.us/us/{zip}
   *   200 => valid US zip, 404 => not US
   */
  async isUSZip(zipCode: string): Promise<boolean> {
    const zip = String(zipCode ?? '').trim();

    // If you only accept 5 digits, keep this strict.
    if (!/^\d{5}$/.test(zip)) return false;

    // ✅ cache hit
    const cached = this.usZipCache.get(zip);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      const ok = res.ok; // 200 => US zip exists, 404 => not
      this.usZipCache.set(zip, { value: ok, expiresAt: Date.now() + this.cacheTtlMs });
      return ok;
    } catch (err) {
      // If network fails, be safe:
      // returning false will block — or you can choose to allow with warning.
      // I recommend BLOCK to avoid letting non-US proceed.
      this.usZipCache.set(zip, { value: false, expiresAt: Date.now() + 1000 * 60 * 5 }); // 5 min cache
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async updateZipCodeData(id: string, data: ZipCode, user: User): Promise<ZipCode> {
    data.updatedBy = this.getUpdatedBy(user);

    const filter = { id, isActive: true };
    const newValue = { $set: data };

    const updatedZipCode = await this.zipCodeModel.findOneAndUpdate(filter, newValue, {
      new: true,
    });

    return new ZipCodeDto(updatedZipCode);
  }
}
