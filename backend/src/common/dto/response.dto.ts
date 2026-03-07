export class ResponseMeta {
  requestId: string;
  timestamp: string;
}

export class SuccessResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export class ErrorDetail {
  field?: string;
  issue?: string;
}

export class ErrorBody {
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export class ErrorResponse {
  error: ErrorBody;
  meta: ResponseMeta;
}
