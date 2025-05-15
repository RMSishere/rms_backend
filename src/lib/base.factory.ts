import { Injectable } from "@nestjs/common";
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from './counter';
import { User } from "./user";

@Injectable()
export class BaseFactory {
  public counter: Counter[] = [];

  constructor(
    @InjectModel('counters') public readonly countersModel: Model<Counter>
  ) { }

  async generateSequentialId(id: string) {
    try {
      const nextNumber = await this.countersModel.findOneAndUpdate(
        { id: id },
        { $inc: { counter: 1 } },
        { new: true }
      );

      const nextNumberObj = nextNumber ? nextNumber.toObject() : null;
      return nextNumberObj.counter.toString();
    }
    catch (err) {

    }
  }

  getCreatedBy(user: User) {
    return user.email
  }

  getUpdatedBy(user: User) {
    return user.email;
  }
}
