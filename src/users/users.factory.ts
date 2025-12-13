/* eslint-disable @typescript-eslint/camelcase */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Model } from 'mongoose';
import { APIMessage, APIMessageTypes } from 'src/common/dto';
import { GHL_PIPELINES, GHL_STAGES } from '../ghl/ghl.mapper';
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
import sgMail from '@sendgrid/mail';
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
import { sendPushNotificationToUser } from 'src/util/notification.util';
import {GHLService} from '../ghl/ghl.service';
import * as crypto from 'crypto';
import { error } from 'console';
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
const algorithm = 'aes-256-ecb';
const key = crypto.createHash('sha256').update('your_custom_secret_key').digest();
const inputEncoding = 'utf8';
const emailOtpStore: Map<string, { otp: string; expiresAt: number }> = new Map();
const outputEncoding = 'base64';
const isE164 = (s: string) => /^\+[1-9]\d{7,14}$/.test(s || '');

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
  getUserByIdOrEmail(email: string) {
    throw new Error('Method not implemented.');
  }
constructor(
  @InjectModel('users') public readonly usersModel: Model<User>,
  @InjectModel('counters') public readonly countersModel: Model<Counter>,
  @InjectModel('ZipCodeSearch') public readonly zipCodeSearchModel: Model<ZipCodeSearch>,
  @InjectModel('userMiscInfo') public readonly userMiscInfoModel: Model<UserMiscInfo>,
  @InjectModel('HelpMessage') public readonly helpMessageModel: Model<HelpMessage>,
  public notificationSubscriptionFactory: NotificationSubscriptionFactory,
  public notificationfactory: NotificationFactory,
  public readonly ghlService: GHLService,   // ← ADD THIS
) {
  super(countersModel);
}


// ======================================================
// GHL HELPERS
// ======================================================
private async syncGHLContact(user: any) {
  try {
    if (!this.ghlService) return null;

    const contactId = await this.ghlService.createOrUpdateContact(user);
    if (!contactId) return null;

    // Save ghlContactId on user (if missing)
    if (!user.ghlContactId) {
      await this.usersModel.updateOne(
        { _id: user._id },
        { $set: { ghlContactId: contactId } }
      );
    }

    return contactId;
  } catch (err) {
    console.error('❌ syncGHLContact error:', err.message);
    return null;
  }
}

// private async createGHLOpportunity(user: any, pipelineId: string, stageId: string, type: 'customer' | 'affiliate') {
//   try {
//     const contactId =
//       user.ghlContactId || (await this.syncGHLContact(user));

//     if (!contactId) return null;

//     const oppId = await this.ghlService.createOpportunity(contactId, pipelineId, stageId);

//     if (oppId) {
//       const updateField =
//         type === 'customer'
//           ? { ghlCustomerOpportunityId: oppId }
//           : { ghlAffiliateOpportunityId: oppId };

//       await this.usersModel.updateOne(
//         { _id: user._id },
//         { $set: updateField }
//       );
//     }

//     return oppId;
//   } catch (err) {
//     console.error('❌ createGHLOpportunity error:', err.message);
//   }
// }

// private async moveGHL(user: any, stageId: string, type: 'customer' | 'affiliate') {
//   try {
//     const oppId =
//       type === 'customer'
//         ? user.ghlCustomerOpportunityId
//         : user.ghlAffiliateOpportunityId;

//     if (!oppId) return;

//     await this.ghlService.moveStage(oppId, stageId);
//   } catch (err) {
//     console.error('❌ moveGHL error:', err.message);
//   }
// }

async addUser(data: User): Promise<User | APIMessage> {
  try {
    console.log('Raw input data:', data);
    data.email = data.email.toLowerCase();

    if (data.role === USER_ROLES.ADMIN) {
      console.log('Admin role detected – throwing error');
      throw new InternalServerErrorException();
    }

    if (!data.termsAccepted) {
      return new APIMessage(
        'Please accept terms and conditions!',
        APIMessageTypes.ERROR,
      );
    }

    // Check if email exists
    if (data.email) {
      const userExist = await this.checkUserExist({
        email: data.email,
        role: data.role,
      });

      if (userExist) {
        return new APIMessage(
          'User with given email & role already exists!',
          APIMessageTypes.ERROR,
        );
      }
    }

    const plainPassword = data.password;

    // Sequential ID & createdBy
    data['id'] = await this.generateSequentialId('users');
    data.createdBy = this.getCreatedBy(data);

    // Encrypt password
    data.password = await getEncryptedPassword(plainPassword);
    data.passwordEncrypted = encrypt(plainPassword);

    // Avatar
    data['avatar'] = getDefaulAvatarUrl(data.firstName, data.lastName);

    // Notification Subscriptions
    const subscriptions =
      await this.notificationSubscriptionFactory.getAllNotificationSubscriptions(
        {} ,
        data,
      );

    if (Array.isArray(subscriptions) && subscriptions.length > 0) {
      const seen = new Set<string>();
      data.notificationSubscriptions = subscriptions
        .map((sub) => {
          if (!sub?.id) sub.id = randomUUID();
          if (seen.has(sub.id)) return null;
          seen.add(sub.id);
          return sub;
        })
        .filter(Boolean);
    }

    console.log('Final user data before save:', JSON.stringify(data, null, 2));

    // Save user
    const newUserDoc = new this.usersModel(data);
    const savedUser = await newUserDoc.save();
    const res = new UserDto(savedUser);

    // Add JWT token
    res['token'] = await generateToken(savedUser);

    // =====================================================
    // 🟦 GHL SYNC — CONTACT + OPPORTUNITY + TAGS
    // =====================================================
    try {
      // 1️⃣ Create / Update Contact
      const ghlContactId = await this.ghlService.createOrUpdateContact(savedUser);

      if (ghlContactId) {
        await this.usersModel.updateOne(
          { _id: savedUser._id },
          { $set: { ghlContactId } }
        );
        savedUser.ghlContactId = ghlContactId;

        // 2️⃣ Add tags to contact
        const tagsToAdd = ['customer - new']; // You can conditionally add more tags based on role or status
        for (const tag of tagsToAdd) {
          const tagAdded = await this.ghlService.addTag(ghlContactId, tag);
          if (tagAdded) console.log(`✅ Tag "${tag}" added to GHL contact`);
        }
      }

      // 3️⃣ Check if the contact already has an existing opportunity
      let oppId = savedUser.ghlCustomerOpportunityId;
      if (!oppId) {
        // 4️⃣ If no opportunity exists, create one
        oppId = await this.ghlService.createOpportunity(
          ghlContactId,
          GHL_PIPELINES.CUSTOMERS,
          { name: `${savedUser.firstName} ${savedUser.lastName}` }
        );

        if (oppId) {
          // Move to desired stage
          await this.ghlService.moveStage(oppId, GHL_STAGES.CUSTOMERS.NEW_LEAD);

          await this.usersModel.updateOne(
            { _id: savedUser._id },
            { $set: { ghlCustomerOpportunityId: oppId } }
          );
          savedUser.ghlCustomerOpportunityId = oppId;
        }
      } else {
        console.log('⚠️ Existing opportunity found, skipping creation.');
      }

      console.log('✅ GHL Sync Completed for addUser()');
    } catch (ghlErr) {
      console.error('⚠️ GHL Sync Failed (addUser):', ghlErr?.message || ghlErr);
    }

    // =====================================================
    // PUSH NOTIFICATION
    // =====================================================
    try {
      const pushPayload = {
        title: 'Welcome to RunMySale!',
        body: `Hi ${savedUser.firstName}, your account was successfully created.`,
        data: { type: 'welcome', userId: savedUser.id.toString() },
      };

      const result = await sendPushNotificationToUser(savedUser, pushPayload, {
        quietHours: false,
      });

      console.log('📲 Push Notification Result:', result);
    } catch (err) {
      console.error('⚠️ Push Notification Failed:', err.message || err);
    }

    // =====================================================
    // Background - External Affiliate Sync (Non-Blocking)
    // =====================================================
    setImmediate(async () => {
      try {
        const affiliatePayload = {
          email: data.email,
          password: plainPassword,
          first_name: data.firstName,
          last_name: data.lastName,
          role: 'member',
          phone_number: data?.phoneNumber || '',
          zip_code: data.zipCode,
          dob:
            data.dob instanceof Date
              ? data.dob.toISOString().split('T')[0]
              : undefined,
        };

        await Axios.post(
          'https://runmysale.com/wp-json/affiliate-subscription/v1/create_user',
          affiliatePayload,
          { headers: { 'Content-Type': 'application/json' } },
        );

        console.log('✅ External user created (non-blocking)');
      } catch (externalErr) {
        const msg = externalErr.response?.data?.message || externalErr.message;
        console.error('⚠️ External user creation failed:', msg);
      }
    });

    return res;
  } catch (err) {
    console.error('Error during addUser:', err);
    if (err.code === 11000) {
      console.error('Duplicate key error details:', err.keyValue);
    }
    throw err;
  }
}








