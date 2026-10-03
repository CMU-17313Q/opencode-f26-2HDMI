import { describe, expect, test } from "bun:test"
import { errorData, errorFormat, errorMessage } from "../../src/util/error"

describe("util.error", () => {
  test("formats native Error instances", () => {
    const err = new Error("boom")
    expect(errorMessage(err)).toBe("boom")
    expect(errorFormat(err)).toContain("boom")

    const data = errorData(err)
    expect(data.type).toBe("Error")
    expect(data.message).toBe("boom")
    expect(String(data.formatted)).toContain("boom")
  })

  test("extracts message from record-like values", () => {
    const err = { message: "bad input", code: "E_BAD" }
    expect(errorMessage(err)).toBe("bad input")

    const data = errorData(err)
    expect(data.message).toBe("bad input")
    expect(data.code).toBe("E_BAD")
  })

  test("formats context overflow without provider details", () => {
    expect(errorMessage({ name: "ContextOverflowError", data: { message: "raw", responseBody: "private" } })).toBe(
      "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.",
    )
  })

  test("formats context overflow Error instances without provider details", () => {
    const err = new Error("prompt is too long: 250000 tokens > 200000 maximum")
    err.name = "ContextOverflowError"

    expect(errorMessage(err)).toBe(
      "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.",
    )
  })

  test("formats context overflow without a data payload", () => {
    expect(errorMessage({ name: "ContextOverflowError" })).toBe(
      "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.",
    )
  })

  test("keeps generic named session errors on their own message", () => {
    expect(errorMessage({ name: "APIError", data: { message: "Rate limit exceeded", isRetryable: true } })).toBe(
      "Rate limit exceeded",
    )
    expect(errorMessage({ name: "ProviderAuthError", data: { providerID: "openai", message: "Invalid key" } })).toBe(
      "Invalid key",
    )
  })

  test("never returns overflow guidance for unrelated values", () => {
    expect(errorMessage("ContextOverflowError")).toBe("ContextOverflowError")
    expect(errorMessage(null)).toBe("null")
    expect(errorMessage(undefined)).toBe("undefined")
  })

  test("never returns bare {} for opaque object errors", () => {
    expect(errorFormat({})).not.toBe("{}")
    expect(errorFormat({})).toContain("no message")

    class OpaqueError {}
    const opaque = new OpaqueError()
    Object.defineProperty(opaque, "secret", { value: "hidden", enumerable: false })
    expect(errorFormat(opaque)).not.toBe("{}")
    expect(errorFormat(opaque)).toContain("OpaqueError")
  })

  test("handles opaque throwables with custom toString", () => {
    const err = {
      toString() {
        return "ResolveMessage: Cannot resolve module"
      },
    }

    expect(errorMessage(err)).toBe("ResolveMessage: Cannot resolve module")

    const data = errorData(err)
    expect(data.message).toBe("ResolveMessage: Cannot resolve module")
    expect(String(data.formatted)).toContain("ResolveMessage")
  })
})
