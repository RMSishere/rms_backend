/* eslint-disable @typescript-eslint/camelcase */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { APIMessage, APIMessageTypes } from 'src/common/dto';
import { PaginatedData } from 'src/common/interfaces';
import { HelpMessageDto } from 'src/helpMessage/helpMessage.dto';
import { NotificationSubscriptionFactory } from 'src/notificationSubscription/notificationSubscription.factory';
import { UserMiscInfoDto } from 'src/userMiscInfo/userMiscInfo.dto';
import {
  getDefaulAvatarUrl,
  getIntersection,
  getNearByZipCodes,
  verifyPassword,
  parseFacebookSignedRequest,
} from 'src/util';
import { getLatLongFromZipcode } from 'src/util/geo';
import { v4 as randomUUID } from 'uuid';
import * as sgMail from '@sendgrid/mail';
import { Device } from 'src/util/pushNotification';
import { sendTemplateEmail } from 'src/util/sendMail';
import { sendBulkTextMessage, twilioVerifyService } from 'src/util/twilio';
import {
  API_MESSAGES,
  MAIL_TEMPLATES,
  METERS_PER_MILE,
  NOTIFICATION_TYPES,
  paginationLimit,
  TWILIO_CHANNEL,
  USER_ROLES,
  GLOBAL_PREFIX,
} from '../config';
import { BaseFactory } from '../lib/base.factory';
import {
  BusinessProfile,
  Counter,
  HelpMessage,
  User,
  UserMiscInfo,
  ZipCodeSearch,
} from '../lib/index';
import { NotificationFactory } from '../notification/notification.factory';
import { generateToken, generateUserVerificationToken } from '../util/auth';
import { getEncryptedPassword } from '../util/index';
import { UserDto } from './users.dto';
import moment = require('moment-timezone');
import Axios from 'axios';
import { HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
const algorithm = 'aes-256-ecb';
const key = crypto.createHash('sha256').update('your_custom_secret_key').digest();
const inputEncoding = 'utf8';
const outputEncoding = 'base64';
function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(algorithm, key, null);
  let encrypted = cipher.update(text, inputEncoding, outputEncoding);
  encrypted += cipher.final(outputEncoding);
  return encrypted;
}
function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipheriv(algorithm, key, null);
  let decrypted = decipher.update(encryptedText, outputEncoding, inputEncoding);
  decrypted += decipher.final(inputEncoding);
  return decrypted;
}

@Injectable()
export class UserFactory extends BaseFactory {
  constructor(
    @InjectModel('users') public readonly usersModel: Model<User>,
    @InjectModel('counters') public readonly countersModel: Model<Counter>,
    @InjectModel('ZipCodeSearch')
    public readonly zipCodeSearchModel: Model<ZipCodeSearch>,
    @InjectModel('userMiscInfo')
    public readonly userMiscInfoModel: Model<UserMiscInfo>,
    @InjectModel('HelpMessage')
    public readonly helpMessageModel: Model<HelpMessage>,
    public notificationSubscriptionFactory: NotificationSubscriptionFactory,
    public notificationfactory: NotificationFactory,
  ) {
    super(countersModel);
  }