async updateUser2(data: any): Promise<User | APIMessage> {
  try {
    console.log('Raw input data (update):', data);

    if (!data.email && !data.phoneNumber) {
      return new APIMessage(
        'Email or Phone number is required to update user!',
        APIMessageTypes.ERROR,
      );
    }

    // Find the user to update
    const existingUser = await this.usersModel.findOne({
      $or: [
        { email: data.email?.toLowerCase() },
        { phoneNumber: data.phoneNumber }
      ],
    });

    if (!existingUser) {
      return new APIMessage('User not found!', APIMessageTypes.ERROR);
    }

    // Prepare updates
    const plainPassword = data.password || null;
    const updatePayload: any = { ...data };

    if (plainPassword) {
      updatePayload.password = await getEncryptedPassword(plainPassword);
      updatePayload.passwordEncrypted = encrypt(plainPassword);
    }

    // Update businessProfile if provided
    if (data.businessName || data.bio || data.services) {
      updatePayload.businessProfile = {
        businessName: data.businessName ?? existingUser.businessProfile?.businessName ?? '',
        foundingDate: data.foundingDate ?? existingUser.businessProfile?.foundingDate ?? null,
        businessImage: data.businessImage ?? existingUser.businessProfile?.businessImage ?? '',
        businessVideo: data.businessVideo ?? existingUser.businessProfile?.businessVideo ?? '',
        bio: data.bio ?? existingUser.businessProfile?.bio ?? '',
        services: Array.isArray(data.services) ? data.services : existingUser.businessProfile?.services ?? [],
        rating: existingUser.businessProfile?.rating ?? 0,
        ratingCount: existingUser.businessProfile?.ratingCount ?? 0,
        serviceCoverageRadius: data.distance ?? existingUser.businessProfile?.serviceCoverageRadius ?? 0,
        areaServices: existingUser.businessProfile?.areaServices ?? [],
        nearByZipCodes: existingUser.businessProfile?.nearByZipCodes ?? [],
        isApproved: existingUser.businessProfile?.isApproved ?? false,
        approvedDate: existingUser.businessProfile?.approvedDate ?? null,
        termsAccepted: existingUser.businessProfile?.termsAccepted ?? false,
        allowMinimumPricing: data.allowMinimumPricing ?? existingUser.businessProfile?.allowMinimumPricing ?? false,
        questionAnswers: [
          { question: 'What is your age?', answer: data.q1_age ?? '' },
          { question: 'Do you have selling experience?', answer: data.q2_selling_exp ?? '' },
          { question: 'How long have you been in business?', answer: data.q3_business_exp ?? '' },
          { question: 'Are you honest?', answer: data.q4_honest ?? '' },
          { question: 'How is your work ethic?', answer: data.q5_work_ethic ?? '' },
          { question: 'Any criminal history?', answer: data.q6_criminal_history ?? '' },
          { question: 'What makes you fun to work with?', answer: data.q7_fun ?? '' },
        ].filter(q => q.answer !== undefined),
      };
    }

    // Remove fields not needed in DB
    [
      'businessName', 'foundingDate', 'businessImage', 'businessVideo',
      'allowMinimumPricing', 'sellingItemsInfo', 'services',
      'q1_age', 'q2_selling_exp', 'q3_business_exp', 'q4_honest',
      'q5_work_ethic', 'q6_criminal_history', 'q7_fun',
      'firsttime', 'bio', 'address', 'distance'
    ].forEach(field => delete updatePayload[field]);

    console.log('Final user data before update:', JSON.stringify(updatePayload, null, 2));

    // Update the user in DB
    const updatedUser = await this.usersModel.findByIdAndUpdate(
      existingUser._id,
      { $set: updatePayload },
      { new: true },
    );

    if (!updatedUser) {
      return new APIMessage('User update failed!', APIMessageTypes.ERROR);
    }

    const res = new UserDto(updatedUser);

    // Update token
    res['token'] = await generateToken(updatedUser);

    // ✅ Sync with WordPress (non-blocking)
    setImmediate(async () => {
      try {
        await this.syncAffiliateProfileToWP(updatedUser, updatedUser.businessProfile);
        console.log('✅ User synced with WordPress (update)');
      } catch (err) {
        console.error('⚠️ WordPress sync failed (update):', err.message || err);
      }
    });

    return res;
  } catch (err) {
    console.error('Error during updateUser2:', err);
    throw err;
  }
}

  
async addUser2(data: any): Promise<User | APIMessage> {
  try {
    console.log('Raw input data:', data);
    data.email = data.email.toLowerCase();

    if (data.role === USER_ROLES.ADMIN) {
      throw new InternalServerErrorException();
    }

    if (!data.termsAccepted) {
      return new APIMessage(
        'Please accept terms and conditions!',
        APIMessageTypes.ERROR,
      );
    }

    if (data.email) {
      const userExist = await this.checkUserExist({
        email: data.email,
        role: data.role,
      });

      if (userExist) {
        return new APIMessage(
          'User with given email & role already exists!',
          APIMessageTypes.ERROR,
        );
      }
    }

    const plainPassword = data.password;

    // Sequential ID
    data['id'] = await this.generateSequentialId('users');
    data.createdBy = this.getCreatedBy(data);

    // Encrypt Password
    data.password = await getEncryptedPassword(plainPassword);
    data.passwordEncrypted = encrypt(plainPassword);

    // Avatar
    data['avatar'] = getDefaulAvatarUrl(data.firstName, data.lastName);

    // Status
    data.isActive = true;

    // Build Business Profile
    data.businessProfile = {
      businessName: data.businessName || '',
      foundingDate: data.foundingDate || null,
      businessImage: data.businessImage || '',
      businessVideo: data.businessVideo || '',
      bio: data.bio || '',
      services: Array.isArray(data.services) ? data.services : [],
      rating: 0,
      ratingCount: 0,
      serviceCoverageRadius: data.distance || null,
      areaServices: data.areaServices,
      nearByZipCodes: data.nearByZipCodes,
      isApproved: data.firsttime === 1,
      approvedDate: data.firsttime === false ? new Date() : null,
      termsAccepted: false,
      allowMinimumPricing: data.allowMinimumPricing || false,
      questionAnswers: [
        { question: 'What is your age?', answer: data.q1_age },
        { question: 'Do you have selling experience?', answer: data.q2_selling_exp },
        { question: 'How long have you been in business?', answer: data.q3_business_exp },
        { question: 'Are you honest?', answer: data.q4_honest },
        { question: 'How is your work ethic?', answer: data.q5_work_ethic },
        { question: 'Any criminal history?', answer: data.q6_criminal_history },
        { question: 'What makes you fun to work with?', answer: data.q7_fun },
      ].filter(q => q.answer !== undefined),
    };

    // Cleanup incoming data
    [
      'businessName', 'foundingDate', 'businessImage', 'businessVideo',
      'allowMinimumPricing', 'sellingItemsInfo', 'services',
      'q1_age', 'q2_selling_exp', 'q3_business_exp', 'q4_honest',
      'q5_work_ethic', 'q6_criminal_history', 'q7_fun',
      'firsttime', 'bio', 'address', 'distance'
    ].forEach(field => delete data[field]);

    // Notification Subscriptions
    const newadata =
      await this.notificationSubscriptionFactory.getAllNotificationSubscriptions(
        {},
        data,
      );

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

      data.notificationSubscriptions = sanitized;
    }

    console.log('Final user data before save:', JSON.stringify(data, null, 2));

    // Save User
    const newUser = new this.usersModel(data);
    const savedUser = await newUser.save();
    const res = new UserDto(savedUser);

    // Welcome text for client role
    if (res.role === USER_ROLES.CLIENT) {
      await this.sendWelcomeText(res);
    }

    res['token'] = await generateToken(savedUser);

    // ======================================================
    // 🟦 GHL SYNC — CONTACT + OPPORTUNITY + TAGS
    // ======================================================
    try {
      // 1️⃣ Create or Update Contact
      const ghlContactId = await this.ghlService.createOrUpdateContact(savedUser);

      if (ghlContactId) {
        await this.usersModel.updateOne(
          { _id: savedUser._id },
          { $set: { ghlContactId } }
        );
        savedUser.ghlContactId = ghlContactId;

        // 2️⃣ Add tags to contact (example)
        const tagsToAdd = ['customer - new']; // add more dynamically if needed
        for (const tag of tagsToAdd) {
          const added = await this.ghlService.addTag(ghlContactId, tag);
          if (added) console.log(`✅ Tag "${tag}" added to GHL contact`);
        }
      }

      // 3️⃣ Create Affiliate Opportunity (New Application Stage)
      if (ghlContactId) {
        const oppId = await this.ghlService.createOpportunity(
          ghlContactId,
          GHL_PIPELINES.AFFILIATES,
          { name: `${savedUser.firstName} ${savedUser.lastName}` }
        );

        if (oppId) {
          await this.ghlService.moveStage(
            oppId,
            GHL_STAGES.AFFILIATES.NEW_APPLICATION
          );

          await this.usersModel.updateOne(
            { _id: savedUser._id },
            { $set: { ghlAffiliateOpportunityId: oppId } }
          );
          savedUser.ghlAffiliateOpportunityId = oppId;
        }
      }

      console.log('✅ GHL Affiliate Sync + Tags Completed for addUser2()');
    } catch (err) {
      console.error('⚠️ GHL Sync Failed (addUser2):', err?.message || err);
    }

    return res;
  } catch (err) {
    console.error('Error during addUser2:', err);
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

private async updateDeviceToken(
  user: User,
  device?: Device
): Promise<User> {
  if (!device || !device.token) {
    return user; // no device provided
  }

  const token = device.token;
  const os = device.os || "unknown";

  // Prevent duplicates → overwrite existing token if same OS
  const existingDevices = user.devices || [];

  const alreadyExists = existingDevices.some((d) => d.token === token);

  let updatedDevices;

  if (alreadyExists) {
    // update OS if needed
    updatedDevices = existingDevices.map((d) =>
      d.token === token ? { token, os } : d
    );
  } else {
    updatedDevices = [...existingDevices, { token, os }];
  }

  await this.usersModel.updateOne(
    { id: user.id },
    { $set: { devices: updatedDevices } }
  );

  return await this.usersModel.findOne({ id: user.id }).exec();
}


async login(
  email: string,
  password: string,
  role?: string,
  device?: Device, // { token: string, os: string }
): Promise<User | APIMessage> {
  try {
    const query: any = { email: email.toLowerCase() };
    if (role) query.role = role;

    const user = await this.usersModel.findOne(query).exec();

    let isPasswordCorrect = false;
    if (user) {
      isPasswordCorrect = await verifyPassword(password, user.password);
    }

    // ---------------------------------------------------
    // USER FOUND + PASSWORD CORRECT
    // ---------------------------------------------------
    if (user && isPasswordCorrect) {
      const updatedUser = await this.updateDeviceToken(user, device);

      const res = new UserDto(updatedUser);
      res['token'] = await generateToken(updatedUser);
      res['subscription'] = updatedUser.subscription;

      // =====================================================
      // 🟦 GHL SYNC — CONTACT + CUSTOMER OPPORTUNITY
      // =====================================================
      try {
        const ghlContactId = await this.ghlService.createOrUpdateContact(updatedUser);

        if (ghlContactId) {
          if (!updatedUser.ghlContactId) {
            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlContactId } }
            );
          }
          updatedUser.ghlContactId = ghlContactId;
        }

        if (updatedUser.role === USER_ROLES.CLIENT && updatedUser.ghlContactId) {
          // Create opportunity if missing
          if (!updatedUser.ghlCustomerOpportunityId) {
            const oppId = await this.ghlService.createOpportunity(
              updatedUser.ghlContactId,
              GHL_PIPELINES.CUSTOMERS,
              { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // ✅ extra object
            );

            if (oppId) {
              // Move to desired stage
              await this.ghlService.moveStage(
                oppId,
                GHL_STAGES.CUSTOMERS.DOWNLOADED_APP
              );

              await this.usersModel.updateOne(
                { _id: updatedUser._id },
                { $set: { ghlCustomerOpportunityId: oppId } }
              );
              updatedUser.ghlCustomerOpportunityId = oppId;
            }
          } else {
            // Move stage if opportunity already exists
            await this.ghlService.moveStage(
              updatedUser.ghlCustomerOpportunityId,
              GHL_STAGES.CUSTOMERS.DOWNLOADED_APP
            );
          }
        }
      } catch (ghlErr) {
        console.error('⚠️ GHL Login Sync Error:', ghlErr?.response?.data || ghlErr.message);
      }

      return res;
    }

    // ---------------------------------------------------
    // WORDPRESS LOGIN FALLBACK
    // ---------------------------------------------------
    try {
      const wpRes = await Axios.post(process.env.WP_LOGIN_URL, {
        username: email,
        password,
      });

      if (wpRes.data?.token) {
        const wpData = wpRes.data;
        const wpUser = await this.loginWithWordpress(wpData, password);

        const updatedWPUser = await this.updateDeviceToken(wpUser, device);
        updatedWPUser['token'] = await generateToken(updatedWPUser);

        // =====================================================
        // 🟦 GHL SYNC — WP LOGIN
        // =====================================================
        try {
          const ghlContactId = await this.ghlService.createOrUpdateContact(updatedWPUser);

          if (ghlContactId && !updatedWPUser.ghlContactId) {
            await this.usersModel.updateOne(
              { _id: updatedWPUser._id },
              { $set: { ghlContactId } }
            );
            updatedWPUser.ghlContactId = ghlContactId;
          }

          if (
            updatedWPUser.role === USER_ROLES.CLIENT &&
            updatedWPUser.ghlContactId
          ) {
            if (!updatedWPUser.ghlCustomerOpportunityId) {
              const oppId = await this.ghlService.createOpportunity(
                updatedWPUser.ghlContactId,
                GHL_PIPELINES.CUSTOMERS,
                { name: `${updatedWPUser.firstName} ${updatedWPUser.lastName}` }
              );

              if (oppId) {
                await this.ghlService.moveStage(
                  oppId,
                  GHL_STAGES.CUSTOMERS.DOWNLOADED_APP
                );

                await this.usersModel.updateOne(
                  { _id: updatedWPUser._id },
                  { $set: { ghlCustomerOpportunityId: oppId } }
                );
                updatedWPUser.ghlCustomerOpportunityId = oppId;
              }
            } else {
              // Move stage if opportunity exists
              await this.ghlService.moveStage(
                updatedWPUser.ghlCustomerOpportunityId,
                GHL_STAGES.CUSTOMERS.DOWNLOADED_APP
              );
            }
          }
        } catch (err) {
          console.error('⚠️ GHL WP Login Sync Error:', err?.response?.data || err.message);
        }

        return updatedWPUser;
      }
    } catch (error) {
      if (error?.response?.data?.data?.status === 403) {
        throw new HttpException(
          new APIMessage('Invalid Credentials!', APIMessageTypes.ERROR),
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw error;
    }

    // ---------------------------------------------------
    // FINAL FAILED RESPONSE
    // ---------------------------------------------------
    throw new HttpException(
      new APIMessage('Invalid Credentials!', APIMessageTypes.ERROR),
      HttpStatus.UNAUTHORIZED,
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
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
  
        // Set SendGrid API Key
        sgMail.setApiKey(process.env.SEND_GRID_API_KEY);
  
        const msg = {
          to,
          from: 'help@runmysale.com', // Replace with verified sender
          subject: 'Your Verification Code',
          text: `Your verification code is ${otp}`,
          html: `<strong>Your verification code is ${otp}</strong>`,
        };
  
        await sgMail.send(msg);
  
        // Store OTP temporarily in memory
        emailOtpStore.set(to, { otp, expiresAt });
  
        console.log(`OTP sent to ${to} via email: ${otp}`);
        return { channel: 'email', to };
      } else {
        const res = await twilioVerifyService.verifications.create({
          to,
          channel,
        });
  
        console.log(`OTP sent to ${to} via ${channel}: ${res.sid}`);
        return res;
      }
    } catch (err) {
       if(channel==='sms' && err.message.includes("Invalid parameter")){
        // console.log("hiiii",err.message,'./././././');
        return {
          statusCode:"400",
          message:err.message,
          error:"Invalid Phone Number"
        }
      throw new InternalServerErrorException('Failed to send verification code');
    }else{
      console.error('SendGrid Error:', err?.response?.body || err.message || err);
      throw new InternalServerErrorException('Failed to send verification code');
     
    }
  }
  }
  
  

async verifyVerificationCode(to: string, code: string, role: string): Promise<any> {
  // Minimal input checks
  if (!to || !code) {
    // If you truly want generic 500 for everything, throw 500 here.
    // Otherwise, 400 is more correct:
    throw new BadRequestException('Invalid data');
  }

  // Email path (unchanged)
  if (!to.startsWith('+')) {
    const record = emailOtpStore.get(to);
    if (!record) return new APIMessage('No verification request found', APIMessageTypes.ERROR);
    if (Date.now() > record.expiresAt) {
      emailOtpStore.delete(to);
      return new APIMessage('Verification code expired', APIMessageTypes.ERROR);
    }
    if (record.otp !== code) {
      return new APIMessage('Invalid verification code', APIMessageTypes.ERROR);
    }
    emailOtpStore.delete(to);

    const user = await this.usersModel.findOne({ email: to }).exec();
    if (!user) throw new UnauthorizedException();
    const token = await generateUserVerificationToken(user);
    return { token };
  }

  // Phone path
  const cleanedTo = to.replace(/\s+/g, ''); // strip spaces
  if (!isE164(cleanedTo)) {
    // You can keep 500 generic if required:
    // throw new InternalServerErrorException('Internal server error');
    // Or return 400 to be accurate:
    throw new BadRequestException('Invalid phone number');
  }

  try {
    // Must have started verification earlier with the same Verify Service SID:
    // await twilioVerifyService.verifications.create({ to: cleanedTo, channel: 'sms' });
    const res = await twilioVerifyService.verificationChecks.create({ to: cleanedTo, code });

    if (!res || !Object.values(TWILIO_CHANNEL).includes(res.channel)) {
      throw new InternalServerErrorException('Internal server error');
    }

    if (res.status === 'approved') {
      const query: any = { phoneNumber: cleanedTo };
      if (role) query.role = role;

      const user = await this.usersModel.findOne(query).exec();
      if (!user) throw new UnauthorizedException();
      const token = await generateUserVerificationToken(user);
      return { token };
    }

    // Code wrong or expired; if you want generic 500 instead, swap this line
    return new APIMessage('Verification failed', APIMessageTypes.ERROR);
  } catch (err: any) {
    // Keep details in server logs
    console.error('[Twilio Verify Error]', err?.message || err);

    // If you want the client to ALWAYS see generic 500:
    throw new InternalServerErrorException('Internal server error');

    // If you’d rather map known Twilio issues to 400, use:
    // if (String(err?.message || '').includes('Invalid parameter `To`')) {
    //   throw new BadRequestException('Invalid phone number');
    // }
    // throw new InternalServerErrorException('Internal server error');
  }
}
  

async updateUserData(
  dataToUpdate: User | any,
  user: User,
): Promise<User | APIMessage> {
  try {
    console.log("hello");
    delete dataToUpdate['role'];
    const sensitiveFields = ['password', 'isMobileVerfied', 'isEmailVerified'];

    if (!dataToUpdate) throw new BadRequestException('Invalid Data');

    const condition = { id: user.id, isActive: true };

    const hasSensitiveFields =
      getIntersection(Object.keys(dataToUpdate), sensitiveFields).length > 0;

    // ============================================================
    // 🔐 SENSITIVE FIELDS UPDATE
    // ============================================================
    if (hasSensitiveFields) {
      if (!user || !user.isUserVerified) {
        throw new UnauthorizedException('Unverified user cannot update sensitive data');
      }

      // PASSWORD CHANGE LOGIC
      if (dataToUpdate['password']) {
        const plainNewPassword = dataToUpdate['password'];

        // Encrypt local password
        dataToUpdate['password'] = await getEncryptedPassword(plainNewPassword);

        try {
          const dbUser = await this.usersModel
            .findOne({ id: user.id })
            .select('email passwordEncrypted')
            .lean();

          if (!dbUser) throw new Error('User not found in DB for WP password update');

          const plainOldPassword = decrypt(dbUser.passwordEncrypted);

          // Login to WordPress
          const wpLoginResponse = await Axios.post(
            'https://runmysale.com/wp-json/affiliate-subscription/v1/login',
            {
              username: dbUser.email,
              password: plainOldPassword,
            }
          );

          if (!wpLoginResponse.data?.token) {
            throw new Error('Failed WP login for password update');
          }

          const wpToken = wpLoginResponse.data.token;

          // Update WP Password
          const wpUpdateResponse = await axios.post(
            'https://runmysale.com/wp-json/affiliate-subscription/v1/update_profile',
            {
              token: wpToken,
              password: plainNewPassword,
            }
          );

          if (wpUpdateResponse.data?.success === false) {
            throw new Error('Failed to update WP password');
          }
        } catch (wpErr) {
          throw new Error(`WordPress password update error: ${wpErr.message}`);
        }
      }

      // Update Local User
      const updatedUser = await this.usersModel.findOneAndUpdate(
        condition,
        { $set: { ...dataToUpdate } },
        { new: true }
      );

      const res = new UserDto(updatedUser);
      res['token'] = await generateToken(updatedUser);

      // =====================================================
      // 🟦 GHL SYNC FOR SENSITIVE UPDATE
      // (only contact update — no stage moves)
      // =====================================================
      try {
        const ghlContactId = await this.ghlService.createOrUpdateContact(updatedUser);

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } }
          );
        }
      } catch (err) {
        console.error("⚠️ GHL Sync Error (Sensitive Update):", err.message);
      }

      return res;
    }

    // ============================================================
    // ✨ GENERAL DATA UPDATE
    // ============================================================
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

    const updatedUser = await this.usersModel.findOneAndUpdate(
      condition,
      { $set: { ...dataToUpdate } },
      { new: true }
    );

    const res = new UserDto(updatedUser);

    // ======================================================
    // 🟦 GHL SYNC — CONTACT + OPPORTUNITY UPDATE
    // ======================================================
    try {
      // 1️⃣ Sync/update contact information
      const ghlContactId = await this.ghlService.createOrUpdateContact(updatedUser);

      if (ghlContactId && !updatedUser.ghlContactId) {
        await this.usersModel.updateOne(
          { _id: updatedUser._id },
          { $set: { ghlContactId } }
        );
        updatedUser.ghlContactId = ghlContactId;
      }

      // 2️⃣ Update Opportunity Name (if changed)
      if (updatedUser.ghlCustomerOpportunityId) {
        await this.ghlService.updateOpportunity(
          updatedUser.ghlCustomerOpportunityId,
          {
            name: `${updatedUser.firstName} ${updatedUser.lastName}`,
          }
        );
      }
    } catch (ghlErr) {
      console.error("⚠️ GHL Sync Error (General Update):", ghlErr.message);
    }

    // Welcome text on signup completion
    if (dataToUpdate['completingSignUp'] && updatedUser.role === USER_ROLES.CLIENT) {
      await this.sendWelcomeText(updatedUser);
    }

    res['token'] = await generateToken(updatedUser);
    return res;
  } catch (err) {
    throw err;
  }
}



