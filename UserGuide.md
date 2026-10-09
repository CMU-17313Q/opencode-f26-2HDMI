# OpenCode — User Guide

This guide provides instructions for using and testing the features developed by our team as part of the Software Engineering project.

## User Story 1: AI Involvement Summary

This feature allows users to review the scope of AI involvement in a coding session, including the files and line ranges modified by OpenCode.

*Feature usage and user-testing instructions will be added by the responsible team members.*

### Copy Involvement Summary to Clipboard (Issue #8)

#### Overview

The **Session changes** summary at the top of the Review panel has a **Copy** button (the two-squares icon, right next to the Download button). Clicking it copies the involvement summary to your clipboard as a Markdown report, so you can paste it straight into a PR description, a commit message, or a notes doc. The report is the same Markdown the Download button saves, so both buttons always agree.

Example of what gets copied:

```markdown
# AI involvement summary

1 file changed

- `src/new.ts` — added (+2 -0): lines 1-2
```

If the session has no changes, the copied report still has the heading and says `No changes in this session.`

#### How to Use

1. Open a session where OpenCode has changed at least one file.
2. Open the Review panel (the **Review** / **Files Changed** tab on the right side).
3. In the **Session changes** box at the top, click the **Copy involvement summary** button (hover over the icons to see their labels).
4. A toast saying **Involvement summary copied** appears. Paste anywhere to use the report.

If the browser blocks clipboard access (for example, the page is opened over plain `http://` on a non-localhost address, or clipboard permission is denied), a **Failed to copy involvement summary** error toast appears instead and nothing is copied.

#### User Testing

1. From the repository root, start the server: `bun dev serve` (port 4096).
2. In a second terminal, start the web app: `bun run --cwd packages/app dev`, then open the URL it prints (for example `http://localhost:5173`).
3. Start a session in any git project and ask OpenCode to create or edit a file, e.g. _"create a file hello.ts that logs hello"_.
4. Open the Review panel and confirm the **Session changes** box lists the file with its status and line ranges.
5. Click **Copy involvement summary**. Expected: the success toast appears.
6. Paste into any text editor. Expected: a Markdown report starting with `# AI involvement summary` that lists the same files, statuses, `+/-` counts, and line ranges shown in the panel.
7. Click **Download involvement summary** and open the downloaded `.md` file. Expected: identical text to what you pasted in step 6.
8. Failure path: open the browser DevTools console on the app tab and simulate a blocked clipboard by running
   `Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) } })`,
   then click Copy again. Expected: the **Failed to copy involvement summary** error toast, and your clipboard still holds the old content. Reload the page to undo this.

#### Automated Tests

- **`packages/app/src/utils/involvement-clipboard.test.ts`** (unit, `bun test`): checks that the exact Markdown string is written to the clipboard and success is reported; that a real session diff, run through the same `toSessionInvolvementRows` and `toSessionInvolvementMarkdown` functions the panel uses, produces the expected report on the clipboard; that an empty session still copies a valid report; and that a denied permission or a missing Clipboard API reports failure instead of throwing.
- **`packages/app/e2e/user-story/involvement-copy.spec.ts`** (Playwright, runs in CI with `e2e/user-story`): opens a mocked session with one changed file, clicks the Copy button on the Review panel, checks the success toast, and reads the real browser clipboard to check the exact Markdown. A second test makes the browser reject clipboard writes and checks that the error toast appears and the success toast does not.
- **`packages/app/src/i18n/parity.test.ts`** (existing): fails if any of the 62 locale files is missing one of the new copy strings, so the button label and toasts can never show a missing key.
- The Markdown format itself is covered by the existing `session involvement markdown` tests in `packages/session-ui/src/components/session-involvement.test.ts`, added with the Download feature.

Why this is enough: the feature has three parts, and each one is tested at the level where it can break. The clipboard helper is tested directly for success and both failure modes. The full user path (button on the Review panel, real clipboard, toast) is tested end to end in a real browser, for both success and failure. The shared Markdown formatter and the translation keys already have their own tests. Together they cover the acceptance criteria for #8: the button shows on the Review summary, clicking it copies the Markdown report, empty summaries still copy a valid report, and the user gets success or error feedback.

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

These cover the new logic. Listing and switching agents reuse unchanged code.
