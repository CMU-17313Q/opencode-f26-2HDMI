import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { formatTranscript, type MessageWithParts, type SessionInfo } from "../../src/util/transcript"
import type { AssistantMessage, Part, UserMessage } from "@opencode-ai/sdk/v2"

const session: SessionInfo = {
  id: "ses_property",
  title: "Property test session",
  time: { created: 1_000_000, updated: 1_000_100 },
}

const options = { thinking: false, toolDetails: false, assistantMetadata: false }

// Generate unique messages with shuffled input order and timestamp ties
// to test completeness, chronological sorting, and ID tie-breaking.
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

// Generate nonempty tool input/output markers so toggling toolDetails
// produces an observable change and restoring it can be verified.
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

// Vary four distinct nonempty markers so completed input/output and failed
// input/error are independently observable under both toolDetails settings.
const toolStatesCase = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/),
    fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/),
    fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/),
    fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/),
  )
  .map(([completedInputToken, completedOutputToken, failedInputToken, errorToken]) => {
    const info: AssistantMessage = {
      id: "msg_tool_states",
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
    const markers = {
      completedInput: `R2_COMPLETED_INPUT_${completedInputToken}_END`,
      completedOutput: `R2_COMPLETED_OUTPUT_${completedOutputToken}_END`,
      failedInput: `R2_FAILED_INPUT_${failedInputToken}_END`,
      error: `R2_ERROR_${errorToken}_END`,
    }
    const parts: Part[] = [
      {
        id: "part_completed",
        sessionID: session.id,
        messageID: info.id,
        type: "tool",
        callID: "call_completed",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: markers.completedInput },
          output: markers.completedOutput,
          title: "Run command",
          metadata: {},
          time: { start: 1_100, end: 1_200 },
        },
      },
      {
        id: "part_failed",
        sessionID: session.id,
        messageID: info.id,
        type: "tool",
        callID: "call_failed",
        tool: "read",
        state: {
          status: "error",
          input: { path: markers.failedInput },
          error: markers.error,
          time: { start: 1_300, end: 1_400 },
        },
      },
    ]
    return { messages: [{ info, parts }], markers }
  })

// Generate distinct markers for ordinary text and each optional category so
// the reduced-detail comparison cannot pass when generated content is absent.
const reducedDetailCase = fc
  .uniqueArray(fc.stringMatching(/^[a-zA-Z0-9]{1,16}$/), { minLength: 6, maxLength: 6 })
  .map(([firstToken, secondToken, reasoningToken, inputToken, outputToken, modelToken]) => {
    const firstText = `R4_ORDINARY_FIRST_${firstToken}_END`
    const secondText = `R4_ORDINARY_SECOND_${secondToken}_END`
    const reasoning = `R4_REASONING_${reasoningToken}_END`
    const toolInput = `R4_TOOL_INPUT_${inputToken}_END`
    const toolOutput = `R4_TOOL_OUTPUT_${outputToken}_END`
    const modelID = `R4_MODEL_${modelToken}_END`
    const firstInfo: UserMessage = {
      id: "msg_user_first",
      sessionID: session.id,
      role: "user",
      agent: "build",
      model: { providerID: "test-provider", modelID: "test-model" },
      time: { created: 1_000 },
    }
    const assistantInfo: AssistantMessage = {
      id: "msg_assistant",
      sessionID: session.id,
      role: "assistant",
      agent: "build",
      modelID,
      providerID: "test-provider",
      mode: "",
      parentID: firstInfo.id,
      path: { cwd: "/test", root: "/test" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 2_000, completed: 2_500 },
    }
    const messages: MessageWithParts[] = [
      {
        info: firstInfo,
        parts: [
          {
            id: "part_text_first",
            sessionID: session.id,
            messageID: firstInfo.id,
            type: "text",
            text: firstText,
          },
        ],
      },
      {
        info: assistantInfo,
        parts: [
          {
            id: "part_text_second",
            sessionID: session.id,
            messageID: assistantInfo.id,
            type: "text",
            text: secondText,
          },
          {
            id: "part_reasoning",
            sessionID: session.id,
            messageID: assistantInfo.id,
            type: "reasoning",
            text: reasoning,
            time: { start: 2_100 },
          },
          {
            id: "part_reduced_tool",
            sessionID: session.id,
            messageID: assistantInfo.id,
            type: "tool",
            callID: "call_reduced_tool",
            tool: "bash",
            state: {
              status: "completed",
              input: { command: toolInput },
              output: toolOutput,
              title: "Run generated tool",
              metadata: {},
              time: { start: 2_200, end: 2_300 },
            },
          },
        ],
      },
    ]
    return { messages, firstText, secondText, reasoning, toolInput, toolOutput, modelID }
  })


