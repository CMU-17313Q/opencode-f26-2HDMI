\
# Traceability: Hana Mostafa (hmostafa)

**Target feature:** Exporting an OpenCode conversation as a Markdown document using the in-app `/export` command.

**Main source files:**

- `packages/tui/src/routes/session/index.tsx`

- `packages/tui/src/ui/dialog-export-options.tsx`

- `packages/tui/src/util/transcript.ts`

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |

|---|---|---|---|---|---|---|

| R1 | S-2: Staff explained that continuing a feature requires the full conversation. | The export feature should allow users to export the full conversation, preserving messages and their chronological order. | Given a session with 10 messages, exporting the full transcript produces a Markdown file containing all 10 messages in their original chronological order. | No | **Invariant (AI-assisted):** Every generated message appears exactly once in the Markdown transcript, ordered by creation time and then message ID for timestamp ties. | PLANNED: `transcript.property.test.ts` |

| R2 | S-3, S-4, O-4: Staff wanted failed operations preserved with explanations, while the outside interviewee preferred excluding them when reusing commands. | Users should be able to choose whether tool execution details, including available failure information, are included in the exported transcript. | Given 2 successful commands and 1 failed command, enabling tool details includes all three and their available failure information. Disabling tool details excludes execution details while retaining tool labels. | Yes | Not selected for property testing. | — |

| R3 | C-5, S-5, O-5: All three interviewees expected exports with the same settings to contain the same information. | Re-enabling an export option shall restore the same exported information for an unchanged conversation. | Export an unchanged session with tool details ON, then OFF, then ON again. The first and third Markdown transcripts must contain identical content. | No | **Metamorphic (AI-assisted):** For an unchanged session containing tool operations, toggling tool details ON/OFF/ON produces identical first and third exports. ON includes generated tool execution details; OFF excludes them while preserving tool labels. | PLANNED: `transcript.property.test.ts` |

| R4 | S-2: Staff explained that someone working on a related task may need only a summary rather than the entire conversation. | OpenCode should support exporting a concise summary of a conversation instead of the full transcript. | Given a 20-message session covering two tasks and their outcomes, selecting Summary Export produces a document identifying both tasks and outcomes without reproducing all 20 messages. | No | Not selected for property testing. | — |

| R5 | C-8, C-9, S-10, S-11: Interviewees wanted missing information identified without manually comparing transcripts. | When an export omits messages from the session data supplied to the exporter, OpenCode should report the number and IDs of omitted messages. | Given 100 source messages where only 95 are exported, OpenCode reports 95/100 and identifies the five omitted message IDs. | Yes | Not selected for property testing. | — |

| R6 | C-10, S-13, O-14: Interviewees wanted sensitive credentials hidden when exporting conversations. | The export feature should redact credentials matching explicitly supported patterns before writing them to the Markdown document. | Given a conversation containing `API_KEY=TEST_SECRET_12345`, the export replaces the credential value with `[REDACTED]` while preserving surrounding message content. | Yes | Not selected for property testing. | — |

| R7 | C-13, S-15, O-14: Interviewees wanted to know when sensitive information was detected or excluded. | When the exporter detects a credential matching a supported pattern, OpenCode should warn the user that sensitive information was found. | Given a conversation containing `API_KEY=TEST_SECRET_12345`, OpenCode displays a warning indicating that sensitive information was detected before saving or sharing the export. | Yes | Not selected for property testing. | — |

## AI Assistance Disclosure

**Properties suggested or assisted by AI:**

- **R1:** GitHub Copilot suggested testing chronological ordering against the existing `formatTranscript()` function, including timestamp ties and message ID tie-breaking.

- **R3:** GitHub Copilot suggested a metamorphic property comparing exports with tool details ON, OFF, and ON again for an unchanged session.

- GitHub Copilot was used to inspect the existing Markdown export implementation, locate the formatter, and review the proposed requirements and properties.

The property tests have not yet been implemented or executed.

## Requirement Changes

| ID | Original requirement (P4A) | Revised requirement | Why it changed |

|---|---|---|---|

| R2 | Users should be able to choose whether failed tool operations are included in the exported transcript. | Users should be able to choose whether tool execution details, including available failure information, are included in the exported transcript. | The existing `toolDetails` setting controls the visibility of tool inputs, outputs, and errors, but does not independently remove failed operations. This revision aligns the requirement with the available behavior while preserving the interviewees' different preferences about retaining failure information (S-3, S-4, O-4). |

