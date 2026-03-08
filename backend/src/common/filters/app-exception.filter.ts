import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppError } from '../errors';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const requestId = randomUUID();

    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (
      !(exception instanceof AppError) &&
      !(exception instanceof HttpException)
    ) {
      console.error('Unhandled exception:', exception);
    }

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = 'HTTP_ERROR';
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null && 'message' in resp) {
        const msgs = (resp as Record<string, unknown>).message;
        message = Array.isArray(msgs) ? msgs.join('; ') : String(msgs);
      } else {
        message = exception.message;
      }
    }

    const body = {
      error: { code, message },
      meta: { requestId, timestamp: new Date().toISOString() },
    };

    // Fastify response: has .status().send() with code() method
    if (typeof response.code === 'function') {
      response.code(statusCode).send(body);
    } else {
      // Express response: has .status().json()
      response.status(statusCode).json(body);
    }
  }
}
