import { Controller, Get, Param, Post, Body, Put, Req, UseGuards } from '@nestjs/common';
import { ZipCodeFactory } from './zipCode.factory';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { USER_ROLES } from 'src/config';
import { ZipCode } from 'src/lib';

@UseGuards(RolesGuard)
@Controller('zipCode')
export class ZipCodeController {
  constructor(public readonly zipCodeFactory: ZipCodeFactory) { }
  @Get(':zipCode')
  async getZipCode(
    @Param('zipCode') zipCode: string,
  ) {
    return this.zipCodeFactory.getZipCode(
      zipCode,
    );
  }

  @Roles(USER_ROLES.ADMIN)
  @Post()
  async crateZipCode(
    @Body() data: ZipCode,
    @Req() req,
  ) {
    return this.zipCodeFactory.createZipCode(
      data,
      req.user
    );
  }

  @Roles(USER_ROLES.ADMIN)
  @Put(':id')
  async updateZipCodeData(
    @Param('id') id: string,
    @Body() data: ZipCode,
    @Req() req,
  ) {
    return this.zipCodeFactory.updateZipCodeData(
      id,
      data,
      req.user
    );
  }
}