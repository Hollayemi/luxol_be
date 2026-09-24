
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(private logger: Logger) {}
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    this.logger.error(`HTTP Exception: ${exception.message}`, exception.stack);
    this.logger.error(`${request.method} ${request.originalUrl} ${status} error: ${exception.message} `, exception.stack);

    const errorDetails = exception.getResponse() as { message: string | string[]; error: string };

    response
      .status(status)
      .json({
        error: true,
        errorDetails: {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message: errorDetails.message,
        }
      });
  }
}
