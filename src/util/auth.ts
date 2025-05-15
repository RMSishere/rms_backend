import { UnauthorizedException } from '@nestjs/common';
import { API_MESSAGES } from '../config';

import jwt = require('jsonwebtoken');
const jwtExpirySeconds = '50 days';

const jwtSecretKey = process.env.JWT_SECRET_KEY;

export const generateToken = user => {
  const firstName = user.firstName;
  const lastName = user.lastName;
  const email = user.email;
  const phoneNumber = user.phoneNumber;
  const role = user.role;
  const isMobileVerfied = user.isMobileVerfied;
  const isEmailVerified = user.isEmailVerified;
  const id = user.id;
  const _id = user._id;
  const token = jwt.sign(
    {
      _id,
      id,
      firstName,
      lastName,
      email,
      role,
      isMobileVerfied,
      isEmailVerified,
      phoneNumber,
    },
    jwtSecretKey,
    {
      algorithm: 'HS256',
      expiresIn: jwtExpirySeconds,
    },
  );
  return token;
};

// this temporary token will set the isUserVerified to true
// and this token can be used to update user's sensitive data like password
export const generateUserVerificationToken = user => {
  const firstName = user.firstName;
  const lastName = user.lastName;
  const email = user.email;
  const role = user.role;
  const id = user.id;
  const _id = user._id;
  const isUserVerified = true;
  const token = jwt.sign(
    { _id, id, firstName, lastName, email, role, isUserVerified },
    jwtSecretKey,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
    },
  );
  return token;
};

export const getDecodedToken = token => {
  try {
    if (!token) {
      throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
    }

    const decoded = jwt.verify(token, jwtSecretKey);
    if (decoded && decoded.id) {
      return decoded;
    } else {
      throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
    }
  } catch (err) {
    throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
  }
};
