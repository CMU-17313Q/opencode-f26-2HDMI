# User Guide

Draft, for my part only (iibrohim). This file covers only Issue #15 and was written while the PR was in review. The final team version is in UserGuide.md.

## Friendly context-overflow error in the TUI conversation view

Issue: [#15](https://github.com/CMU-17313Q/opencode-f26-2HDMI/issues/15) (User Story 2, depends on Issue #12)

### What it does

When a prompt is larger than the selected model's context window, the provider rejects it with a long raw error, often including the full JSON response body. Before this change, the TUI could show that raw provider text in the red error panel under the assistant message.

The conversation view now shows this message for any assistant message whose error is a `ContextOverflowError`:

```
Your prompt is too large for this model's context window. Try shortening the conversation or starting a new session, then send the prompt again.
```

- The raw provider message and response body are never shown in the conversation panel.
- All other errors, such as rate limits or auth failures, are displayed exactly as before.
- Interrupted (aborted) messages still show no error panel.
- The message wraps at word boundaries, so it stays readable in narrow terminals.

### How to use it

There is nothing to configure. Use the TUI as usual (`bun dev` from the repository root, or `opencode`). If a prompt overflows the model's context, the assistant message shows the message above. To recover, do one of these:

1. Start a new session (`/new`), or
2. Compact or shorten the conversation (`/compact`), or remove large attached files, then
3. Send the prompt again.

### How to user test it

1. Start the TUI and choose a model with a small context window. A small local model through Ollama or LM Studio works well, because you can set a small context such as 2–4k tokens.
2. Paste a very large prompt that is well over that limit, for example the contents of a large source file repeated several times, and send it.
3. Check the assistant message in the conversation:
   - It shows a red-bordered panel with the actionable message above.
   - It does **not** show provider text such as `prompt is too long: … tokens` or any JSON body.
4. Resize the terminal to about 40 columns. The message should wrap onto several lines without splitting words.
5. Regression check: use an invalid API key (or trigger any other provider error) and confirm the panel still shows that error's original message, not the overflow message.
6. Regression check: send a prompt and press `Esc` to interrupt it. No error panel should appear, only the `· interrupted` footer.

### Automated tests

| File                                                                                                                       | What it tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`packages/tui/test/cli/tui/assistant-message-error.test.tsx`](packages/tui/test/cli/tui/assistant-message-error.test.tsx) | Renders the real `AssistantMessageError` component used by the conversation view with OpenTUI's `testRender`. It checks that: (1) a `ContextOverflowError` renders the actionable message; (2) the raw provider message and response body never appear in the rendered frame; (3) an overflow error with an empty provider message still renders the message without crashing; (4) a generic `APIError` still renders its own message; (5) aborted messages and messages with no error render nothing; (6) at 40 columns the message wraps over several lines, no line is wider than the terminal, and no word is split. |
| [`packages/tui/test/util/error.test.ts`](packages/tui/test/util/error.test.ts)                                             | Unit tests for the `errorMessage()` helper that the panel uses. They cover serialized overflow errors, `Error` instances named `ContextOverflowError`, overflow errors without a `data` payload, generic named session errors (`APIError`, `ProviderAuthError`) keeping their own messages, and non-object values (`"ContextOverflowError"` string, `null`, `undefined`) that should never get the overflow message.                                                                                                                                                                                                     |
| [`packages/core/test/session-error-message.test.ts`](packages/core/test/session-error-message.test.ts)                     | (From Issue #12) The shared `SessionErrorMessage.userFacingErrorMessage()` helper returns the message for overflow errors and `undefined` for everything else.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Run them from the package directories:

```bash
cd packages/tui && bun test test/cli/tui/assistant-message-error.test.tsx test/util/error.test.ts
```

**Why these tests are sufficient:** Each acceptance criterion of Issue #15 maps to at least one test against the real implementation, with no mocks:

- _Actionable message in the conversation panel_ → render tests 1 and 3.
- _Raw provider messages and response bodies hidden_ → render test 2.
- _Generic errors keep the existing `errorMessage()` behavior_ → render test 4 and the generic-error unit tests.
- _Failed messages do not crash the app_ → render tests 3 and 5, plus the unit tests for missing `data`, `null`, and `undefined`.
- _Readable on narrow terminals_ → render test 6. I confirmed this test fails when the panel is switched to character wrapping, so it really does catch broken wrapping.

The render tests use the same component the session route mounts, so a regression in either the formatting helper or the panel markup will fail a test.
