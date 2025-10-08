import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        success: false,
        message,
        error: 'Error de negocio',
        timestamp: new Date().toISOString(),
        statusCode,
      },
      statusCode,
    );
  }
}
