import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export const defaultValidationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true, // Set to false to allow additional params if needed, but true is safer
  transformOptions: {
    enableImplicitConversion: true,
  },
};

/**
 * Standard ValidationPipe with common configuration
 */
export class DefaultValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      ...defaultValidationPipeOptions,
      ...options,
    });
  }
}