async autoVerifyPhoneNumber(phoneNumber: string): Promise<User | APIMessage> {
  try {
    // Find the user by phone number
    const user = await this.usersModel.findOne({ phoneNumber, isActive: true }).exec();

    if (!user) {
      return new APIMessage('User with given phone number does not exist!', APIMessageTypes.ERROR);
    }

    // Update the isMobileVerified field to true
    user.isMobileVerfied = true;

    // Save the updated user data
    const updatedUser = await user.save();

    // Return updated user or any other response
    const res = new UserDto(updatedUser);
    res['token'] = await generateToken(updatedUser);
    return res;

  } catch (err) {
    console.error('Error while auto-verifying phone number:', err);
    throw new InternalServerErrorException('Failed to verify phone number');
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
    console.log('--- addHelpMessage called ---');
    console.log('Incoming user:', user);
    console.log('Incoming data:', data);

    if (!user || !user.email) {
      console.error('Invalid or missing user');
      throw new HttpException('Invalid or missing user in request', HttpStatus.BAD_REQUEST);
    }

    // Generate a unique sequential ID for the HelpMessage
    const newId = await this.generateSequentialId('HelpMessage');
    console.log('Generated HelpMessage ID:', newId);
    data['id'] = newId;

    // Attach user and creator info
    data['user'] = user;
    data.createdBy = this.getCreatedBy(user);
    console.log('Final help message data before save:', data);

    // Save help message to DB
    const newHelpMessage = new this.helpMessageModel(data);
    let res = await newHelpMessage.save();
    console.log('Help message saved:', res);

    // Populate user info
    res = await res.populate('user').execPopulate();
    console.log('Populated help message:', res);

    // Transform to DTO
    const helpMessage = new HelpMessageDto(res);
    console.log('HelpMessage DTO:', helpMessage);

    // Check if it's a cleanout strategy message
    const isCleanoutRequest = data.CLEANOUT === true;
    
    if (isCleanoutRequest) {
      console.log('Sending email to cleanout strategy team...');
      await sendTemplateEmail('cleanoutstrategy@runmysale.com', MAIL_TEMPLATES.HELP_MESSAGE, {
        message: helpMessage.message,
        user: helpMessage.user,
      });
    } else {
      // Fetch admin and send email
      const admin = await this.getAdmin();
      console.log('Admin user:', admin);

      if (admin && admin.email) {
        console.log('Sending help message email to admin...');
        await sendTemplateEmail(admin.email, MAIL_TEMPLATES.HELP_MESSAGE, {
          message: helpMessage.message,
          user: helpMessage.user,
        });
      } else {
        console.warn('Admin not found or missing email, no email sent.');
      }
    }

    console.log('--- addHelpMessage completed successfully ---');
    return helpMessage;

  } catch (err) {
    console.error('Error in addHelpMessage:', err);
    throw new HttpException(
      `Failed to add help message: ${err.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
// users.factory.ts
async setAffiliateStatusByEmail(
  email: string,
  status: 'approve' | 'deny',
): Promise<{ success: boolean; data?: UserDto; error?: string }> {
  try {
    if (!email || !status) {
      return { success: false, error: 'Email and status are required' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersModel.findOne({ email: normalizedEmail });
    if (!user) return { success: false, error: 'User not found' };

    const isApprove = status.toLowerCase() === 'approve';

    const update: any = {
      affiliateStatus: isApprove ? 'APPROVED' : 'DENIED',
      'businessProfile.isApproved': isApprove,
      'businessProfile.approvedDate': isApprove ? new Date() : null,
    };

    const updatedUser = await this.usersModel.findOneAndUpdate(
      { _id: user._id },
      { $set: update },
      { new: true },
    );

    // ======================================================
    // 🟦 GHL SYNC — UPDATE TAGS BASED ON STATUS
    // ======================================================
    try {
      if (updatedUser.ghlContactId) {
        const contactId = updatedUser.ghlContactId;

        if (isApprove) {
          // Add approved tags
          await this.ghlService.addTag(contactId, 'affiliate_approved');
          await this.ghlService.addTag(contactId, 'affiliate_active');
          console.log(`✅ GHL tags added for approved affiliate: ${contactId}`);
        } else {
          // Remove approved/active tags
          await this.ghlService.removeTag(contactId, 'affiliate_approved');
          await this.ghlService.removeTag(contactId, 'affiliate_active');
          console.log(`✅ GHL tags removed for denied affiliate: ${contactId}`);
        }
      }
    } catch (ghlErr) {
      console.error('⚠️ GHL Tag Sync Failed:', ghlErr?.message || ghlErr);
    }

    return { success: true, data: new UserDto(updatedUser) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unexpected error' };
  }
}




async deleteAffiliateProfileById(
  this: any,
  id: string,
  denyPresent: boolean,
): Promise<{ success: boolean; message: string }> {
  try {
    const isDenied = denyPresent === true;

    // ---------------------------------------------------------
    //  Fetch full user doc (needed for all paths)
    // ---------------------------------------------------------
    const userDoc = await this.usersModel.findById(id);
    if (!userDoc) {
      return { success: false, message: 'User not found; status not updated' };
    }

    // =========================================================
    // 🟩 ALWAYS UPDATE GHL FIRST (DENY or DELETE)
    // =========================================================
    try {
      if (userDoc.role === USER_ROLES.AFFILIATE) {
        // 1) Ensure GHL contact exists
        const ghlContactId =
          userDoc.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: userDoc.email,
            phone: userDoc.phoneNumber,
            firstName: userDoc.firstName,
            lastName: userDoc.lastName,
          }));

        if (ghlContactId && !userDoc.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: userDoc._id },
            { $set: { ghlContactId } },
          );
          userDoc.ghlContactId = ghlContactId;
        }

        // 2) Ensure affiliate opportunity exists
        let oppId = userDoc.ghlAffiliateOpportunityId;

        if (!oppId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            { name: `${userDoc.firstName} ${userDoc.lastName}` },
          );

          if (oppId) {
            await this.usersModel.updateOne(
              { _id: userDoc._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            userDoc.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 3) Move affiliate → INACTIVE for BOTH DENY + DELETE
        await this.ghlService.moveStage(
          oppId,
          GHL_STAGES.AFFILIATES.INACTIVE,
        );

        console.log(`[GHL] Affiliate moved → INACTIVE`);
      }
    } catch (ghlErr) {
      console.error('⚠️ GHL Error deleteAffiliateProfileById:', ghlErr.message);
    }

    // =========================================================
    //  CASE A: DENIAL ONLY (NO DELETION)
    // =========================================================
    if (isDenied) {
      try {
        await this.usersModel.findByIdAndUpdate(
          id,
          {
            $set: {
              affiliateStatus: 'DENIED',
              'businessProfile.isApproved': false,
              'businessProfile.approvedDate': null,
            },
          },
          { new: true },
        );

        // Notify WordPress
        await axios.post(
          'https://runmysale.com/wp-json/wpus/v1/user/status',
          {
            email: (userDoc.email || '').toLowerCase(),
            status: 'denied',
            reason: 'Documents verified',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-App-Key': 'XAPP_KLP78AAG3KQM29CULPAK',
            },
            timeout: 10000,
          },
        );
      } catch (wpErr) {
        console.error(
          '[WP STATUS] Failed to send denial:',
          wpErr?.response?.data || wpErr?.message,
        );
      }

      return {
        success: true,
        message: 'Affiliate DENIED (no deletion performed; WP notified).',
      };
    }

    // =========================================================
    //  CASE B: FULL DELETION (LOCAL + WORDPRESS)
    // =========================================================
    console.log(`[WP DELETE] Starting deletion for user ID: ${id}`);

    const dbUser = await this.usersModel
      .findById(id)
      .select('email passwordEncrypted')
      .lean();

    if (!dbUser || !dbUser.passwordEncrypted) {
      return {
        success: true,
        message: 'Affiliate already deleted (no local WP credentials).',
      };
    }

    const email = (dbUser.email || '').toLowerCase();
    const plainPassword = decrypt(dbUser.passwordEncrypted);

    // 1) Login to WordPress
    const wpLoginResponse = await axios.post(
      'https://runmysale.com/wp-json/affiliate-subscription/v1/login',
      { username: email, password: plainPassword },
    );

    // 2) Extract PHP session cookie
    const cookies = wpLoginResponse.headers['set-cookie'];
    if (!cookies) throw new BadRequestException('WP login failed (no cookies)');

    const phpSessId =
      cookies.find((c: string) => c.startsWith('PHPSESSID='))?.split(';')[0];

    if (!phpSessId) throw new BadRequestException('PHPSESSID missing');

    // 3) Delete from WP
    await axios.post(
      'https://runmysale.com/wp-json/affsub/v1/delete-user',
      { email, secret: 'MyUltraSecureSecret123' },
      { headers: { Cookie: phpSessId } },
    );

    // 4) Delete locally
    const result = await this.usersModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return {
        success: true,
        message: 'WP deleted; local user already removed.',
      };
    }

    return {
      success: true,
      message: 'Affiliate successfully deleted from BOTH WordPress & Local DB.',
    };
  } catch (err: any) {
    console.error(
      '[deleteAffiliateProfileById] Error:',
      err.response?.data || err.message,
    );
    throw err;
  }
}

async denyAffiliateById(
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 1️⃣ Fetch user document
    const userDoc = await this.usersModel.findById(id);
    if (!userDoc) {
      return { success: false, message: 'User not found; status not updated' };
    }

    // 2️⃣ Update local DB → DENIED
    const updatedUser = await this.usersModel.findByIdAndUpdate(
      id,
      {
        $set: {
          affiliateStatus: 'DENIED',
          'businessProfile.isApproved': false,
          'businessProfile.approvedDate': null,
        },
      },
      { new: true } // ✅ return updated doc
    );

    if (!updatedUser) {
      return { success: false, message: 'Failed to update user status' };
    }

    // 3️⃣ GHL Affiliate → INACTIVE
    try {
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        // Ensure GHL contact exists
        const ghlContactId =
          updatedUser.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          }));

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } }
          );
          updatedUser.ghlContactId = ghlContactId;
        }

        // Ensure affiliate opportunity exists
        let oppId = updatedUser.ghlAffiliateOpportunityId;
        if (!oppId) {
          // ✅ Updated: Only 3 arguments for createOpportunity
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // merged into last arg
          );

          if (oppId) {
            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } }
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // Move opportunity stage → INACTIVE
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.INACTIVE
          );
        }
      }
    } catch (err: any) {
      console.error(
        '⚠️ GHL denyAffiliateById ERROR:',
        err?.message || err
      );
    }

    return { success: true, message: 'Affiliate status set to DENIED' };
  } catch (err: any) {
    console.error('[denyAffiliateById] Unexpected error:', err?.message || err);
    throw err;
  }
}

async deleteAffiliateProfileById2(
  this: any,
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`[LOCAL DELETE] Starting deletion process for user ID: ${id}`);

    // 1) Fetch user from local DB
    const dbUser = await this.usersModel
      .findById(id)
      .select('email ghlContactId ghlAffiliateOpportunityId passwordEncrypted')
      .lean();
    console.log(`[LOCAL DELETE] Fetched user from DB:`, dbUser);

    if (!dbUser) {
      throw new BadRequestException('Affiliate not found in the database');
    }

    // =========================================================
    // 🟩 ALWAYS UPDATE GHL FIRST (DELETE Affiliate Profile)
    // =========================================================
    try {
      if (dbUser.ghlContactId) {
        // Ensure GHL contact exists
        const ghlContactId = dbUser.ghlContactId;

        // 1) Move Affiliate Opportunity → INACTIVE (GHL)
        if (dbUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            dbUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.INACTIVE
          );
          console.log(`[GHL] Affiliate opportunity moved to INACTIVE`);
        }

        // 2) Delete GHL Contact (if needed)
        await this.ghlService.deleteContact(ghlContactId);
        console.log(`[GHL] Affiliate contact deleted`);
      }
    } catch (ghlErr) {
      console.error('⚠️ GHL Error deleteAffiliateProfileById2:', ghlErr.message);
    }

    // =========================================================
    // 🟦 WP Sync (DELETE Affiliate from WP)
    // =========================================================
    try {
      const email = (dbUser.email || '').toLowerCase();
      const plainPassword = dbUser.passwordEncrypted ? decrypt(dbUser.passwordEncrypted) : null;

      if (email && plainPassword) {
        // 1) Login to WordPress
        const wpLoginResponse = await axios.post(
          'https://runmysale.com/wp-json/affiliate-subscription/v1/login',
          { username: email, password: plainPassword }
        );

        // 2) Extract PHP session cookie
        const cookies = wpLoginResponse.headers['set-cookie'];
        if (!cookies) throw new BadRequestException('WP login failed (no cookies)');

        const phpSessId =
          cookies.find((c: string) => c.startsWith('PHPSESSID='))?.split(';')[0];

        if (!phpSessId) throw new BadRequestException('PHPSESSID missing');

        // 3) Delete from WP
        await axios.post(
          'https://runmysale.com/wp-json/affsub/v1/delete-user',
          { email, secret: 'MyUltraSecureSecret123' },
          { headers: { Cookie: phpSessId } }
        );

        console.log(`[WP] Affiliate deleted from WordPress`);
      }
    } catch (wpErr) {
      console.error('[WP DELETE] Failed to delete from WordPress:', wpErr?.response?.data || wpErr?.message);
    }

    // =========================================================
    //  Delete Affiliate from Local DB
    // =========================================================
    const result = await this.usersModel.deleteOne({ _id: id });
    console.log(`[LOCAL DELETE] Local DB deletion result:`, result);

    if (result.deletedCount === 0) {
      throw new BadRequestException('Affiliate not found or already deleted');
    }

    console.log(`[LOCAL DELETE] Deletion completed successfully for user ID: ${id}`);
    return {
      success: true,
      message: 'Affiliate profile deleted successfully from local system and synced with GHL & WordPress',
    };
  } catch (err: any) {
    console.error('[deleteAffiliateProfileById2] Error:', err?.response?.data || err.message);
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
    // -----------------------------
    // Terms Acceptance Check
    // -----------------------------
    if (!data.termsAccepted) {
      return new APIMessage(
        'Please accept terms and conditions!',
        APIMessageTypes.ERROR,
      );
    }

    // -----------------------------
    // ZIP + SERVICE COVERAGE LOGIC
    // -----------------------------
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

    // -----------------------------
    // Update User Profile
    // -----------------------------
    const updatedUser = (await this.updateUserData(
      { businessProfile: data },
      user,
    )) as User;

    if (updatedUser?._id) {
      // Send welcome message for new affiliates
      await this.sendWelcomeText(updatedUser);

      // WordPress Sync (async, non-blocking)
      this.syncAffiliateProfileToWP(updatedUser, updatedUser.businessProfile).catch(
        (e) => console.error('[WP SYNC][createBusinessProfile] failed:', e?.message || e),
      );
    }

    // -----------------------------
    // 🟩 GHL SYNC: AFFILIATE BUSINESS PROFILE
    // -----------------------------
    try {
      // 1️⃣ Ensure GHL contact exists
      const ghlContactId =
        updatedUser.ghlContactId ||
        (await this.ghlService.createOrUpdateContact({
          email: updatedUser.email,
          phone: updatedUser.phoneNumber,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        }));

      if (ghlContactId && !updatedUser.ghlContactId) {
        await this.usersModel.updateOne(
          { _id: updatedUser._id },
          { $set: { ghlContactId } },
        );
        updatedUser.ghlContactId = ghlContactId;
      }

      // Only affiliates move through the affiliate pipeline
      if (updatedUser.role === USER_ROLES.AFFILIATE && ghlContactId) {
        let oppId = updatedUser.ghlAffiliateOpportunityId;

        // 2️⃣ Create opportunity if missing
        if (!oppId) {
          // ✅ Fixed TS2554: Only 3 arguments passed
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { 
              stage: GHL_STAGES.AFFILIATES.NEW_APPLICATION,
              name: `${updatedUser.firstName} ${updatedUser.lastName}`
            }
          );

          if (oppId) {
            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 3️⃣ Move stage → BACKGROUND_SENT
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.BACKGROUND_SENT,
          );
        }

        // 4️⃣ Update opportunity details
        await this.ghlService.updateOpportunity(
          updatedUser.ghlAffiliateOpportunityId,
          {
            name: `${updatedUser.firstName} ${updatedUser.lastName}`,
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
          }
        );
      }
    } catch (err) {
      console.error('⚠️ GHL ERROR createBusinessProfile:', err?.message || err);
    }

    // -----------------------------
    // 🟦 WORDPRESS SYNC: Syncing affiliate profile to WordPress
    // -----------------------------
    try {
      await this.syncAffiliateProfileToWP(updatedUser, updatedUser.businessProfile);
    } catch (wpErr) {
      console.error('[WP SYNC] Failed to sync affiliate profile:', wpErr?.message || wpErr);
    }

    return updatedUser;
  } catch (err) {
    console.error('[createBusinessProfile] Error:', err?.message || err);
    throw err;
  }
}






async updateBusinessProfile(
  data: BusinessProfile,
  user: User,
): Promise<User | APIMessage> {
  try {
    // Set the user who performed the update
    data.updatedBy = this.getUpdatedBy(user);

    // --------------------------
    // ZIP + SERVICE COVERAGE LOGIC
    // --------------------------
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

    // --------------------------
    // MAP NESTED FIELDS FOR MONGO
    // --------------------------
    const dataToUpdate: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      dataToUpdate[`businessProfile.${key}`] = (data as any)[key];
    });

    // --------------------------
    // DB UPDATE
    // --------------------------
    const updatedUser = (await this.updateUserData(
      dataToUpdate,
      user,
    )) as User;

    // -------------------------
    // WordPress SYNC (async)
    // -------------------------
    this.syncAffiliateProfileToWP(updatedUser, updatedUser.businessProfile).catch(
      (e) => console.error('[WP SYNC][updateBusinessProfile] failed:', e?.message || e),
    );

    // ======================================================
    // 🟩 GHL SYNC — BUSINESS PROFILE UPDATE
    // ======================================================
    try {
      // 1️⃣ Ensure GHL Contact exists
      const ghlContactId =
        updatedUser.ghlContactId ||
        (await this.ghlService.createOrUpdateContact({
          email: updatedUser.email,
          phone: updatedUser.phoneNumber,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
        }));

      if (ghlContactId && !updatedUser.ghlContactId) {
        // If GHL contact ID is new, update the user model
        await this.usersModel.updateOne(
          { _id: updatedUser._id },
          { $set: { ghlContactId } },
        );
        updatedUser.ghlContactId = ghlContactId;
      }

      // Only affiliates move through the affiliate pipeline
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        let oppId = updatedUser.ghlAffiliateOpportunityId;

        // 2️⃣ Create Opportunity if missing
        if (!oppId && ghlContactId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` }
          );

          if (oppId) {
            // Move stage separately to NEW_APPLICATION
            await this.ghlService.moveStage(
              oppId,
              GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            );

            // Update the opportunity ID in the user model
            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 3️⃣ Move Stage → BACKGROUND_PASSED
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.BACKGROUND_PASSED,
          );
        }

        // 4️⃣ Update Opportunity Details
        await this.ghlService.updateOpportunity(
          updatedUser.ghlAffiliateOpportunityId,
          {
            name: `${updatedUser.firstName} ${updatedUser.lastName}`,
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
          }
        );
      }
    } catch (err) {
      console.error('⚠️ GHL ERROR updateBusinessProfile:', err?.message || err);
    }

    // -------------------------
    // Return Updated User
    // -------------------------
    return updatedUser;
  } catch (err) {
    console.error('[updateBusinessProfile] Error:', err?.message || err);
    throw err; // Rethrow the error for proper handling at higher levels
  }
}





