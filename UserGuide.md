# OpenCode — User Guide

This guide provides instructions for using and testing the features developed by our team as part of the Software Engineering project.

## User Story 1: AI Involvement Summary

This feature allows users to review the scope of AI involvement in a coding session, including the files and line ranges modified by OpenCode.

*Feature usage and user-testing instructions will be added by the responsible team members.*

---

## User Story 2: Actionable Context-Overflow Errors

### What Is a Context-Window Error?

Every AI model has a limit on how much information it can process at once, including your prompt and previous conversation history. This is called its **context window**.

If your conversation or prompt exceeds this limit, the AI provider may reject the request.

OpenCode recognizes this type of error and displays a helpful message explaining what happened and how to continue.

### What Will I See?

If your prompt exceeds the model's context window, OpenCode displays:

> Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.

Instead of displaying confusing technical information from the AI provider, OpenCode gives you steps you can take to resolve the problem.

When OpenCode is not focused and system notifications are enabled, you may also receive a shorter notification:

> Prompt exceeds model context. Shorten the conversation or start a new session.

This notification provides the same guidance in a more concise format, making it easier to understand what happened without returning to the conversation immediately.

### What Should I Do?

If you encounter this message:

1. **Shorten your prompt.** Remove unnecessary details or split a large request into smaller parts.
2. **Start a new session.** If the conversation has become very long, starting a new session can reduce the amount of context being sent to the model.
3. **Try again.** Resubmit your shortened request or continue in the new session.

### How Can I Test This Feature?

1. Launch OpenCode and connect an AI provider.
2. Start a conversation and submit prompts as usual.
3. If the provider rejects a request because it exceeds the model's context window, check that OpenCode displays the actionable message above.
4. Follow the suggested steps and try sending your request again.

If system notifications are enabled, you can also check the notification generated when a context-window error occurs. When OpenCode is not focused, the notification should display the shorter message shown above, without including raw provider error details.

**Note:** Context-window limits vary by model, so this error may not occur during ordinary use. You do not need to deliberately exceed the limit to use this feature.

### Testing in the Terminal UI (Issue #15)

In the terminal UI, the message appears in the red error panel under the assistant message that failed. To check it:

1. Start the TUI and pick a model with a small context window. A local model through Ollama or LM Studio with a 2–4k token context works well.
2. Paste a prompt that is well over that limit and send it.
3. Check that the red-bordered panel under the assistant message shows the actionable message, and no provider text such as `prompt is too long: … tokens` or a JSON response body.
4. Resize the terminal to about 40 columns. The message should wrap over several lines without splitting words.
5. Trigger a different error (for example, an invalid API key) and confirm the panel still shows that error's own message.
6. Send a prompt and press `Esc` to interrupt it. No error panel should appear.

### Developer Testing Notes

The context-overflow feature was implemented across several issues, covering error recognition (issue 11), user-facing guidance (issue 12), and system notifications (issue 16). The relevant automated tests are listed below.

**Issue #11 — Error recognition:**
- `packages/llm/test/provider-error.test.ts` — Checks that context-window errors are recognized without confusing them with unrelated provider errors.
- `packages/opencode/test/session/message-v2.test.ts` — Checks that provider errors are converted into the correct session error type.
- `packages/opencode/test/session/retry.test.ts` — Checks that context-overflow errors are not automatically retried.

**Issue #12 — User-facing guidance:**
- `packages/core/test/session-error-message.test.ts` — Checks the shared guidance message and ensures raw provider details are not displayed.
- `packages/opencode/test/cli/error.test.ts` — Checks CLI error formatting.
- `packages/opencode/test/cli/run/session-data.test.ts` — Checks CLI session-data handling.
- `packages/opencode/test/cli/run/stream.transport.test.ts` — Checks CLI streaming error handling.
- `packages/tui/test/util/error.test.ts` — Checks TUI error formatting.

**Issue #15 — TUI conversation view:**
- `packages/tui/test/cli/tui/assistant-message-error.test.tsx` — Renders the real error panel used by the conversation view. Checks that a context-overflow error shows the actionable message, that the raw provider message and response body never appear on screen, that an overflow error with an empty provider message still renders without crashing, that generic errors keep their own message, that aborted messages and messages without an error show no panel, and that at 40 columns the message wraps without splitting words.
- `packages/tui/test/util/error.test.ts` — Adds `errorMessage()` cases for overflow `Error` instances, overflow errors without a `data` payload, generic named errors such as `APIError` and `ProviderAuthError`, and plain strings, `null`, and `undefined`.

