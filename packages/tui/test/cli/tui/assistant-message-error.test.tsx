import { afterEach, describe, expect, test } from "bun:test"
import { testRender, type JSX } from "@opentui/solid"
import type { AssistantMessage } from "@opencode-ai/sdk/v2"
import { AssistantMessageError } from "../../../src/routes/session"

const overflowGuidance =
  "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again."

let testSetup: Awaited<ReturnType<typeof testRender>> | undefined

afterEach(() => {
  testSetup?.renderer.destroy()
  testSetup = undefined
})

async function renderFrame(component: () => JSX.Element, options: { width: number; height: number }) {
  testSetup = await testRender(component, options)
  await testSetup.renderOnce()
  await testSetup.renderOnce()

  return testSetup
    .captureCharFrame()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd()
}

// Drop the left border and padding so wrapped panel text can be compared as one sentence.
function panelText(frame: string) {
  return frame
    .split("\n")
    .map((line) => line.replace(/^[^A-Za-z]*/, "").trim())
    .filter(Boolean)
    .join(" ")
}

function overflowError(): AssistantMessage["error"] {
  return {
    name: "ContextOverflowError",
    data: {
      message: "prompt is too long: 250000 tokens > 200000 maximum",
      responseBody: '{"type":"error","error":{"type":"invalid_request_error","message":"secret provider body"}}',
    },
  }
}

describe("TUI assistant message error", () => {
  test("renders actionable guidance for context overflow", async () => {
    const frame = await renderFrame(() => <AssistantMessageError error={overflowError()} />, { width: 100, height: 8 })

    expect(panelText(frame)).toBe(overflowGuidance)
  })

  test("hides the raw provider message and response body", async () => {
    const frame = await renderFrame(() => <AssistantMessageError error={overflowError()} />, { width: 100, height: 8 })

    expect(frame).not.toContain("250000 tokens")
    expect(frame).not.toContain("secret provider body")
    expect(frame).not.toContain("invalid_request_error")
  })

  test("renders guidance when the overflow error has no provider message", async () => {
    const frame = await renderFrame(
      () => <AssistantMessageError error={{ name: "ContextOverflowError", data: { message: "" } }} />,
      { width: 100, height: 8 },
    )

    expect(panelText(frame)).toBe(overflowGuidance)
  })

  test("keeps generic errors on existing errorMessage formatting", async () => {
    const frame = await renderFrame(
      () => (
        <AssistantMessageError
          error={{ name: "APIError", data: { message: "Rate limit exceeded", isRetryable: true } }}
        />
      ),
      { width: 100, height: 8 },
    )

    expect(panelText(frame)).toBe("Rate limit exceeded")
    expect(frame).not.toContain("context window")
  })

  test("renders nothing for aborted messages", async () => {
    const frame = await renderFrame(
      () => <AssistantMessageError error={{ name: "MessageAbortedError", data: { message: "aborted" } }} />,
      { width: 100, height: 8 },
    )

    expect(frame).toBe("")
  })

  test("renders nothing when the message has no error", async () => {
    const frame = await renderFrame(() => <AssistantMessageError error={undefined} />, { width: 100, height: 8 })

    expect(frame).toBe("")
  })

  test("wraps guidance by word on narrow terminals", async () => {
    const width = 40
    const frame = await renderFrame(() => <AssistantMessageError error={overflowError()} />, { width, height: 16 })
    const lines = frame.split("\n").filter((line) => /[A-Za-z]/.test(line))

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((line) => line.length <= width)).toBe(true)
    expect(panelText(frame)).toBe(overflowGuidance)
  })
})
