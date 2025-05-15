import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { zipCodeSearchSchema } from './zipCodeSearch.schema';
import { ZipCodeSearchFactory } from './zipCodeSearch.factory';
import { ZipCodeSearchController } from './zipCodeSearch.controller';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ZipCodeSearch', schema: zipCodeSearchSchema },
    ]),
  ],
  controllers: [ZipCodeSearchController],
  providers: [ZipCodeSearchFactory],
  exports: [
    MongooseModule.forFeature([
      { name: 'ZipCodeSearch', schema: zipCodeSearchSchema },
    ]),
    ZipCodeSearchFactory,
  ],
})
export class ZipCodeSearchModule {}