// ----------------------------
// Helper for WP Sync
// ----------------------------
private async syncAffiliateProfileToWP(user: User, bp: BusinessProfile): Promise<void> {
  try {
    const dbUser = await this.usersModel
      .findById(user._id)
      .select('email passwordEncrypted firstName lastName phoneNumber zipCode dob')
      .lean();

    if (!dbUser || !dbUser.passwordEncrypted) return;

    const email = dbUser.email.toLowerCase();
    const plainPassword = decrypt(dbUser.passwordEncrypted);

    // 1) Login to WordPress
    const wpLoginResponse = await axios.post(
      'https://runmysale.com/wp-json/affiliate-subscription/v1/login',
      { username: email, password: plainPassword },
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (!wpLoginResponse?.data?.success || !wpLoginResponse?.data?.token) {
      console.error('[WP SYNC] WordPress login failed', wpLoginResponse?.data);
      return;
    }

    const wpToken = wpLoginResponse.data.token;

    // --- Map q1 - q7 from questionAnswers ---
    console.log('[WP SYNC] questionAnswers:', (bp as any)?.questionAnswers);
    const qFields: Record<string, string> = {};
    const questionAnswers = (bp as any)?.questionAnswers;

    if (Array.isArray(questionAnswers)) {
      const keys = [
        'q1_age',
        'q2_selling_exp',
        'q3_business_exp',
        'q4_honest',
        'q5_work_ethic',
        'q6_criminal_history',
        'q7_fun',
      ];

      questionAnswers.forEach((qa: any, index: number) => {
        if (qa?.answer !== undefined && keys[index]) {
          qFields[keys[index]] = qa.answer;
        }
      });
    }

    // 2) Build payload
    const payload: any = {
      token: wpToken,
      bio: bp?.bio ?? '',
      distance: bp?.serviceCoverageRadius ?? 0,
      first_name: dbUser.firstName ?? '',
      last_name: dbUser.lastName ?? '',
      phone: dbUser.phoneNumber ?? '',
      zip_code: dbUser.zipCode ?? '',
      country_code: 'US',
      dob: dbUser.dob ? new Date(dbUser.dob).toISOString().slice(0, 10) : '',
      password: plainPassword,
      businessName: bp?.businessName ?? '',
      foundingDate: bp?.foundingDate
        ? new Date(bp.foundingDate).toISOString().slice(0, 10)
        : '',
      allowMinimumPricing:
        (bp as any)?.allowMinimumPricing === true || (bp as any)?.allowMinimumPricing === 'yes'
          ? 'yes'
          : 'no',
      sellingItemsInfo: (bp as any)?.sellingItemsInfo ?? '',
      services: bp?.services ?? [],
      businessImage: bp?.businessImage ?? '',
      businessVideo: (bp as any)?.businessVideo ?? '',
      ...qFields,
    };

    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined || payload[k] === null) delete payload[k];
    });

    console.log('[WP SYNC] Payload:', payload);

    // 3) Send to WP
    await axios.post(
      'https://runmysale.com/wp-json/affiliate-subscription/v1/update_profile',
      payload,
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );

    console.log('[WP SYNC] Successfully synced profile for:', email);
  } catch (err: any) {
    console.error('[WP SYNC Error]', err.response?.data || err.message);
  }
}