  async addUser(data: User): Promise<User | APIMessage> {
    try {
      console.log('Raw input data:', data);
      data.email = data.email.toLowerCase();
  
      if (data.role === USER_ROLES.ADMIN) {
        console.log('Admin role detected – throwing error');
        throw new InternalServerErrorException();
      }
  
      if (!data.termsAccepted) {
        console.log('Terms not accepted');
        return new APIMessage(
          'Please accept terms and conditions!',
          APIMessageTypes.ERROR,
        );
      }
  
      if (data.email) {
        const userExist = await this.checkUserExist({ email: data.email, role: data.role });
        console.log('Email check result:', userExist);
        if (userExist) {
          return new APIMessage(
            'User with given email & role already exists!',
            APIMessageTypes.ERROR,
          );
        }
      }
  
      if (data.phoneNumber) {
        const userExist = await this.checkUserExist({
          phoneNumber: data.phoneNumber,
          role: data.role,
        });
        console.log('Phone check result:', userExist);
        if (userExist) {
          return new APIMessage(
            'User with given phone number & role already exists!',
            APIMessageTypes.ERROR,
          );
        }
      }
  
      const plainPassword = data.password; // Save original password for external API
  
      // Call external API first
      try {
        const affiliatePayload = {
          email: data.email,
          password: plainPassword,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'member',
        };
  
        await Axios.post(
          'https://runmysale.com/wp-json/affiliate-subscription/v1/create_user',
          affiliatePayload,
          { headers: { 'Content-Type': 'application/json' } },
        );
  
        console.log('Affiliate user created successfully');
      } catch (externalErr) {
        const extData = externalErr.response?.data;
        const errorMessage = extData?.message || externalErr.message;
  
        console.error('Failed to create user on affiliate system:', extData || externalErr.message);
  
        if (
          extData?.code === 'email_exists' ||
          errorMessage?.toLowerCase()?.includes('email already exists')
        ) {
          return new APIMessage(
            'User with given email already exists on external system!',
            APIMessageTypes.ERROR,
          );
        }
  
        return new APIMessage(
          'Failed to create user on external system.',
          APIMessageTypes.ERROR,
        );
      }
  
      // Continue with local DB creation if external succeeded
      data['id'] = await this.generateSequentialId('users');
      console.log('Generated user id:', data['id']);
  
      data.createdBy = this.getCreatedBy(data);
      data.password = await getEncryptedPassword(plainPassword);
      data.passwordEncrypted = encrypt(plainPassword);
      data['avatar'] = getDefaulAvatarUrl(data.firstName, data.lastName);
  
      const newadata = await this.notificationSubscriptionFactory.getAllNotificationSubscriptions({}, data);
      console.log('Generated notificationSubscriptions:', JSON.stringify(newadata, null, 2));
  
      if (Array.isArray(newadata) && newadata.length > 0) {
        const seen = new Set<string>();
  
        const sanitized = newadata
          .filter(sub => !!sub)
          .map((sub, index) => {
            if (!sub.id) sub.id = randomUUID();
            if (!sub.title) sub.title = `user-${data.id}-title-${index + 1}`;
            if (!sub.id || seen.has(sub.id)) return null;
            seen.add(sub.id);
            return sub;
          })
          .filter(Boolean);
  
        console.log('Sanitized notificationSubscriptions count:', sanitized.length);
        data.notificationSubscriptions = sanitized;
      } else {
        delete data.notificationSubscriptions;
      }
  
      console.log('Final user data before save:', JSON.stringify(data, null, 2));
  
      const newUser = new this.usersModel(data);
      const result = await newUser.save();
      const res = new UserDto(result);
  
      if (res.role === USER_ROLES.CLIENT) {
        await this.sendWelcomeText(res);
      }
  
      res['token'] = await generateToken(result);
      return res;
    } catch (err) {
      console.error('Error during addUser:', err);
      if (err.code === 11000) {
        console.error('Duplicate key error details:', err.keyValue);
      }
      throw err;
    }
  }
  
  
  
  
  

  async loginFacebook(
    profile: any,
    accessToken: string,
    device?: Device,
  ): Promise<User> {
    try {
      let user;
      user = await this.usersModel
        .findOne({ 'facebookProvider.id': profile.id, isActive: true })
        .exec();

      if (!user) {
        // no user found then create one
        const userData = {
          firstName: profile.first_name,
          lastName: profile.last_name,
          facebookProvider: {
            id: profile.id,
            token: accessToken,
          },
          isSocialLogin: true,
        };

        userData['id'] = await this.generateSequentialId('users');
        userData['createdBy'] = userData.facebookProvider.id;

        if (profile.email) {
          const userExist = await this.checkUserExist({ email: profile.email });
          if (!userExist) {
            userData['email'] = profile.email;
            userData['isEmailVerified'] = true;
          }
        }

        if (
          profile.picture &&
          profile.picture.data &&
          profile.picture.data.url
        ) {
          userData['avatar'] = profile.picture.data.url;
        } else {
          userData['avatar'] = getDefaulAvatarUrl(
            userData.firstName,
            userData.lastName,
          );
        }

        const newUser = new this.usersModel(userData);
        user = await newUser.save();
      }

      const res = new UserDto(user);

      res['token'] = await generateToken(res);

      return res;
    } catch (err) {
      throw err;
    }
  }

  async loginApple(
      profile: any,
      accessToken: string,
  ): Promise<User> {
    try {
      let user;
      user = await this.usersModel
          .findOne({ 'appleProvider.id': profile.id, isActive: true })
          .exec();

      if (!user) {
        // no user found then create one
        const userData = {
          firstName: profile.first_name,
          lastName: profile.last_name,
          appleProvider: {
            id: profile.id,
            token: accessToken,
          },
          isSocialLogin: true,
        };

        userData['id'] = await this.generateSequentialId('users');
        userData['createdBy'] = userData.appleProvider.id;

        if (profile.email) {
          const userExist = await this.checkUserExist({ email: profile.email });
          if (!userExist) {
            userData['email'] = profile.email;
            userData['isEmailVerified'] = true;
          }
        }

        if (
            profile?.picture &&
            profile?.picture?.data &&
            profile?.picture?.data?.url
        ) {
          userData['avatar'] = profile.picture.data.url;
        } else {
          userData['avatar'] = getDefaulAvatarUrl(
              userData.firstName,
              userData.lastName,
          );
        }

        const newUser = new this.usersModel(userData);
        user = await newUser.save();
      }

      const res = new UserDto(user);

      res['token'] = await generateToken(res);

      return res;
    } catch (err) {

      throw err;
    }
  }

