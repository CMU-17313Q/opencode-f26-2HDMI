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

**Note:** Context-window limits vary by model, so this error may not occur during ordinary use. You do not need to deliberately exceed the limit to use this feature.

### Developer Testing Notes

This error classification and error message parts of the feature were implemented across Issues #11 and #12.

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

Together, these tests cover error recognition, message presentation, and the handling of unrelated errors. They test the main acceptance criteria without depending on a live provider to produce a context-window error.

## Learn shows as a tutor in the desktop agent switcher

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

These cover the new logic. Listing and switching agents reuse unchanged code.
