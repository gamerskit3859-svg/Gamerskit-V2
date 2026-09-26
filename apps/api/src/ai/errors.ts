/**
 * An error with an HTTP status and machine-readable code. The central
 * errorHandler already reads `status` and `code` off thrown errors, so routes
 * can throw these and still produce the usual `{ error, code }` body.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * A tool failure worth showing to Claude verbatim (bad id, ambiguous match,
 * nothing found). It goes back as a tool_result with is_error so Claude can
 * recover or ask the admin. Any other thrown error is logged and replaced with
 * a generic message so internals never reach the model.
 */
export class AiToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiToolError";
  }
}

/**
 * A confirmed action that could not be applied for a reason the admin should
 * read, e.g. the value changed since the proposal was made.
 */
export class AiActionError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "AiActionError";
  }
}
