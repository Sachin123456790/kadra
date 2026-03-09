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
    let message =
      exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred';

    // Always log full error details for debugging
    console.error('Exception caught:', {
      type: exception?.constructor?.name,
      message:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    });

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
