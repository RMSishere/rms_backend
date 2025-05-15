import { ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { API_MESSAGES } from '../../config';

export function isPhoneNumberVerifiedMiddleware(req, res: Response, next: Function) {
  try {
    if (req.user.isMobileVerfied) {
      return next();
    } else {
      throw new ForbiddenException(API_MESSAGES.PHONE_UNVERIFIED);
    }
  } catch (error) {
    throw error;
  }
};