  async loginWithWordpress(
    profile: any,
    password: string
  ): Promise<User> {
    try {
      let user;
      user = await this.usersModel
        .findOne({ 'wordpressProvider.id': profile.user_email, isActive: true })
        .exec();

      if (!user) {
        // no user found then create one
        const userData = {
          firstName: profile.first_name,
          lastName: profile.last_name,
          wordpressProvider: {
            id: profile.user_email,
            token: profile.token,
          },
          password: await getEncryptedPassword(password),
          isSocialLogin: true,
        };

        userData['id'] = await this.generateSequentialId('users');
        userData['createdBy'] = userData.wordpressProvider.id;

        if (profile.user_email) {
          const userExist = await this.checkUserExist({ email: profile.user_email });
          if (!userExist) {
            userData['email'] = profile.user_email;
            userData['isEmailVerified'] = true;
          }
        }

        if (
          profile.picture &&
          profile.picture.data &&
          profile.picture.data.url
        ) {
          userData['avatar'] = profile.picture.data.url;
        } else {
          userData['avatar'] = getDefaulAvatarUrl(
            userData.firstName,
            userData.lastName,
          );
        }

        const newUser = new this.usersModel(userData);
        user = await newUser.save();
      }

      const res = new UserDto(user);

      // const isAffiliate = !!res.data?.user_roles?.includes('affiliate_member');

      res['token'] = await generateToken(res);

      return res;
    } catch (err) {
      throw err;
    }
  }

  async sendWelcomeText(user: User): Promise<void> {
    try {
      let message;
      if (user.role === USER_ROLES.CLIENT && user.phoneNumber) {
        message = `Hi ${user.firstName} ${user.lastName}, welcome to RunMySale! We hope you find the help you need quickly. You can book a service easily by following steps on the app. You can find answers to your questions in the FAQ section.\n\nIf you still have any questions, you can email us (help@runmysale.com).`;
      } else if (user.role === USER_ROLES.AFFILIATE && user.phoneNumber) {
        message = `Hi ${user.firstName} ${user.lastName}, we're reviewing your application and will be in touch soon to let you know if we have any further questions for you or if we can grant you access to provide services on RunMySale!`;
      }

      await this.notificationfactory.sendNotification(
        user,
        NOTIFICATION_TYPES.APP_UPDATES,
        { text: { message } },
      );
    } catch (err) {
      // discard error
      console.error(err);
    }
  }

  // import { HttpException, HttpStatus } from '@nestjs/common';

  async login(
    email: string,
    password: string,
    role?: string,
    device?: Device,
  ): Promise<User | APIMessage> {
    try {
      const query: any = {
        email: email.toLowerCase(),
      };
      if (role) {
        query.role = role;
      }
      const user = await this.usersModel.findOne(query).exec();
      let isPasswordCorrect = false;
      if (user) {
        isPasswordCorrect = await verifyPassword(password, user.password);
      }
  
      if (user && isPasswordCorrect) {
        const newUser = new UserDto(user);
        // check if user logged in with new device
        if (
          device &&
          !newUser.devices.map(dt => dt.token).includes(device.token)
        ) {
          // if yes then store new device info
          const newDevices = newUser.devices.concat([device]);
          const condition = { id: user.id, isActive: true };
          const newValue = { $set: { devices: newDevices } };
          await this.usersModel.updateOne(condition, newValue);
        }
  
        newUser['token'] = await generateToken(user);
        return newUser;
      }
  
      // check if wordpress user
      try {
        const res = await Axios.post(process.env.WP_LOGIN_URL, {
          username: email,
          password
        });
  
        if (res.data?.token) {
          const wpData = res.data;
          return await this.loginWithWordpress(wpData, password);
        }
      } catch (error) {
        if (error?.response?.data?.data?.status === 403) {
          throw new HttpException(
            new APIMessage('Invalid Credentials!', APIMessageTypes.ERROR),
            HttpStatus.UNAUTHORIZED
          );
        }
        throw error;
      }
  
      throw new HttpException(
        new APIMessage('Invalid Credentials!', APIMessageTypes.ERROR),
        HttpStatus.UNAUTHORIZED
      );
    } catch (err) {
      throw err;
    }
  }
  

