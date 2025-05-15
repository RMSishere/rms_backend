import { Body, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZipCodeSearchDto } from './zipCodeSearch.dto';
import { ZipCodeSearchFactory } from './zipCodeSearch.factory';
import { Roles } from 'src/common/decorators/roles.decorator';
import { USER_ROLES } from 'src/config';

@UseGuards(RolesGuard)
@Controller('zipCodeSearch')
export class ZipCodeSearchController {
  constructor(public readonly zipCodeSearchFactory: ZipCodeSearchFactory) {}

  @Roles(USER_ROLES.ADMIN)
  @Get()
  async getAllZipCodeSearch(@Query() params) {
    return this.zipCodeSearchFactory.getAllZipCodeSearch(params);
  }
}
