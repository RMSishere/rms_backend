import { UnauthorizedException } from '@nestjs/common';
import { API_MESSAGES } from '../config';
import jwt = require('jsonwebtoken');
import { JwtPayload } from 'jsonwebtoken';

const jwtExpirySeconds = '50 days';
const jwtSecretKey = process.env.JWT_SECRET_KEY;

// Payload type
export interface AppJwtPayload extends JwtPayload {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  isMobileVerfied?: boolean;
  isEmailVerified?: boolean;
}

export const generateToken = user => {
  const token = jwt.sign(
    {
      _id: user._id,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isMobileVerfied: user.isMobileVerfied,
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phoneNumber,
    },
    jwtSecretKey,
    { algorithm: 'HS256', expiresIn: jwtExpirySeconds },
  );
  return token;
};

export const generateUserVerificationToken = user => {
  const token = jwt.sign(
    {
      _id: user._id,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isUserVerified: true,
    },
    jwtSecretKey,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  return token;
};

export const getDecodedToken = (token: string): AppJwtPayload => {
  try {
    if (!token) {
      throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
    }

    const decoded = jwt.verify(token, jwtSecretKey) as string | AppJwtPayload;

    if (typeof decoded === 'string' || !decoded.id) {
      throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
    }

    return decoded;
  } catch (err) {
    throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
  }
};