| R5 | OpenCode should notify users when an export is incomplete and identify which messages were not exported. | When an export omits messages from the session data supplied to the exporter, OpenCode should report the number and IDs of omitted messages. | The original requirement assumes OpenCode can always identify missing information. However, the exporter can only reliably compare information it receives with information it produces. Restricting the requirement to known source messages makes completeness measurable without pretending the exporter can recover information it never received. This preserves the interviewees' request for identifying omissions rather than only reporting a count (C-8, C-9, S-10, S-11). This behavior is not currently implemented. Detecting omissions would require a separate comparison between the authoritative source messages and the exported output, along with a mechanism for reporting missing message IDs. |

| R6 | The export feature should prevent sensitive credentials from appearing in the exported document by default. | The export feature should redact credentials matching explicitly supported patterns before writing them to the Markdown document. | The original requirement is too broad to guarantee because credentials can have many different formats, including unknown or custom formats. Defining supported detection patterns makes the requirement testable while preserving the interviewees' concern about accidental exposure of credentials (C-10, S-13, O-14). |

| R7 | OpenCode should warn users when potentially sensitive information is detected during export. | When the exporter detects a credential matching a supported pattern, OpenCode should warn the user that sensitive information was found. | The original requirement does not define what counts as potentially sensitive information, making it difficult to determine whether detection is correct. Using the same explicitly supported patterns as R6 makes the warning condition observable and testable. This preserves the interviewees' expectation that users should be informed when sensitive information is detected (C-13, S-15, O-14). |

### Credential Detection Scope (R6–R7)

For the proposed acceptance criteria, a supported credential pattern is a string of the form:

`API_KEY=<credential_value>`

For example, `API_KEY=TEST_SECRET_12345` is a synthetic test credential.

The intended behavior is to replace the credential value with `[REDACTED]` while preserving the surrounding message content. The user should also receive a warning that sensitive information was detected.

This is a proposed detection rule, **not existing OpenCode behavior**. R6 and R7 would require additional implementation before their acceptance criteria could pass. No real credentials will be used in testing.

## Requirements Retained Without Changes

**R1:** The requirement is directly testable because the Markdown formatter receives session messages and sorts them. Generated messages can verify completeness and chronological ordering.

**R3:** The requirement can be tested by formatting an unchanged session with tool details enabled, disabled, and enabled again. The first and third outputs should match when compared within the same runtime and locale.

**R4:** A summary export is technically possible but is not currently part of the Markdown export formatter. The requirement is retained as a future feature rather than treated as already implemented. Meaningful acceptance tests would require a defined summary implementation and criteria for preserving task outcomes.

## Property-Testing Plan

### R1 — Invariant: Completeness and Chronological Ordering

Generate collections of messages with varying creation times, IDs, and input orders. Include messages with identical timestamps to exercise the ID tie-breaker.

Assign each message a unique text marker. Verify that every marker appears exactly once in the exported Markdown, in the expected chronological order.

Message IDs determine the expected ordering but are not directly displayed in the exported document.

This property tests the interview-driven expectation that a complete transcript must preserve message history in a predictable order.

### R3 — Metamorphic: Export Option Consistency

Generate sessions containing ordinary text and tool execution information.

Export each session using the following sequence:

1. Tool details enabled.

2. Tool details disabled.

3. Tool details enabled again.

Do not change the session data between exports.

The first and third Markdown transcripts must be identical. Additionally, the first and third outputs must include the generated tool execution details, while the second must omit those details and retain the tool labels.

Generated sessions should contain nonempty tool inputs, outputs, or errors so that changing the option exercises meaningful content.

This property tests the interviewees' expectation that restoring the same export settings should restore the same information.

## Implementation and Test Status

- [x] Reviewed all seven P4A requirements.

- [x] Identified retained and revised requirements.

- [x] Preserved interview evidence for revised requirements.

- [x] Defined the planned property types for R1 and R3.

- [ ] Implement R1 property test.

- [ ] Implement R3 property test.

- [ ] Run property tests locally.

- [ ] Record and resolve any observed failures.

- [ ] Update property test references with actual file paths.

- [ ] Confirm that the package tests execute in GitHub Actions.

- [ ] Obtain teammate PR review and verify passing CI.

**Note:** R4–R7 are not being claimed as implemented. The revised requirements document expected behavior for future development. Test references and results must be updated after the property tests are created and executed.
