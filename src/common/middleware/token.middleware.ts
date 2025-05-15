import { UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { API_MESSAGES } from '../../config';
import { getDecodedToken } from '../../util/auth';

export function tokenMiddleware(req, res: Response, next: Function) {
    try {
        if (req.headers && req.headers.token) {
            const user = getDecodedToken(req.headers.token);
            if (user) {
                req['user'] = user;
                next();
            } else {
                throw new UnauthorizedException(API_MESSAGES.TOKEN_EXPIRED);
            }
        } else {
            throw new UnauthorizedException();
        }
    } catch (error) {
        throw error;
    }
};