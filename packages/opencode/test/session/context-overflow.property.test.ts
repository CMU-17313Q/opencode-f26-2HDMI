import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { SessionErrorMessage } from "@opencode-ai/core/session/error-message"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { errorMessage } from "@opencode-ai/tui/util/error"
import { sessionErrorMessage } from "@opencode-ai/tui/feature-plugins/system/notifications"
import { FormatError } from "../../src/cli/error"
import { formatError } from "../../src/cli/cmd/run/session-data"
import { formatUnknownError } from "../../src/cli/cmd/run/stream.transport"
import { isOverflow, usable } from "../../src/session/overflow"
import type { Provider } from "../../src/provider/provider"

// Requirements: traceability/iibrohim.md (Project 4B).
const guidance =
  "Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again."

// Raw provider text. Interviewees worried about seeing raw errors (S-6, O-4), so the generator mixes
// the overflow messages real providers send (with varying token counts), JSON response bodies that
// carry request IDs and key-like secrets, HTML gateway pages, and arbitrary unicode/empty strings.
const tokens = fc.integer({ min: 1, max: 2_000_000 })
const raw = fc.oneof(
  fc.tuple(tokens, tokens).map(([a, b]) => `prompt is too long: ${a} tokens > ${b} maximum`),
  tokens.map((n) => `This model's maximum context length is ${n} tokens. Please reduce the length of the messages.`),
  fc.constantFrom(
    "Input exceeds context window of this model",
    "context_length_exceeded",
    "<html><body><h1>413 Request Entity Too Large</h1></body></html>",
  ),
  fc
    .record({
      code: fc.constantFrom("context_length_exceeded", "invalid_request_error"),
      key: fc.stringMatching(/^sk-[a-zA-Z0-9]{8,24}$/),
      request: fc.uuid(),
    })
    .map((body) => JSON.stringify({ type: "error", error: { ...body, message: "too long" } })),
  fc.string(),
  fc.string({ unit: "grapheme" }),
)

// Every shape a ContextOverflowError reaches the formatters in: the NamedError instance, its
// serialized { name, data } form from the event stream, a plain Error renamed by the SDK, a legacy
// { name, message } payload, and a bare name with no data at all.
const overflowError = fc
  .record({ message: raw, responseBody: raw })
  .chain((detail) =>
    fc.constantFrom(
      new SessionV1.ContextOverflowError(detail),
      { name: "ContextOverflowError", data: detail },
      Object.assign(new Error(detail.message), { name: "ContextOverflowError" }),
      { name: "ContextOverflowError", message: detail.message },
      { name: "ContextOverflowError" },
    ),
  )

const surfaces = {
  cli: (error: unknown) => FormatError(error),
  run: (error: unknown) => formatError(error as Parameters<typeof formatError>[0]),
  stream: (error: unknown) => formatUnknownError(error),
  tui: (error: unknown) => errorMessage(error),
  notification: (error: unknown) => sessionErrorMessage(error as Parameters<typeof sessionErrorMessage>[0]),
}