async approveBusinessProfile(id: string, user: User): Promise<UserDto> {
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

    if (!updatedUser) {
      throw new Error('User not found');
    }

    const res = new UserDto(updatedUser);

    // -----------------------------
    // 🟩 GHL AFFILIATE → APPROVED
    // -----------------------------
    try {
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        // 1️⃣ Ensure contact exists
        const ghlContactId =
          updatedUser.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          }));

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } },
          );
          updatedUser.ghlContactId = ghlContactId;
        }

        // 2️⃣ Ensure opportunity exists
        let oppId = updatedUser.ghlAffiliateOpportunityId;

        if (!oppId && ghlContactId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // ✅ only 3 args
          );

          if (oppId) {
            // Move stage to NEW_APPLICATION separately
            await this.ghlService.moveStage(
              oppId,
              GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            );

            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 3️⃣ Move stage → APPROVED
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.APPROVED,
          );
        }
      }
    } catch (err) {
      console.error('⚠️ GHL approveBusinessProfile ERROR:', err?.message || err);
    }

    return res;
  } catch (err) {
    throw err;
  }
}



async approveBusinessProfile2(phoneNumber: string, adminUser: User): Promise<UserDto> {
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

    // -----------------------------
    // 🟩 GHL AFFILIATE → APPROVED
    // -----------------------------
    try {
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        const ghlContactId =
          updatedUser.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          }));

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } },
          );
          updatedUser.ghlContactId = ghlContactId;
        }

        let oppId = updatedUser.ghlAffiliateOpportunityId;

        // 1️⃣ Create opportunity if missing
        if (!oppId && ghlContactId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // ✅ only 3 args
          );

          if (oppId) {
            // Move stage to NEW_APPLICATION separately
            await this.ghlService.moveStage(
              oppId,
              GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            );

            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 2️⃣ Move stage → APPROVED
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.APPROVED,
          );
        }
      }
    } catch (err) {
      console.error('⚠️ GHL approveBusinessProfile2 ERROR:', err?.message || err);
    }

    return new UserDto(updatedUser);
  } catch (err) {
    throw err;
  }
}



