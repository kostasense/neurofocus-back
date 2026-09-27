import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

class TokenExpiredException extends HttpException {
  constructor() {
    super(
      {
        success: false,
        statusCode: 401,
        message: 'Access token expired',
        error: 'TOKEN_EXPIRED',
        requiresRefresh: true,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

class InvalidTokenException extends HttpException {
  constructor() {
    super(
      {
        success: false,
        statusCode: 401,
        message: 'Invalid or missing token',
        error: 'UNAUTHORIZED',
        requiresLogin: true,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    info: { name?: string } | any,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new TokenExpiredException();
      }

      throw new InvalidTokenException();
    }

    return user;
  }
}