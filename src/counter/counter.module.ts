// counter.module.ts
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CounterSchema } from './counter.model';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'counters', schema: CounterSchema }]),
  ],
  exports: [
    MongooseModule, // ✅ export the module, not forFeature again
  ],
})
export class CounterModule {}
