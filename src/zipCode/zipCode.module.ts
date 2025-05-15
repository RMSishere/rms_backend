import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ZipCodeController } from './zipCode.controller';
import { ZipCodeFactory } from './zipCode.factory';
import { zipCodeSchema } from './zipCode.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'ZipCode', schema: zipCodeSchema }]),
  ],
  exports: [
    MongooseModule.forFeature([{ name: 'ZipCode', schema: zipCodeSchema }]),
    ZipCodeFactory,
  ],
  controllers: [ZipCodeController],
  providers: [ZipCodeFactory],
})
export class ZipCodeModule {}
