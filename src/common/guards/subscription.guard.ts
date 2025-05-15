import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { checkCustomerPermissions } from '../../util/checkCustomerPermissions';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const { serviceType } = req.body; // 'SELL', 'REMOVE', etc.

    const { allowed, reason } = checkCustomerPermissions(user, serviceType);
    if (!allowed) {
      throw new ForbiddenException(reason);
    }

    return true;
  }
}
