import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello() {
    return this.appService.getHello();
  }

  @Get('/signedUrl')
  async getSignedUploadUrl(
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    return await this.appService.getSignedUploadUrl(fileName, fileType);
  }
}
