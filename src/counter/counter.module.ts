import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CounterSchema } from './counter.model';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'counters', schema: CounterSchema }])
  ],
  exports: [
    MongooseModule.forFeature([{ name: 'counters', schema: CounterSchema }])
  ]
})

export class CounterModule { }