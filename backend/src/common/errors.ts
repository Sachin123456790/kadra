export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found${id ? `: ${id}` : ''}`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
    this.name = 'ConflictError';
  }
}

export class ExternalDependencyError extends AppError {
  constructor(service: string, message: string) {
    super('EXTERNAL_DEPENDENCY_ERROR', `${service}: ${message}`, 503);
    this.name = 'ExternalDependencyError';
  }
}
