import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  Render,
} from '@nestjs/common';
import {
  User,
} from '../lib/index';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { USER_ROLES } from 'src/config';
import { Device } from 'src/util/pushNotification';
import { HelpMessage, UserMiscInfo } from '../lib/index';
import { UserDto } from './users.dto';
import { UserFactory } from './users.factory';
import { getfullName } from 'src/util';
import moment = require('moment');
import appleSigninAuth from 'apple-signin-auth';
import jwt_decode from "jwt-decode";
import { BadRequestException } from '@nestjs/common';
import { usersSchema } from './users.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@UseGuards(RolesGuard)
@Controller('auth')
export class UserController {
  constructor(public readonly userFactory: UserFactory,@InjectModel('users') private readonly usersSchema: Model<User>) {
    
  }

  @Post('register')
  async addUser(@Body() data: UserDto) {
    return this.userFactory.addUser(data);
  }

  @Post('facebook/removeUser')
  async removeFacebookUser(@Body('signed_request') signedRequest: any) {
    return this.userFactory.removeFacebookUser(signedRequest);
  }

  @Post('facebook')
  async loginFacebook(
    @Body('profile') profile: any,
    @Body('accessToken') accessToken: string,
  ) {
    return this.userFactory.loginFacebook(profile, accessToken);
  }

  @Post('apple')
  async loginApple(
      @Body('profile') profile: any,
      @Body('accessToken') accessToken: string,
  ) {

    const identityTokenDecode = jwt_decode(accessToken);
    return this.userFactory.loginApple(profile, accessToken);
  }

  @Get('facebook/deletion')
  @Render('facebookDeletion')
  async getFacebookDeletionStatus(@Query('userId') id: string) {
    const user = await this.userFactory.getUserById(id);
    if (!user) {
      return { name: '' };
    }

    return {
      name: getfullName(user),
      deletedAt: moment(user.deletedAt).format('LLL'),
      deleted: user.isSocialLogin && user.facebookProvider === null,
    };
  }
  @Put('use-custom-video')
  async useCustomVideo(@Req() req) {
    const user = req.user;
    const newCount = (user.subscription.customVideosUsed || 0) + 1;
  
    await this.usersSchema.updateOne(
      { id: user.id },
      { $set: { 'subscription.customVideosUsed': newCount } }
    );
  
    return { success: true };
  }
  
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('role') role?: string,
    @Body('device') device?: Device,
  ) {
    return this.userFactory.login(email, password, role, device);
  }

  @Put('update')
  async updateUserData(@Body() data, @Req() req) {
    return this.userFactory.updateUserData(data, req.user);
  }

  @Put('socialLogin')
  async updateSocialLoginData(@Body() data, @Req() req) {
    return this.userFactory.updateSocialLoginData(data, req.user);
  }

  @Put('block')
  async blockUser(
    @Body('userId') userId: string,
    @Body('block') block: boolean,
    @Req() req,
  ) {
    return this.userFactory.blockUser(userId, block, req.user);
  }

  @Post('businessProfile')
  async createBusinessProfile(@Req() req, @Body() data) {
    return this.userFactory.createBusinessProfile(data, req.user);
  }

  @Post('reportUser/:reportingUserId')
  async reportUser(
    @Param('reportingUserId') reportingUserId: string,
    @Req() req,
    @Body() data,
  ) {
    return this.userFactory.reportUser(reportingUserId, data, req.user);
  }

  @Put('businessProfile')
  async updateBusinessProfile(@Req() req, @Body() data) {
    return this.userFactory.updateBusinessProfile(data, req.user);
  }

  @Post('checkPhoneNumber')
  async checkPhoneNumber(@Req() req, @Body('phoneNumber') phoneNumber: string) {
    return this.userFactory.checkPhoneNumber(phoneNumber);
  }

  @Post('verificationCode/request')
  async requestVerificationCode(
    @Body('to') to: string,
    @Body('channel') channel: string,
  ) {
 
    
    return this.userFactory.requestVerificationCode(to, channel);
  }

  @Post('verificationCode/verify')
  async verifyVerificationCode(
    @Body('to') to: string,
    @Body('code') code: string,
    @Body('role') role: string,
  ) {
    return this.userFactory.verifyVerificationCode(to, code, role);
  }

  @Post('miscInfo')
  async addUserMiscInfo(@Req() req, @Body() data: UserMiscInfo) {
    return this.userFactory.addUserMiscInfo(data, req.user);
  }

  @Post('helpMessage')
  async addHelpMessage(@Req() req, @Body() data: HelpMessage) {
    return this.userFactory.addHelpMessage(data, req.user);
  }

  // @Roles(USER_ROLES.ADMIN)
  @Post('sendText')
  async sendTextMessage(@Req() req, @Body() data: any) {
    // console.log(data);
    return this.userFactory.sendTextMessage(data);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('customer')
  async getAllCustomers(@Query() params: any) {
    return this.userFactory.getAllCustomers(params);
  }

  // @Roles(USER_ROLES.ADMIN)
  @Get('affiliate')
  async getAllAffiliates(@Query() params: any) {
    return this.userFactory.getAllAffiliates(params);
  }

  // @Roles(USER_ROLES.ADMIN)
  @Put('affiliate/:id/approveProfile')
  async approveBusinessProfile(@Param('id') id: string, @Req() req) {
    return this.userFactory.approveBusinessProfileByIdOnly(id);
  }

  @Roles(USER_ROLES.ADMIN)
  @Get('user/:id')
  async getUserById(@Param('id') id: string) {
    return this.userFactory.getUserById(id);
  }

  @Get(':id/profile')
  async getUserProfile(@Param('id') id: string) {
    return this.userFactory.getUserProfile(id);
  }

  @Get('searchAffiliate/:zipCode')
  async getAffiliateByZip(@Param('zipCode') zipCode: string, @Req() req) {
    return this.userFactory.getAffiliatesByZip(zipCode, req.user);
  }
  @Put('use-pricing-credit')
  async usePricingCredit(@Req() req) {
    const user = req.user;
    const newCount = (user.subscription.pricingRequestsUsed || 0) + 1;
  
    await this.usersSchema.updateOne(
      { id: user.id },
      { $set: { 'subscription.pricingRequestsUsed': newCount } }
    );
  
    return { success: true };
  }
  
  @Get('ownUserData')
  async getOwnUserData(@Req() req) {
    return this.userFactory.getOwnUserData(req.user);
  }
  @Post('approveBusiness')
  async approveBusiness(@Req() req, @Body() body: { phoneNumber: string }) {
    const { phoneNumber } = body;
    if (!phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }
  
    return this.userFactory.approveBusinessProfile2(phoneNumber, req.user);
  }
}
