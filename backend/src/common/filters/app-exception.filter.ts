import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { AppError } from '../errors';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = randomUUID();

    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof AppError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = 'HTTP_ERROR';
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const msgs = (response as Record<string, unknown>).message;
        message = Array.isArray(msgs) ? msgs.join('; ') : String(msgs);
      } else {
        message = exception.message;
      }
    }

    reply.status(statusCode).send({
      error: { code, message },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
}
