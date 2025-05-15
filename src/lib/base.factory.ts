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
    console.log("hello", id);
    try {
      console.log("erererererer");
      const nextNumber = await this.countersModel.findOneAndUpdate(
        { id: id },
        { $inc: { counter: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log(nextNumber, 'next number');
      const nextNumberObj = nextNumber ? nextNumber.toObject() : null;
      return nextNumberObj.counter.toString();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
  
  getCreatedBy(user: User) {
    return user.email
  }

  getUpdatedBy(user: User) {
    return user.email;
  }
}