Each Issue #15 acceptance criterion maps to at least one of these tests, and they use the real component with no mocks. The narrow-terminal test fails if the panel is switched to character wrapping, so it catches broken wrapping.

**Issue #16 — System notifications:**

- `packages/tui/test/cli/cmd/tui/notifications.test.ts` — Checks that context-overflow session errors produce the exact short notification without exposing provider messages or response bodies. Existing tests also verify that generic session errors and other notification behaviors remain unchanged.

Together, these tests cover error recognition, conversation and notification message presentation, and the handling of unrelated errors. They exercise the relevant error-handling and notification paths directly, providing coverage of the main acceptance criteria without depending on a live provider to produce a context-window error.

## User Story 3: Tutor Mode in Opencode (Not part of Sprint 1 - extra bonus feature under development) 

Issue: [#31](https://github.com/CMU-17313Q/opencode-f26-2HDMI/issues/31), PR [#36](https://github.com/CMU-17313Q/opencode-f26-2HDMI/pull/36)

### What it does
In the desktop app, the agent switcher in the composer lists Learn as **Learn (tutor)** with its own color, so students can tell the tutor apart from build and plan. Students switch back to `build` from the same dropdown.

### How to user test it
1. Run the desktop app and open a session.
2. Open the agent switcher next to the prompt box. **Learn (tutor)** is listed next to build and plan.
3. Select it and send a prompt. The agent label uses the Learn color in light and dark mode.
4. Select `build` again and confirm the next prompt uses build.

### Automated tests
- **`packages/app/src/utils/agent.test.ts`** checks that `agentLabel` labels Learn as a tutor and leaves other agents unchanged, and that `agentColor` gives Learn its own color for any letter case.
- **`packages/app/src/i18n/parity.test.ts`** checks the new label exists in every locale.
These cover the new logic. Listing and switching agents reuse unchanged code

### Learn Mode Is Read-Only (Issue #29)

Issue: [#29](https://github.com/CMU-17313Q/opencode-f26-2HDMI/issues/29), PR [#35](https://github.com/CMU-17313Q/opencode-f26-2HDMI/pull/35)

**What it does:** Learn is a tutor, so it helps students reason through a problem instead of changing their code. It follows the same read-only pattern as `plan`:

- **Edits are denied everywhere.** The `edit`, `write`, and `apply_patch` tools are hidden while Learn is selected.
- **No plan-file exception.** Unlike `plan`, Learn cannot write `.opencode/plans/*.md` either.
- **No delegating edits.** Learn cannot launch the `general` subagent, which can edit files. The read-only `explore` subagent is still allowed.
- **Reading still works.** Learn can read files, search with `grep`/`glob`, and ask questions. Reading `.env` files still asks for permission first.
- **Other agents are unchanged.** `build` keeps full edit permissions and `plan` keeps its plan-file exception, so switching back to Build restores editing right away.

To let Learn edit anyway, add `"agent": { "learn": { "permission": { "edit": "allow" } } }` to your `opencode.json`.

**How to user test it:**
1. Start the TUI and press `Tab` until the prompt footer shows **Learn** (or pick **Learn (tutor)** in the desktop agent switcher).
2. Ask: _"Fix the bug in `src/index.ts` and save the file."_ Learn should explain or hint at the fix without editing, and `git status` should show no changes.
3. Ask: _"Write your plan to `.opencode/plans/plan.md`."_ No file should be created.
4. Ask: _"Find every place `parseConfig` is called."_ Learn should search and read files normally.
5. Switch back to **Build** and ask for the same fix. Build should edit the file as usual.

**Automated tests:**
- **`packages/opencode/test/agent/agent.test.ts`** loads the real agent service and checks Learn's permissions: edits are denied on every file, including `.opencode/plans/*.md`; exactly `edit`, `write`, and `apply_patch` are hidden; `read`, `grep`, and `glob` are allowed and `.env` still asks; the `general` subagent is denied and `explore` is allowed; `build` still edits and `plan` keeps its exception; and per-agent config can re-enable edits.
- **`packages/core/test/agent.test.ts`** checks the same rules for Learn, `build`, and `plan` in the V2 agent plugin.

Each Issue #29 acceptance criterion maps to at least one of these tests, in both the V1 (`packages/opencode`) and V2 (`packages/core`) agent setups. Reverting the permission change makes the new deny tests fail.