// adjust import as needed
  
async approveBusinessProfileByIdOnly(
  id: string
): Promise<{ success: boolean; data?: UserDto; error?: string }> {
  try {
    const user = await this.usersModel.findById(id);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const updatedUser = await this.usersModel.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          affiliateStatus: 'APPROVED',
          'businessProfile.isApproved': true,
          'businessProfile.approvedDate': new Date(),
        },
      },
      { new: true }
    );

    // -----------------------------
    // 🟩 GHL AFFILIATE → APPROVED
    // -----------------------------
    try {
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        const ghlContactId =
          updatedUser.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          }));

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } },
          );
          updatedUser.ghlContactId = ghlContactId;
        }

        let oppId = updatedUser.ghlAffiliateOpportunityId;

        // 1️⃣ Create opportunity if missing
        if (!oppId && ghlContactId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // ✅ extra object only
          );

          if (oppId) {
            // Move stage to NEW_APPLICATION separately
            await this.ghlService.moveStage(
              oppId,
              GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            );

            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 2️⃣ Move stage → APPROVED
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.APPROVED,
          );
        }
      }
    } catch (err) {
      console.error(
        '⚠️ GHL approveBusinessProfileByIdOnly ERROR:',
        err?.message || err,
      );
    }

    return { success: true, data: new UserDto(updatedUser) };
  } catch (err) {
    return { success: false, error: err?.message || 'Unexpected error' };
  }
}



