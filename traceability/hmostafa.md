# Traceability: Hana Mostafa (hmostafa)

**Target feature:** Exporting an OpenCode conversation (session) to Markdown using the in-app `/export` command.

**Main source files:**
- `packages/tui/src/routes/session/index.tsx`
- `packages/tui/src/ui/dialog-export-options.tsx`
- `packages/tui/src/util/transcript.ts`

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | S-2: Staff explained that continuing a feature requires the full conversation. | The export feature should allow users to export the full conversation, preserving messages and their chronological order. | Given a session with 10 messages, exporting the full transcript produces a Markdown file containing all 10 messages in chronological order. | No | **Invariant (AI-assisted):** Every generated message appears exactly once in the Markdown, sorted by creation time and then message ID for ties. | `packages/tui/test/util/transcript.property.test.ts` — implemented; passed locally (100 cases). |
| R2 | S-3, S-4, O-4: Staff wanted failed operations preserved with explanations, while the outside interviewee preferred excluding them when reusing commands. | Users should be able to choose whether tool execution details, including available failure information, are included in the exported transcript. | Given generated successful and failed tool operations, `toolDetails=true` preserves tool labels and available failure details; `toolDetails=false` preserves tool labels but omits inputs, outputs, and failure details. | Yes | **Invariant (AI-assisted):** Across generated successful and failed tool states, tool labels are present with either setting; available execution/error details appear only when enabled. | `packages/tui/test/util/transcript.property.test.ts` — implemented; passed locally (100 cases). |
| R3 | C-5, S-5, O-5: All three interviewees expected exports with the same settings to contain the same information. | Re-enabling an export option shall restore the same exported information for an unchanged conversation. | Export an unchanged session with tool details ON, then OFF, then ON again. The first and third Markdown transcripts have identical content. | No | **Metamorphic (AI-assisted):** ON/OFF/ON restores identical output; ON includes generated nonempty tool details, while OFF excludes them and retains the tool label. | `packages/tui/test/util/transcript.property.test.ts` — implemented; passed locally (100 cases). |
| R4 | S-2: Staff explained that a person working on a related task may prefer a summary instead of the full conversation. | The export feature should allow a reduced-detail Markdown transcript that excludes optional reasoning, tool execution details, and assistant metadata while preserving ordinary conversation text. | Given a session containing ordinary text, reasoning, tool details, and assistant metadata, turning off the optional settings excludes those extras but preserves the same ordinary text messages in order; enabling the settings includes the corresponding available details. | Yes | **Metamorphic (AI-assisted):** Changing from detailed to reduced-detail settings removes only optional categories; ordinary message text and its order remain unchanged. | `packages/tui/test/util/transcript.property.test.ts` — implemented; passed locally (100 cases). |
| R5 | C-8, C-9, S-10, S-11: Interviewees wanted missing information identified without manually comparing transcripts. | When an export omits messages from the session data supplied to the exporter, OpenCode should report the number and IDs of omitted messages. | Given 100 authoritative source messages but only 95 exported, an omission report identifies the five missing message IDs and the 95/100 count. | Yes | Not selected; requires an omission-reporting mechanism that is not currently implemented. | — |
| R6 | C-10, S-13, O-14: Interviewees wanted sensitive credentials hidden when exporting conversations. | The export feature should redact credentials matching explicitly supported patterns before writing them to the Markdown document. | Given a conversation containing `API_KEY=TEST_SECRET_12345`, the exported text replaces the credential value with `[REDACTED]` while preserving surrounding message content. | Yes | Not selected; requires a redaction implementation. | — |
| R7 | C-13, S-15, O-14: Interviewees wanted to know when sensitive information was detected or excluded. | When the exporter detects a credential matching a supported pattern, OpenCode should warn the user that sensitive information was found. | Given a conversation containing `API_KEY=TEST_SECRET_12345`, OpenCode warns that sensitive information was detected before saving or sharing the export. | Yes | Not selected; requires detection and a warning mechanism. | — |

**Properties written or suggested by OpenCode or another AI tool:**
- **R1 and R3:** ChatGPT and GitHub Copilot helped propose and refine these properties. GitHub Copilot generated the initial test file; I reviewed the assertions and ran the tests locally. Each passed with 100 `fast-check` runs.
- **R2 and R4:** ChatGPT helped propose and refine these properties and the requirement revisions to make them testable against existing formatter behavior. GitHub Copilot helped inspect the formatter and review the test approach. Both properties are implemented in `packages/tui/test/util/transcript.property.test.ts` and passed locally with 100 `fast-check` runs each.
- GitHub Copilot helped inspect the Markdown formatter and review the traceability draft. ChatGPT helped revise the requirement descriptions and traceability document.

## Requirement changes

