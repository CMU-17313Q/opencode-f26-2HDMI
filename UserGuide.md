# OpenCode — User Guide

This guide provides instructions for using and testing the features developed by our team as part of the Software Engineering project.

## User Story 1: AI Involvement Summary

This feature allows users to review the scope of AI involvement in a coding session, including the files and line ranges modified by OpenCode.

*Feature usage and user-testing instructions will be added by the responsible team members.*

---

## User Story 2: Actionable Context-Overflow Errors

This feature helps users understand when their prompts exceed a model's context window and provides guidance on how to proceed.


### Provider Context-Overflow Classification (Issue #11)

#### Overview

OpenCode identifies when an AI provider rejects a request because the input exceeds the model's context window. These errors are classified as `ContextOverflowError` instead of generic API failures.

The classification distinguishes context-window errors from unrelated failures, such as rate limiting, quota exhaustion, server errors, and output-token limits. Context-overflow errors are also excluded from automatic retries.

#### User Testing

**Note:** This feature handles provider-error classification internally and does not introduce a standalone user interface. Therefore, its behavior cannot be directly verified through the UI alone. The resulting user-facing guidance is handled by Issue #12 and the related CLI/TUI presentation issues.

To verify this contribution independently, use the automated tests listed below. These test the classification and session-error behavior without requiring a live AI provider.

#### Automated Tests

The following automated tests are available in the repository:

- **`packages/llm/test/provider-error.test.ts`** — Verifies that input context-overflow messages are recognized while rate-limit errors are excluded. Additional regression tests added in Sprint 2 verify that output-token limits are not misclassified as context overflow and that genuine input-context errors remain recognized even when output-token information appears in the same message.

- **`packages/opencode/test/session/message-v2.test.ts`** — Verifies that structured error codes, HTTP 413, and message-only provider errors are converted into `ContextOverflowError`, while unrelated API failures retain their appropriate error types.

- **`packages/opencode/test/session/retry.test.ts`** — Verifies that context-overflow errors are not automatically retried and that existing retry behavior for other errors is preserved.

Together, these tests cover the main acceptance criteria through both positive and negative cases. They verify the classification logic and its integration with session error handling, ensuring that context-overflow errors are correctly identified without changing how unrelated provider errors are handled.


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
