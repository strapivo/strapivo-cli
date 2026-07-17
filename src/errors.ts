export const ExitCode = {
  usage: 2,
  config: 3,
  unauthorized: 4,
  forbidden: 5,
  notFound: 6,
  validation: 7,
  conflict: 8,
  transport: 9,
  incompatibleResponse: 10,
} as const;

export type ErrorDetails = Record<string, unknown>;

export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly retryable: boolean;
  readonly details?: ErrorDetails;

  constructor(
    code: string,
    message: string,
    exitCode: number,
    options: { retryable?: boolean; details?: ErrorDetails; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.retryable = options.retryable ?? false;
    if (options.details !== undefined) this.details = options.details;
  }

  asJson(): { error: { code: string; message: string; retryable: boolean; details?: ErrorDetails } } {
    const error: {
      code: string;
      message: string;
      retryable: boolean;
      details?: ErrorDetails;
    } = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };

    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) return error;

  if (error instanceof Error) {
    return new CliError("unexpected_error", error.message, ExitCode.transport, { cause: error });
  }

  return new CliError("unexpected_error", "An unexpected error occurred", ExitCode.transport);
}
