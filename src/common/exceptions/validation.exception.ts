import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(message: string, errors?: string[]) {
    super(
      {
        success: false,
        message,
        error: 'Error de validación',
        errors,
        timestamp: new Date().toISOString(),
        statusCode: HttpStatus.BAD_REQUEST,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
