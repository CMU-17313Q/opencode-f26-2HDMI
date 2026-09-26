import { describe, expect, test } from "bun:test"
import { SessionErrorMessage } from "../src/session/error-message"
import { SessionV1 } from "../src/v1/session"

describe("session error message", () => {
  test("returns actionable guidance for context overflow without provider details", () => {
    const error = new SessionV1.ContextOverflowError({
      message: "provider raw message",
      responseBody: "sensitive provider response",
    }).toObject()

    expect(SessionErrorMessage.userFacingErrorMessage(error)).toBe(
      "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.",
    )
  })

  test("leaves generic errors to caller formatting", () => {
    expect(SessionErrorMessage.userFacingErrorMessage({ name: "APIError", data: { message: "Request failed" } })).toBe(
      undefined,
    )
  })
})