describe("context overflow properties", () => {
  // R1: When a context-overflow error occurs, the message shown to the user never includes the
  // provider's raw error text or response body.
  // Kind: invariant
  test("R1: overflow messages never leak raw provider text", () => {
    fc.assert(
      fc.property(fc.record({ message: raw, responseBody: raw }), (detail) => {
        Object.values(surfaces).forEach((surface) => {
          const shown = surface({ name: "ContextOverflowError", data: detail }) ?? ""
          // Raw text that is already part of the guidance (e.g. "" or "the") can't count as a leak.
          ;[detail.message, detail.responseBody]
            .filter((text) => !guidance.includes(text))
            .forEach((text) => expect(shown).not.toContain(text))
        })
      }),
    )
  })

  // R2: The CLI and the TUI show identical text for the same context-overflow error.
  // Kind: model / oracle. The shared SessionErrorMessage.userFacingErrorMessage is the oracle;
  // every place the CLI or TUI shows an overflow (including the TUI desktop notification) must agree with it.
  test("R2: every CLI and TUI surface shows the shared guidance", () => {
    fc.assert(
      fc.property(overflowError, (error) => {
        const oracle = SessionErrorMessage.userFacingErrorMessage(error)
        expect(oracle).toBe(guidance)
        Object.entries(surfaces).forEach(([name, surface]) => {
          expect({ surface: name, shown: surface(error) }).toEqual({ surface: name, shown: oracle })
        })
      }),
    )
  })

  // R3: The overflow message is the same no matter which provider or model caused the error, or what
  // the provider's raw text said.
  // Kind: metamorphic. Swapping the raw provider details for different ones must not change the output,
  // while renaming the error to a non-overflow error must make the guidance go away.
  test("R3: changing provider details never changes the overflow message", () => {
    const details = fc.record({
      message: raw,
      responseBody: raw,
      providerID: fc.constantFrom("openai", "anthropic", "openrouter", "google", "amazon-bedrock"),
    })
    fc.assert(
      fc.property(
        details,
        details,
        fc.constantFrom("APIError", "ProviderAuthError", "MessageOutputLengthError"),
        (a, b, other) => {
          Object.values(surfaces).forEach((surface) => {
            expect(surface({ name: "ContextOverflowError", data: a })).toBe(
              surface({ name: "ContextOverflowError", data: b }),
            )
            expect(surface({ name: other, data: a })).not.toBe(guidance)
          })
        },
      ),
    )
  })

  // Model limits. Mixes real context sizes (8K to 1M) with arbitrary ones, including 0 ("unknown"),
  // output limits around and above the context size, and an optional separate input limit, because the
  // boundary between "fits" and "overflows" is where interviewees got stopped mid-task (C-5, O-3).
  const model = fc
    .record({
      context: fc.oneof(
        fc.constantFrom(0, 8_192, 32_000, 128_000, 200_000, 1_000_000),
        fc.integer({ min: 0, max: 2_000_000 }),
      ),
      output: fc.oneof(fc.constantFrom(0, 4_096, 32_000, 64_000), fc.integer({ min: 0, max: 200_000 })),
      input: fc.option(fc.integer({ min: 1, max: 2_000_000 }), { nil: undefined }),
    })
    .map((limit) => ({ id: "m", providerID: "p", limit }) as unknown as Provider.Model)
  const cfg = {} as ConfigV1.Info
  const usage = (input: number) => ({ input, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })

  // R5 (revised): Once the conversation's reported token usage reaches the model's usable context
  // (the context limit minus room reserved for the reply), opencode flags it for automatic compaction
  // before the next prompt; below that point it is never flagged.
  // Kind: metamorphic. Adding tokens to a conversation never takes it from "flagged" back to "fits".
  test("R5: more tokens never un-flag an overflowing conversation", () => {
    fc.assert(
      fc.property(model, fc.nat({ max: 2_000_000 }), fc.nat({ max: 2_000_000 }), (model, count, extra) => {
        if (isOverflow({ cfg, model, tokens: usage(count) }))
          expect(isOverflow({ cfg, model, tokens: usage(count + extra) })).toBe(true)
      }),
    )
  })

  // R5 (revised), boundary. Kind: invariant. Just below the usable context is never flagged, at it
  // always is, and an empty conversation is never flagged.
  test("R5: compaction triggers exactly at the usable context", () => {
    fc.assert(
      fc.property(model, (model) => {
        const limit = usable({ cfg, model })
        expect(isOverflow({ cfg, model, tokens: usage(0) })).toBe(false)
        if (limit === 0) return
        expect(isOverflow({ cfg, model, tokens: usage(limit - 1) })).toBe(false)
        expect(isOverflow({ cfg, model, tokens: usage(limit) })).toBe(true)
      }),
    )
  })
})
