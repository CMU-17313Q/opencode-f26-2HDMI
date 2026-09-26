import { NamedError } from "../util/error"

// Keep provider messages and response bodies out of user-facing overflow guidance.
const contextOverflowMessage =
  "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again."

export function userFacingErrorMessage(error: unknown): string | undefined {
  if (NamedError.hasName(error, "ContextOverflowError")) return contextOverflowMessage
}

export * as SessionErrorMessage from "./error-message"