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

## Learn mode is read-only (no file edits)

Issue: [#29](https://github.com/CMU-17313Q/opencode-f26-2HDMI/issues/29) (depends on the Learn agent registration)

### What it does

The `learn` agent is a tutor. It should help you reason through a problem, not change your code for you. Learn now follows the same read-only permission pattern as `plan`:

- **Edits are denied everywhere.** `edit` is denied on `*`, so the `edit`, `write`, and `apply_patch` tools are hidden from the model while you are in Learn.
- **No plan-file exception.** Unlike `plan`, Learn cannot write `.opencode/plans/*.md` either.
- **No delegating edits.** Learn cannot launch the `general` subagent, which can edit files. This closes the loophole of asking another agent to make the change. The read-only `explore` subagent is still allowed.
- **Reading still works.** Learn can still read files, search with `grep`/`glob`, and ask you questions. As in every agent, reading `.env` files asks for permission first.
- **Other agents are unchanged.** `build` keeps full edit permissions, and `plan` keeps its `.opencode/plans/*.md` exception. Each agent has its own permission set, so switching from Learn back to Build restores normal editing right away.

If you really want Learn to edit, you can opt in through config:

```json
{
  "agent": {
    "learn": { "permission": { "edit": "allow" } }
  }
}
```

### How to use it

1. Start the TUI (`bun dev` from the repository root, or `opencode`).
2. Press `Tab` (or `Shift+Tab`) until the prompt footer shows **Learn**.
3. Ask questions about your code. Learn can open and search files to explain them, but it won't modify them.
4. When you want changes made, press `Tab` to switch back to **Build**.

### How to user test it

1. In a test project, switch to **Learn** and ask: _"Fix the bug in `src/index.ts` and save the file."_
   - Expected: Learn reads the file and explains or hints at the fix. It makes no edit, and `git status` shows no changes.
2. Still in Learn, ask: _"Write your plan to `.opencode/plans/plan.md`."_
   - Expected: no file is created.
3. Still in Learn, ask: _"Use a subagent to make the change for you."_
   - Expected: it does not launch the `general` subagent to edit files.
4. Ask Learn to _"find every place `parseConfig` is called"_.
   - Expected: it searches and reads files normally.
5. Switch back to **Build** with `Tab` and ask for the same fix as in step 1.
   - Expected: Build edits the file as usual.

### Automated tests

| File                                                                                       | What it tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/opencode/test/agent/agent.test.ts`](packages/opencode/test/agent/agent.test.ts) | Loads the real agent service (no mocks) and checks the resolved `learn` permissions: (1) `edit` is denied on `*`, on a normal source file, and on `.opencode/plans/foo.md`; (2) `Permission.disabled()` hides exactly `edit`, `write`, and `apply_patch` while keeping `read`, `grep`, and `glob`; (3) `read`, `grep`, and `glob` are allowed and `.env` still asks; (4) `task` is denied for `general` but allowed for `explore`; (5) in the same instance, `build` still allows edits with no hidden edit tools, and `plan` still allows `.opencode/plans/*.md`; (6) per-agent config `agent.learn.permission.edit = "allow"` can re-enable edits, which shows the deny is a default. |
| [`packages/core/test/agent.test.ts`](packages/core/test/agent.test.ts)                     | Runs the V2 agent plugin and checks the same rules with `PermissionV2.evaluate`: Learn denies edits (including plan files), allows `read` and `grep`, `build` allows edits, and `plan` keeps its plan-file exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Run them from the package directories:

```bash
cd packages/opencode && bun test test/agent/agent.test.ts
```

```bash
cd packages/core && bun test test/agent.test.ts
```

**Why these tests are sufficient:** each acceptance criterion maps to at least one test against the real agent registries, in both the V1 (`packages/opencode`) and V2 (`packages/core`) code paths:

- _Learn denies project file writes/edits by default_ → tests 1, 2, and 6, plus the core test.
- _Learn can still read/inspect files_ → test 3 and the core test.
- _`build` can still write files_ → test 5 and the core test.
- _Switching back to `build` restores normal edit permissions_ → test 5. Permissions belong to each agent, so `build` resolving to "allow" in the same instance where `learn` resolves to "deny" is exactly what the session uses after a switch.

I confirmed the new deny tests fail when the permission change is reverted: 4 tests fail in `packages/opencode` and 1 in `packages/core`.