async approveBusinessProfileByIdOnlyy(id: string): Promise<{ success: boolean; data?: UserDto; error?: string }> {
  try {
    // 1. Find the user to ensure they exist
    const user = await this.usersModel.findById(id);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // 2. Update user in local database
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

async approveBusinessProfileByEmailOnly(
  email: string
): Promise<{ success: boolean; data?: UserDto; error?: string }> {
  try {
    const user = await this.usersModel.findOne({ email });
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const updatedUser = await this.usersModel.findOneAndUpdate(
      { email },
      {
        $set: {
          'businessProfile.isApproved': true,
          'businessProfile.approvedDate': new Date(),
        },
      },
      { new: true }
    );

    // -----------------------------
    // 🟩 GHL AFFILIATE → APPROVED
    // -----------------------------
    try {
      if (updatedUser.role === USER_ROLES.AFFILIATE) {
        const ghlContactId =
          updatedUser.ghlContactId ||
          (await this.ghlService.createOrUpdateContact({
            email: updatedUser.email,
            phone: updatedUser.phoneNumber,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
          }));

        if (ghlContactId && !updatedUser.ghlContactId) {
          await this.usersModel.updateOne(
            { _id: updatedUser._id },
            { $set: { ghlContactId } },
          );
          updatedUser.ghlContactId = ghlContactId;
        }

        let oppId = updatedUser.ghlAffiliateOpportunityId;

        // 1️⃣ Create opportunity if missing
        if (!oppId && ghlContactId) {
          oppId = await this.ghlService.createOpportunity(
            ghlContactId,
            GHL_PIPELINES.AFFILIATES,
            { name: `${updatedUser.firstName} ${updatedUser.lastName}` } // ✅ extra object only
          );

          if (oppId) {
            // Move stage to NEW_APPLICATION separately
            await this.ghlService.moveStage(
              oppId,
              GHL_STAGES.AFFILIATES.NEW_APPLICATION,
            );

            await this.usersModel.updateOne(
              { _id: updatedUser._id },
              { $set: { ghlAffiliateOpportunityId: oppId } },
            );
            updatedUser.ghlAffiliateOpportunityId = oppId;
          }
        }

        // 2️⃣ Move stage → APPROVED
        if (updatedUser.ghlAffiliateOpportunityId) {
          await this.ghlService.moveStage(
            updatedUser.ghlAffiliateOpportunityId,
            GHL_STAGES.AFFILIATES.APPROVED,
          );
        }
      }
    } catch (err) {
      console.error(
        '⚠️ GHL approveBusinessProfileByEmailOnly ERROR:',
        err?.message || err,
      );
    }

    return { success: true, data: new UserDto(updatedUser) };
  } catch (err) {
    return { success: false, error: err?.message || 'Unexpected error' };
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
  const skip = parseInt(params.skip, 10) || 0;
  const limit = paginationLimit; // keep your existing constant
  const filter: any = { isActive: true, role: USER_ROLES.AFFILIATE };

  try {
    // Date filter (YYYY-MM-DD)
    if (params.onDate) {
      filter['createdAt'] = {
        $gte: moment(params.onDate, 'YYYY-MM-DD').toISOString(),
        $lt: moment(params.onDate, 'YYYY-MM-DD').add(1, 'day').toISOString(),
      };
    }

    // Zip filter (nearby coverage)
    if (params.zipCode) {
      filter['businessProfile.nearByZipCodes'] = params.zipCode;
    }

    // NEW: status filter (pending | approved | rejected)
    if (params.status) {
      const status = String(params.status).toLowerCase();
      if (status === 'approved') {
        // Back-compat: either explicit APPROVED, or legacy flag true
        filter.$or = [
          { affiliateStatus: 'APPROVED' },
          { 'businessProfile.isApproved': true },
        ];
      } else if (status === 'rejected' || status === 'denied') {
        filter.affiliateStatus = 'DENIED';
      } else if (status === 'pending') {
        // Pending or not yet migrated docs (no affiliateStatus field)
        filter.$or = [
          { affiliateStatus: 'PENDING' },
          { affiliateStatus: { $exists: false } },
        ];
      }
      // If an unknown status is provided, we ignore it to avoid breaking queries.
    }

    // Optional: simple text search over name/email (kept minimal)
    if (params.search) {
      const q = String(params.search).trim();
      if (q) {
        filter.$and = (filter.$and || []).concat([
          {
            $or: [
              { firstName: { $regex: q, $options: 'i' } },
              { lastName: { $regex: q, $options: 'i' } },
              { email: { $regex: q, $options: 'i' } },
              { phoneNumber: { $regex: q, $options: 'i' } },
            ],
          },
        ]);
      }
    }

    // Sorting (defaults to newest first)
    const sortBy = params.sortBy || 'createdAt';
    const sortDir = params.sortDir === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortDir };

    const count = await this.usersModel.countDocuments(filter);

    const users = await this.usersModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sort);

    const result = users.map((u) => new UserDto(u));

    return { result, count, skip };
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
    console.log('📩 Starting reportUser');
    console.log('➡️ Reporting User ID:', reportingUserId);
    console.log('➡️ Report Data:', reportData);
    console.log('➡️ Reporting User:', user);

    if (!reportData || !reportData.message) {
      console.warn('⚠️ Invalid reportData received:', reportData);
      throw new BadRequestException('Invalid Data');
    }

    const admin = await this.getAdmin();
    console.log('✅ Fetched Admin:', admin?.email);

    const reportedUser = await this.getUserById(reportingUserId);
    console.log('✅ Fetched Reported User:', reportedUser?.email || reportedUser?.id);

    if (!admin || !admin.email) {
      throw new Error('❌ Admin email not found');
    }

    console.log('📨 Sending report email...');
    await sendTemplateEmail(admin.email, MAIL_TEMPLATES.REPORT_USER, {
      reportingUser: user,
      reportedUser,
      message: reportData.message,
    });
    console.log('✅ Email sent successfully to admin');
  } catch (err) {
    console.error('🔥 Error in reportUser():', err);
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
    console.log(userData);

    if (!userData) {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }

    const res = new UserDto(userData);
    res['token'] = await generateToken(res);
    return res;
  } catch (err) {
    throw err;
  }
}
}