| ID | Original requirement (P4A) | Revised requirement | Why it changed |
|---|---|---|---|
| R2 | Users should be able to choose whether failed tool operations are included in the exported transcript. | Users should be able to choose whether tool execution details, including available failure information, are included in the exported transcript. | **Classification: Conflict / feasibility.** The interviewees expressed conflicting preferences about failed operations: staff wanted explanations preserved (S-3, S-4), while the outside interviewee preferred excluding them when reusing commands (O-4). The existing `toolDetails` option controls visibility of inputs, outputs, and errors but cannot independently remove failed operations or labels. This revision supports both concerns through a details toggle without claiming a failure-filter feature exists. |
| R4 | OpenCode should support exporting a concise summary of a conversation instead of the full transcript. | The export feature should allow a reduced-detail Markdown transcript that excludes optional reasoning, tool execution details, and assistant metadata while preserving ordinary conversation text. |**Classification: Feasibility.** The existing Markdown exporter has no semantic summary mode; automatically summarizing tasks and outcomes would require a separate feature and criteria for what the summary must retain. Motivated by S-2's need to share useful context without overwhelming the recipient, this revision uses existing export settings to remove optional details while preserving ordinary conversation text. This only partially addresses S-2's request: it produces a less detailed transcript, not a summary of tasks or outcomes. A genuine summary export remains a separate, unimplemented feature. |
| R5 | OpenCode should notify users when an export is incomplete and identify which messages were not exported. | When an export omits messages from the session data supplied to the exporter, OpenCode should report the number and IDs of omitted messages. | **Classification: Checkability.** The original requirement does not specify the source against which completeness is checked. An observable omission report would need an authoritative source-message set and a way to identify omitted IDs; `formatTranscript()` currently has neither a separate source set nor a reporting channel. This remains a future implementation, grounded in C-8, C-9, S-10, and S-11. |
| R6 | The export feature should prevent sensitive credentials from appearing in the exported document by default. | The export feature should redact credentials matching explicitly supported patterns before writing them to the Markdown document. | **Classification: Checkability.** No detector can guarantee recognition of every possible credential format. An explicit set of supported patterns gives the requirement a testable scope and preserves the interviewees' privacy concern (C-10, S-13, O-14). This is proposed behavior, not currently implemented. |
| R7 | OpenCode should warn users when potentially sensitive information is detected during export. | When the exporter detects a credential matching a supported pattern, OpenCode should warn the user that sensitive information was found. | **Classification: Checkability.** “Potentially sensitive” is too vague to test consistently. Sharing a defined detection scope with R6 makes the warning condition observable, while preserving interviewees' desire for a warning (C-13, S-15, O-14). This proposed warning behavior is not currently implemented. |

### Credential detection scope for future R6–R7 work

A proposed example of a supported pattern is `API_KEY=<credential_value>`, tested with the synthetic string `API_KEY=TEST_SECRET_12345`. The intended replacement is `API_KEY=[REDACTED]` and an accompanying warning. **Neither behavior exists yet in the Markdown exporter.** No real credentials will be used in tests.

## Requirements retained without changes

**R1:** The formatter receives messages and orders them by creation time, with ID tie-breaking. Generated messages with unique text markers make completeness and ordering observable.

**R3:** The formatter accepts an export-options object. For an unchanged session, restoring the same options should reproduce identical Markdown in the same runtime and locale.

## Property-testing plan and results

### R1 — Invariant: message completeness and chronological ordering (implemented)

Generate 2–20 messages with unique markers and IDs, mixed timestamps including at least one tie, and shuffled input order. Check that every marker occurs exactly once in the output and that the marker positions follow creation time then ID ordering. IDs determine the expected order but are not printed in Markdown. The existing test passed locally using 100 generated cases.

### R2 — Invariant: successful and failed tool details (implemented; passed locally)

Generate a completed operation and a failed operation with nonempty, uniquely marked inputs and available output/error messages. Verify with 100 `fast-check` runs that both settings retain tool labels; enabled tool details reveal all generated execution/error information and disabled tool details hide it. This checks the revised R2 acceptance criterion.

### R3 — Metamorphic: export option restoration (implemented)

Generate completed tool operations with nonempty input and output markers. Export the same unchanged session with `toolDetails` ON, OFF, and ON again. Check that the first and third Markdown outputs are identical; enabled output includes the markers and disabled output excludes them but retains the tool label. The existing test passed locally using 100 generated cases.

### R4 — Metamorphic: reduced-detail export preserves ordinary text (implemented; passed locally)

Generate conversations with uniquely marked ordinary text and nonempty optional content (reasoning text, completed tool execution details, and assistant metadata). Compare an export with those settings enabled against one with the settings disabled. Check that ordinary text markers remain exactly once and in the same order, while the generated optional markers/details disappear in the reduced-detail output. With 100 `fast-check` runs, this tests a reduced-detail transcript, **not semantic summarization**.

## Implementation and test status

- [x] Reviewed all seven requirements from P4A.
- [x] Documented R2, R4, R5, R6, and R7 revisions and preserved interview evidence.
- [x] Implemented and locally passed R1 (invariant), 100 generated cases.
- [x] Implemented and locally passed R2 (invariant), 100 generated cases.
- [x] Implemented and locally passed R3 (metamorphic), 100 generated cases.
- [x] Implemented and locally passed R4 (metamorphic), 100 generated cases.
- [x] Property test run: 4 pass, 0 fail, 5104 expect() calls.
- [x] Committed the initial traceability file and the R1/R3 tests on `hmostafa/properties`.
- [x] Added `fast-check` to `packages/tui` on `hmostafa/properties`.
- [x] Review final test generators and assertions; triage any failures.
- [ ] Ensure `packages/tui` property tests execute in the PR's GitHub Actions `test` workflow.
- [x] Updated this document with R2/R4 results and the property test path.
- [ ] Open the individual properties PR, obtain a teammate review, and verify a passing test run showing all four properties.

**Scope note:** The properties test the actual Markdown formatting function, `formatTranscript()`. They do not independently test the TUI dialog, filesystem save, or editor-opening workflow. R5–R7 describe future behavior, not completed features.