describe("transcript properties", () => {
  // R1 — Invariant
  // Requirement: The export feature should preserve all conversation messages
  // in chronological order.
  // Property: Every generated message appears exactly once, ordered by
  // creation timestamp and message ID for ties.
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

  // R3 — Metamorphic
  // Requirement: Re-enabling an export option shall restore the same exported
  // information for an unchanged conversation.
  // Property: Tool details ON → OFF → ON restores identical output;
  // optional tool details are hidden only while the option is OFF.
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

  // R2 — Invariant
  // Requirement: Users should be able to choose whether tool execution
  // details, including available failure information, are included.
  // Property: Both tool labels remain, while available details appear only
  // when toolDetails is enabled.
  test("R2 (Invariant): shows completed and failed tool details only when enabled", () => {
    fc.assert(
      fc.property(toolStatesCase, ({ messages, markers }) => {
        const withDetails = formatTranscript(session, messages, { ...options, toolDetails: true })
        const withoutDetails = formatTranscript(session, messages, { ...options, toolDetails: false })

        for (const marker of Object.values(markers)) {
          expect(withDetails).toContain(marker)
          expect(withoutDetails).not.toContain(marker)
        }
        expect(withDetails).toContain("**Tool: bash**")
        expect(withDetails).toContain("**Tool: read**")
        expect(withoutDetails).toContain("**Tool: bash**")
        expect(withoutDetails).toContain("**Tool: read**")
      }),
      { numRuns: 100 },
    )
  })

  // R4 — Metamorphic
  // Requirement: A reduced-detail Markdown transcript excludes optional
  // reasoning, tool details, and assistant metadata while preserving text.
  // Property: Disabling those settings removes only optional content and
  // leaves each ordinary text marker once in its original order.
  test("R4 (Metamorphic): reduced detail omits optional content but preserves ordinary text", () => {
    fc.assert(
      fc.property(
        reducedDetailCase,
        ({ messages, firstText, secondText, reasoning, toolInput, toolOutput, modelID }) => {
          const detailed = formatTranscript(session, messages, {
            thinking: true,
            toolDetails: true,
            assistantMetadata: true,
          })
          const reduced = formatTranscript(session, messages, {
            thinking: false,
            toolDetails: false,
            assistantMetadata: false,
          })

          for (const output of [detailed, reduced]) {
            for (const marker of [firstText, secondText]) {
              expect(output.split(marker).length - 1).toBe(1)
            }
            expect(output.indexOf(firstText)).toBeLessThan(output.indexOf(secondText))
            expect(output).toContain("**Tool: bash**")
          }
          expect(detailed).toContain(reasoning)
          expect(detailed).toContain(toolInput)
          expect(detailed).toContain(toolOutput)
          expect(detailed).toContain(modelID)
          expect(detailed).toContain("## Assistant (Build ·")
          expect(reduced).not.toContain(reasoning)
          expect(reduced).not.toContain(toolInput)
          expect(reduced).not.toContain(toolOutput)
          expect(reduced).not.toContain(modelID)
          expect(reduced).not.toContain("## Assistant (Build ·")
        },
      ),
      { numRuns: 100 },
    )
  })
})