  async getUserProfile(id: string): Promise<User> {
    try {
      // TODO: remove personal info from profile data
      const user = await this.usersModel.findOne({ id }).exec();
      const res = new UserDto(user);

      return res;
    } catch (err) {
      throw err;
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.usersModel.findOne({ id }).exec();
      if (!user) {
        return null;
      }

      const res = new UserDto(user);

      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAdmin(): Promise<User> {
    const user = await this.usersModel
      .findOne({ role: USER_ROLES.ADMIN })
      .exec();
    if (!user) {
      return null;
    }

    const res = new UserDto(user);
    return res;
  }

  async checkPhoneNumber(phoneNumber: string): Promise<APIMessage> {
    try {
      const user = await this.usersModel
        .findOne({ phoneNumber, isActive: true })
        .exec();

      if (user) {
        return new APIMessage('User exist!', APIMessageTypes.SUCCESS);
      } else {
        return new APIMessage(
          'User with given phone number does not exist!',
          APIMessageTypes.ERROR,
        );
      }
    } catch (err) {
      throw err;
    }
  }
  async requestVerificationCode(to: string, channel: string): Promise<any> {
    try {
      if (!to || !channel) {
        throw new BadRequestException('Invalid Data');
      }
  
      if (channel === 'email') {
        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
        // Set SendGrid API Key
        sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
  
        const msg = {
          to,
          from: 'info@thebrandshub.ae', // Replace with your verified sender
          subject: 'Your Verification Code',
          text: `Your verification code is ${otp}`,
          html: `<strong>Your verification code is ${otp}</strong>`,
        };
  
        await sgMail.send(msg);
  
        console.log(`OTP sent to ${to} via email: ${otp}`);
  
        // Return OTP if you need to store it in DB or for testing
        return { otp, channel: 'email', to };
      } else {
        // Default Twilio channel
        const res = await twilioVerifyService.verifications.create({
          to,
          channel,
        });
  
        console.log(`OTP sent to ${to} via ${channel}: ${res.sid}`);
        return res;
      }
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }
  

  async verifyVerificationCode(to: string, code: string , role: string): Promise<any> {
    console.log('verifyVerificationCode input ==>', to, code , role)
    try {
      if (to && code) {
        const res = await twilioVerifyService.verificationChecks.create({
          to,
          code,
        });

        if (!res || !Object.values(TWILIO_CHANNEL).includes(res.channel)) {
          throw new InternalServerErrorException(API_MESSAGES.SERVER_ERROR);
        }

        if (res.status === 'approved') {
          if (
            res.channel === TWILIO_CHANNEL.SMS ||
            res.channel === TWILIO_CHANNEL.CALL
          ) {
            const query: any = {
              phoneNumber: to 
            };
            
            if (role) {
              query.role = role;
              // Optionally, you can add the condition isSocialLogin: false here
            }
            const user = await this.usersModel
              .findOne(query)
              .exec();
            console.log('verifyVerificationCode user ==>', user)  
            if (user) {
              const token = await generateUserVerificationToken(user);
              return { token };
            } else {
              throw new UnauthorizedException();
            }
          } else if (res.channel === TWILIO_CHANNEL.EMAIL) {
            const user = await this.usersModel.findOne({ email: to }).exec();
            if (user) {
              const token = await generateUserVerificationToken(user);
              return { token };
            } else {
              throw new UnauthorizedException();
            }
          }
        } else {
          return res;
        }
      } else {
        throw new BadRequestException('Invalid Data');
      }
    } catch (err) {
      throw err;
    }
  }

  async updateUserData(
    dataToUpdate: User | any,
    user: User,
  ): Promise<User | APIMessage> {
    try {
      delete dataToUpdate['role'];
      const sensitiveFields = ['password', 'isMobileVerfied', 'isEmailVerified'];
  
      if (!dataToUpdate) throw new BadRequestException('Invalid Data');
  
      const condition = { id: user.id, isActive: true };
  
      const hasSensitiveFields = getIntersection(Object.keys(dataToUpdate), sensitiveFields).length > 0;
  
      if (hasSensitiveFields) {
        if (!user || !user.isUserVerified) {
          throw new UnauthorizedException('Unverified user cannot update sensitive data');
        }
  
        // Handle password change
        if (dataToUpdate['password']) {
          const plainNewPassword = dataToUpdate['password'];
  
          // Encrypt and update local password
          dataToUpdate['password'] = await getEncryptedPassword(plainNewPassword);
  
          try {
            // Fetch user with passwordEncrypted
            const dbUser = await this.usersModel.findById(user.id).select('email passwordEncrypted');
            if (!dbUser) throw new Error('User not found in DB for WP password update');
  
            const plainOldPassword = decrypt(dbUser.passwordEncrypted);
  
            // Login to WordPress with old password
            const wpLoginResponse = await Axios.post(
              'https://runmysale.com/wp-json/affiliate-subscription/v1/login',
              {
                username: dbUser.email,
                password: plainOldPassword,
              }
            );
  
            if (!wpLoginResponse.data || !wpLoginResponse.data.token) {
              throw new Error('Failed to login to WordPress to update password');
            }
  
            const wpToken = wpLoginResponse.data.token;
  
            // Update password on WordPress
            const wpUpdateResponse = await axios.post(
              'https://runmysale.com/wp-json/affiliate-subscription/v1/update_profile',
              {
                token: wpToken,
                password: plainNewPassword,
              }
            );
  
            if (!wpUpdateResponse.data || wpUpdateResponse.data.success === false) {
              throw new Error('Failed to update password on WordPress');
            }
          } catch (wpErr) {
            throw new Error(`WordPress password update error: ${wpErr.message}`);
          }
        }
  
        // Update local user
        const newValue = { $set: { ...dataToUpdate } };
        const updatedUser = await this.usersModel.findOneAndUpdate(condition, newValue, { new: true });
  
        const res = new UserDto(updatedUser);
        res['token'] = await generateToken(updatedUser);
        return res;
      } else {
        // Handle general data updates
        if (dataToUpdate.email && dataToUpdate.email !== user.email) {
          const userExist = await this.checkUserExist({ email: dataToUpdate.email });
          if (userExist) {
            return new APIMessage('User with given email already exists!', APIMessageTypes.ERROR);
          }
        }
  
        if (dataToUpdate.phoneNumber && dataToUpdate.phoneNumber !== user.phoneNumber) {
          dataToUpdate.isMobileVerfied = false;
          const userExist = await this.checkUserExist({ phoneNumber: dataToUpdate.phoneNumber });
          if (userExist) {
            return new APIMessage('User with given phone number already exists!', APIMessageTypes.ERROR);
          }
        }
  
        const newValue = { $set: { ...dataToUpdate } };
        const updatedUser = await this.usersModel.findOneAndUpdate(condition, newValue, { new: true });
  
        const res = new UserDto(updatedUser);
  
        if (dataToUpdate['completingSignUp'] && updatedUser.role === USER_ROLES.CLIENT) {
          await this.sendWelcomeText(updatedUser);
        }
  
        res['token'] = await generateToken(updatedUser);
        return res;
      }
    } catch (err) {
      throw err;
    }
  }
  

  async updateSocialLoginData(
    dataToUpdate: User | any,
    user: User,
  ): Promise<User | APIMessage> {
    try {
      const condition = { id: user.id };
      dataToUpdate.isActive = true;

      if (dataToUpdate.role === USER_ROLES.ADMIN) {
        throw new InternalServerErrorException();
      }
      // if updating email
      if (dataToUpdate.email && dataToUpdate.email !== user.email) {
        const userExist = await this.checkUserExist({
          email: dataToUpdate.email,
        });
        if (userExist) {
          return new APIMessage(
            'User with given email already exists!',
            APIMessageTypes.ERROR,
          );
        }
      }

      // if updating phone number
      if (
        dataToUpdate.phoneNumber &&
        dataToUpdate.phoneNumber !== user.phoneNumber
      ) {
        dataToUpdate.isMobileVerfied = false; // mark unverified new number
        const userExist = await this.checkUserExist({
          phoneNumber: dataToUpdate.phoneNumber,
        });
        if (userExist) {
          return new APIMessage(
            'User with given phone number already exists!',
            APIMessageTypes.ERROR,
          );
        }
      }
      const newValue = { $set: { ...dataToUpdate } };
      const updatedUser = await this.usersModel.findOneAndUpdate(
        condition,
        newValue,
        { new: true },
      );

      const res = new UserDto(updatedUser);
      if (
        dataToUpdate['completingSignUp'] &&
        updatedUser.role === USER_ROLES.CLIENT
      ) {
        await this.sendWelcomeText(updatedUser);
      }

      res['token'] = await generateToken(updatedUser);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async checkUserExist(filter: any): Promise<boolean> {
    console.log(filter,'filter');
    const usersCount = await this.usersModel.countDocuments(filter);
    const user = await this.usersModel.findOne(filter);
    console.log(usersCount,user,'dataaaa');
    if (usersCount) {
      return true;
    } else {
      return false;
    }
  }

  async addUserMiscInfo(data: UserMiscInfo, user: User): Promise<UserMiscInfo> {
    try {
      data['id'] = await this.generateSequentialId('users');
      data['user'] = user;
      data.createdBy = this.getCreatedBy(user);

      const newMiscInfo = new this.userMiscInfoModel(data);
      const res = await newMiscInfo.save();

      const condition = { id: user.id, isActive: true };
      const newValue = { $set: { addedMiscInfo: true } };
      await this.usersModel.updateOne(condition, newValue);

      const result = new UserMiscInfoDto(res);

      return result;
    } catch (err) {
      throw err;
    }
  }

  async addHelpMessage(data: HelpMessage, user: User): Promise<HelpMessage> {
    try {
      data['id'] = await this.generateSequentialId('HelpMessage');
      data['user'] = user;
      data.createdBy = this.getCreatedBy(user);

      const newHelpMessage = new this.helpMessageModel(data);
      let res = await newHelpMessage.save();
      res = await res.populate('user').execPopulate();
      const helpMessage = new HelpMessageDto(res);

      const admin = await this.getAdmin();

      if (admin && admin.email) {
        sendTemplateEmail(admin.email, MAIL_TEMPLATES.HELP_MESSAGE, {
          message: helpMessage.message,
          user: helpMessage.user,
        });
      }

      return helpMessage;
    } catch (err) {
      throw err;
    }
  }
  async deleteAffiliateProfileById(id: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid affiliate ID');
      }
  
      // Try deleting the affiliate by _id
      const result = await this.usersModel.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
  
      if (result.deletedCount === 0) {
        throw new BadRequestException('Affiliate not found or already deleted');
      }
  
      return {
        success: true,
        message: 'Affiliate profile deleted successfully',
      };
    } catch (err) {
      console.error('[deleteAffiliateProfileById] Error:', err);
      throw err;
    }
  }
  
  
  async sendTextMessage(data: any): Promise<any> {
    try {
      const userss = await this.usersModel.find();
      console.log(userss,'usersss');
      let res = { error: 'No user found' };
      const commonFilter = {
        isActive: true,
        // TODO: check if this filter is working properly
        // notificationSubscriptions: {
        //   $elemMatch: {
        //     title: data.notificationSubscription, // if user is subscribed to recieve notification for the category
        //     // notificationChannels: NOTIFICATION_CHANNELS.SMS
        //   },
        // },
      };

      if (data.isBulk) {
        const filter: any = { ...commonFilter };
        let customers: User[] = [];
        let affiliates: User[] = [];

        if (data.toCustomers) {
          const customersFilter = { ...filter, role: USER_ROLES.CLIENT };
          if (data.zipCode) {
            customersFilter['zipCode'] = data.zipCode;
          }
          customers = await this.usersModel.find(customersFilter, {
            _id: 0,
            phoneNumber: 1,
          });
        }

        if (data.toAffiliates) {
          const customersFilter = {
            ...filter,
            role: USER_ROLES.AFFILIATE,
            'businessProfile.isApproved': true,
          };
          if (data.zipCode) {
            customersFilter['businessProfile.nearByZipCodes'] = data.zipCode;
          }
          affiliates = await this.usersModel.find(customersFilter, {
            _id: 0,
            phoneNumber: 1,
          });
        }

        const numbers = customers.concat(affiliates).map(dt => dt.phoneNumber);
        if (numbers.length) {
          res = await sendBulkTextMessage(data.message, numbers);
        }
      } else if (data.phoneNumber) {

        const user: User = await this.usersModel.findOne(
          {
            ...commonFilter,
            phoneNumber: data.phoneNumber,
          },
          { _id: 0, phoneNumber: 1 },
        );
console.log(user,'userrr');
        if (user.phoneNumber) {
          res = await sendBulkTextMessage(data.message, [user.phoneNumber]);
        }
      }

      return res;
    } catch (err) {
      throw err;
    }
  }

  async getApprovedAffiliate(condition: any): Promise<User> {
    try {
      const filter: any = {
        role: USER_ROLES.AFFILIATE,
        'businessProfile.isApproved': true,
        ...condition,
      };

      const affiliate: User = await this.usersModel.findOne(filter);

      return affiliate;
    } catch (err) {
      throw err;
    }
  }
  async getApprovedAffiliates(condition?: any): Promise<User[]> {
    try {
      const filter: any = {
        role: USER_ROLES.AFFILIATE,
        'businessProfile.isApproved': true,
        ...condition,
      };

      const affiliates: User[] = await this.usersModel.find(filter);

      return affiliates;
    } catch (err) {
      throw err;
    }
  }
  async createBusinessProfile(
    data: BusinessProfile,
    user: User,
  ): Promise<User | APIMessage> {
    try {
      if (!data.termsAccepted) {
        return new APIMessage(
          'Please accept terms and conditions!',
          APIMessageTypes.ERROR,
        );
      }

      if (
        data.serviceCoverageRadius > 0 &&
        data.areaServices &&
        data.areaServices.length
      ) {
        const res = await this.getAreaServiceAndNearByZipCodes(
          data.areaServices,
          data.serviceCoverageRadius,
        );
        data.areaServices = res.areaServices;
        data.nearByZipCodes = res.nearByZipCodes;
      }
console.log(user);
      const updatedUser = await this.updateUserData(
        { businessProfile: data },
        user,
      ) as User;

      if (updatedUser?._id) {
        await this.sendWelcomeText(updatedUser);
      }

      return updatedUser;
    } catch (err) {
      throw err;
    }
  }
  async updateBusinessProfile(
    data: BusinessProfile,
    user: User,
  ): Promise<User | APIMessage> {
    try {
      data.updatedBy = this.getUpdatedBy(user);

      if (
        data.serviceCoverageRadius &&
        data.serviceCoverageRadius > 0 &&
        data.areaServices &&
        data.areaServices.length
      ) {
        const res = await this.getAreaServiceAndNearByZipCodes(
          data.areaServices,
          data.serviceCoverageRadius,
        );
        data.areaServices = res.areaServices;
        data.nearByZipCodes = res.nearByZipCodes;
      }

      const dataToUpdate = {};

      Object.keys(data).map(key => {
        dataToUpdate[`businessProfile.${key}`] = data[key];
      });

      const updateUser = await this.updateUserData(dataToUpdate, user);

      return updateUser;
    } catch (err) {
      throw err;
    }
  }
  async approveBusinessProfile(id: string, user: User): Promise<User> {
    try {
      const filter = { id };
      const newValue = {
        'businessProfile.isApproved': true,
        'businessProfile.approvedDate': new Date(),
        'businessProfile.updatedBy': this.getUpdatedBy(user),
      };

      const updatedUser = await this.usersModel.findOneAndUpdate(
        filter,
        newValue,
        { new: true },
      );
      const res = new UserDto(updatedUser);

      return res;
    } catch (err) {
      throw err;
    }
  }
  async approveBusinessProfile2(phoneNumber: string, adminUser: User): Promise<User> {
    try {
      const existingUser = await this.usersModel.findOne({ phoneNumber });
  
      if (!existingUser || !existingUser.businessProfile) {
        throw new Error('User or business profile not found');
      }
  
      const approvedProfile = {
        ...existingUser.businessProfile,
        isApproved: true,
        approvedDate: new Date(),
        updatedBy: this.getUpdatedBy(adminUser),
      };
  
      const updatedUser = await this.usersModel.findOneAndUpdate(
        { phoneNumber },
        { $set: { businessProfile: approvedProfile } },
        { new: true },
      );
  
      return new UserDto(updatedUser);
    } catch (err) {
      throw err;
    }
  }
// adjust import as needed
  
async approveBusinessProfileByIdOnly(id: string): Promise<{ success: boolean; data?: UserDto; error?: string }> {
  try {
    // 1. Find the user first to get username & password for wordpress login
    const user = await this.usersModel.findById(id).select('email passwordEncrypted');
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const plainPassword = decrypt(user.passwordEncrypted);

    // 2. Login to WordPress API
    const wpLoginResponse = await Axios.post("https://runmysale.com/wp-json/affiliate-subscription/v1/login", {
      username: user.email,
      password: plainPassword
    });
    console.log("hello",wpLoginResponse);
// console.log(wpLoginResponse);
if (!wpLoginResponse.data || !wpLoginResponse.data.token) {
  return { success: false, error: 'WordPress login failed - token missing' };
}

    const wpToken = wpLoginResponse.data.token;
console.log(wpToken,'dsdsas');
    // 3. Update profile on WordPress
    const wpUpdateResponse = await axios.post(
      'https://runmysale.com/wp-json/affiliate-subscription/v1/update_profile',
      {
        token: wpToken,
        role: 'affiliate_member',
      }
    );

    if (!wpUpdateResponse.data.success) {
      return { success: false, error: 'WordPress profile update failed' };
    }

    // 4. Update user in our database
    const updatedUser = await this.usersModel.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          'businessProfile.isApproved': true,
          'businessProfile.approvedDate': new Date(),
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return { success: false, error: 'Failed to update user in DB' };
    }

    return { success: true, data: new UserDto(updatedUser) };
  } catch (err) {
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}

  
  
  async getAreaServiceAndNearByZipCodes(
    areaServices: Array<{ zipCode: string }>,
    serviceCoverage: number,
  ): Promise<{ areaServices: any[]; nearByZipCodes: string[] }> {
    try {
      console.log('[AreaService] Input:', areaServices, 'Coverage:', serviceCoverage);
      
      let nearByZipCodes = [];
      const areaServicesTransformed = [];
  
      for (let i = 0; i < areaServices.length; i++) {
        const area = areaServices[i];
        const { lat, lng } = await getLatLongFromZipcode(area.zipCode);
  
        areaServicesTransformed.push({
          zipCode: area.zipCode,
          lat,
          lng,
        });
  
        const zipCodes = await getNearByZipCodes(
          area.zipCode,
          serviceCoverage * METERS_PER_MILE,
        );
        nearByZipCodes = nearByZipCodes.concat(zipCodes);
      }
  
      console.log('[AreaService] Final Result:', {
        areaServices: areaServicesTransformed,
        nearByZipCodes,
      });
  
      return { areaServices: areaServicesTransformed, nearByZipCodes };
    } catch (err) {
      console.error('[AreaService] Error:', err);
      throw err;
    }
  }
  async getAffiliatesByZip(zipCode: string, user: User): Promise<User[]> {
    try {
      // get all affiliates whose nearby zipcodes contains the give zipcode
      const res = await this.getApprovedAffiliates({
        'businessProfile.nearByZipCodes': zipCode,
      });
      const affiliates = res.map(res => new UserDto(res));
      

      if (affiliates?.length === 0) {
        const admin = await this.getAdmin();

        if (admin && admin.email) {
          // send app notification to affiliates
          const title = `Needs Affiliate in zip code ${zipCode}`;
          const description = `A user searched affiliates in zip code ${zipCode}`;

          this.notificationfactory
            .sendNotification(admin, NOTIFICATION_TYPES.APP_UPDATES, {
              inApp: {
                message: { title, description },
              },
            })
            .catch(() => null); // discard error
        }
      }

      await this.zipCodeSearchModel.updateOne(
        { zipCode },
        {
          zipCode,
          affiliatesCount: affiliates.length,
          $inc: { searchCount: 1 },
          $addToSet: { users: user._id }
        },
        { upsert: true },
      );

      return affiliates;
    } catch (err) {
      throw err;
    }
  }
  async getAllCustomers(params: any): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const filter = { isActive: true, role: USER_ROLES.CLIENT };

    try {
      if (params.onDate) {
        filter['createdAt'] = {
          $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
          $lt: moment(params.onDate, 'YYYY-MM-DD')
            .add(1, 'day')
            .toISOString(),
        };
      }

      if (params.zipCode) {
        filter['zipCode'] = params.zipCode;
      }

      const count = await this.usersModel.countDocuments(filter);

      const users = await this.usersModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .sort({ createdAt: 'desc' });

      const result = users.map(res => new UserDto(res));

      const res = { result, count, skip };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async getAllAffiliates(params: any): Promise<PaginatedData> {
    const skip = parseInt(params.skip) || 0;
    const filter = { isActive: true, role: USER_ROLES.AFFILIATE };

    try {
      if (params.onDate) {
        filter['createdAt'] = {
          $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
          $lt: moment(params.onDate, 'YYYY-MM-DD')
            .add(1, 'day')
            .toISOString(),
        };
      }

      if (params.zipCode) {
        filter['businessProfile.nearByZipCodes'] = params.zipCode;
      }

      const count = await this.usersModel.countDocuments(filter);

      const users = await this.usersModel
        .find(filter)
        .skip(skip)
        .limit(paginationLimit)
        .sort({ createdAt: 'desc' });

      const result = users.map(res => new UserDto(res));

      const res = { result, count, skip };

      return res;
    } catch (error) {
      throw error;
    }
  }

  async blockUser(
    userId: string,
    block = true,
    user: User,
  ): Promise<User | APIMessage> {
    try {
      if (userId) {

        console.log({
          [block ? '$addToSet' : '$pull']: { blockedUsers: userId },
        });
        const condition = { id: user.id, isActive: true };
        const updatedUser = await this.usersModel.findOneAndUpdate(
          condition,
          { [block ? '$addToSet' : '$pull']: { blockedUsers: userId } },
          { new: true },
        );
        const res = new UserDto(updatedUser);
        res['token'] = await generateToken(res);

        return res;
      } else {
        throw new BadRequestException('Invalid Data');
      }
    } catch (err) {
      throw err;
    }
  }

  async reportUser(
    reportingUserId: string,
    reportData: any,
    user: User,
  ): Promise<void> {
    try {
      if (reportData) {
        const admin = await this.getAdmin();
        const reportedUser = await this.getUserById(reportingUserId);
        if (admin && admin.email) {
          await sendTemplateEmail(admin.email, MAIL_TEMPLATES.REPORT_USER, {
            reportingUser: user,
            reportedUser,
            message: reportData.message,
          });
        }
      } else {
        throw new BadRequestException('Invalid Data');
      }
    } catch (err) {
      throw err;
    }
  }

  async removeFacebookUser(signedRequest: any): Promise<any> {
    try {
      const data = parseFacebookSignedRequest(
        signedRequest,
        process.env.FACEBOOK_SECRET,
      );
      const userId = data.user_id;
      const updatedUser = await this.usersModel.findOneAndUpdate(
        { 'facebookProvider.id': userId },
        {
          $set: {
            deletedAt: new Date(),
            facebookProvider: null,
            isActive: false,
          },
        },
        { new: true },
      );

      const user = new UserDto(updatedUser);
      return {
        url: `${process.env.SERVER_HOST}/${GLOBAL_PREFIX}/auth/facebook/deletion?userId=${user.id}`,
        confirmation_code: user.id.toString(),
      };
    } catch (err) {
      throw err;
    }
  }

  async getOwnUserData(user: User): Promise<User> {
    try {
      const userData = await this.usersModel.findOne({ _id: user._id }).exec();
      const res = new UserDto(userData);
      res['token'] = await generateToken(res);
      return res;
    } catch (err) {
      throw err;
    }
  }
}
