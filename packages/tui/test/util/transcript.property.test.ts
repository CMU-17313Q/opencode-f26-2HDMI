import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { formatTranscript, type MessageWithParts, type SessionInfo } from "../../src/util/transcript"
import type { AssistantMessage, UserMessage } from "@opencode-ai/sdk/v2"

const session: SessionInfo = {
  id: "ses_property",
  title: "Property test session",
  time: { created: 1_000_000, updated: 1_000_100 },
}

const options = { thinking: false, toolDetails: false, assistantMetadata: false }

const transcriptCase = fc
  .uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 2, maxLength: 20 })
  .chain((tokens) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: 10 }),
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: tokens.length - 2, maxLength: tokens.length - 2 }),
        fc.shuffledSubarray(tokens.map((_, index) => index), {
          minLength: tokens.length,
          maxLength: tokens.length,
        }),
      )
      .map(([tieTime, laterTimes, order]) => {
        const generated = tokens.map((token, index) => {
          const id = `msg_${token}`
          const marker = `[[marker_${index}_end]]`
          const created = index < 2 ? tieTime : laterTimes[index - 2]!
          const info: UserMessage = {
            id,
            sessionID: session.id,
            role: "user",
            agent: "build",
            model: { providerID: "test", modelID: "test" },
            time: { created },
          }
          return {
            id,
            marker,
            created,
            message: {
              info,
              parts: [
                {
                  id: `part_${index}`,
                  sessionID: session.id,
                  messageID: id,
                  type: "text" as const,
                  text: marker,
                },
              ],
            } satisfies MessageWithParts,
          }
        })

        return {
          messages: order.map((index) => generated[index]!.message),
          expectedMarkers: generated
            .toSorted((left, right) => left.created - right.created || left.id.localeCompare(right.id))
            .map((item) => item.marker),
        }
      }),
  )

const toolDetailsCase = fc
  .tuple(fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/), fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/))
  .map(([inputToken, outputToken]) => {
    const inputMarker = `INPUT_DETAIL_${inputToken}_END`
    const outputMarker = `OUTPUT_DETAIL_${outputToken}_END`
    const info: AssistantMessage = {
      id: "msg_tool",
      sessionID: session.id,
      role: "assistant",
      agent: "build",
      modelID: "test-model",
      providerID: "test-provider",
      mode: "",
      parentID: "msg_parent",
      path: { cwd: "/test", root: "/test" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1_000, completed: 1_500 },
    }
    const message: MessageWithParts = {
      info,
      parts: [
        {
          id: "part_tool",
          sessionID: session.id,
          messageID: info.id,
          type: "tool",
          callID: "call_tool",
          tool: "bash",
          state: {
            status: "completed",
            input: { command: inputMarker },
            output: outputMarker,
            title: "Run generated command",
            metadata: {},
            time: { start: 1_100, end: 1_200 },
          },
        },
      ],
    }
    return { messages: [message], inputMarker, outputMarker }
  })

describe("transcript properties", () => {
  test("R1 (Invariant): includes each message once in chronological and ID order", () => {
    fc.assert(
      fc.property(transcriptCase, ({ messages, expectedMarkers }) => {
        const output = formatTranscript(session, messages, options)
        const positions = expectedMarkers.map((marker) => {
          expect(output.split(marker).length - 1).toBe(1)
          return output.indexOf(marker)
        })

        for (let index = 1; index < positions.length; index++) {
          expect(positions[index - 1]!).toBeLessThan(positions[index]!)
        }
      }),
      { numRuns: 100 },
    )
  })

  test("R3 (Metamorphic): restoring tool details restores output and toggling hides only details", () => {
    fc.assert(
      fc.property(toolDetailsCase, ({ messages, inputMarker, outputMarker }) => {
        const withDetails = formatTranscript(session, messages, { ...options, toolDetails: true })
        const withoutDetails = formatTranscript(session, messages, { ...options, toolDetails: false })
        const restored = formatTranscript(session, messages, { ...options, toolDetails: true })

        expect(restored).toBe(withDetails)
        expect(withoutDetails).not.toBe(withDetails)
        expect(withDetails).toContain(inputMarker)
        expect(withDetails).toContain(outputMarker)
        expect(withoutDetails).not.toContain(inputMarker)
        expect(withoutDetails).not.toContain(outputMarker)
        expect(withDetails).toContain("**Tool: bash**")
        expect(withoutDetails).toContain("**Tool: bash**")
      }),
      { numRuns: 100 },
    )
  })
})