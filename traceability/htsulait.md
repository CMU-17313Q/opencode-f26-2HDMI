# Traceability: Huda Al-Sulaiti (htsulait)

**Target feature:** The AI involvement summary in the Review panel and its Download button (`involvement-<sessionID>.md`). Main source files: `packages/session-ui/src/components/session-involvement.ts` (rows and Markdown), `packages/session-ui/src/components/session-involvement-summary.tsx` (summary and button), `packages/app/src/utils/session-export.ts` (file name and download).

Property tests: `packages/session-ui/src/components/session-involvement.property.test.ts` (run with `bun test` in `packages/session-ui`).

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-2, O-2, S-8 | The summary lists every file the agent changed in the session, and no file it didn't change. | The agent edits math.ts, creates hello.ts and deletes old.txt; README.md is untouched. The summary and the downloaded file list exactly math.ts (modified), hello.ts (added) and old.txt (deleted), and do not list README.md. | No | Every changed file is listed exactly once, and nothing else (invariant) | `R1: every changed file is listed exactly once, and nothing else` |
| R2 | C-2 | For each file, the +/- counts match that file's actual diff, and the status matches the one the diff records. A diff with no recorded status is shown as "modified". | The agent adds 3 lines and removes 1 line in math.ts: its row shows "modified (+3 -1)". A file the agent deletes shows "deleted", never "modified", when the diff records it as deleted. | Yes | Status and +/- counts match a line-diff oracle (model/oracle) | `R2: status and +/- counts match a simple line-diff oracle` |
| R3 | S-6, C-5 (O-3 disagrees) | A change that is undone in the same session, so the file ends exactly as it started, does not appear in the summary. | The agent adds a function to math.ts, then that message is reverted so math.ts matches its starting content: math.ts is not listed. If nothing else changed, the summary says "No changes in this session." | No | Adding an edit-then-undo diff leaves the summary unchanged (round-trip) | `R3: an edit that is undone leaves the summary unchanged` |
| R4 | S-7, C-6 (O-5 disagrees) | The summary depends only on the final changes, not on the order the agent made them in. | Session 1 edits a.ts then b.ts; session 2 makes the same edits to b.ts then a.ts, with the same final content. The two downloaded files are identical, including the order of the files. | No | Shuffling the same diffs gives an identical Download file (metamorphic) | `R4: the same changes in a different order give the same summary` |
| R5 | S-3, S-4, S-1 | Edits the user makes by hand before the agent's first step or after its last step in the session are not listed. Hand edits made between those points can't be told apart from the agent's, so they are listed too. | The user edits notes.md by hand, then asks the agent to edit math.ts, and edits README.md by hand after the agent finishes, without sending another prompt. The summary lists math.ts and does not list notes.md or README.md. | Yes | None | None |
| R6 | S-8, S-9, C-7 | Each line range points at lines that changed, so a grader can find every listed change in the file. | The math.ts row says "lines 4-6": opening the final math.ts shows the agent's new code on lines 4-6, and the lines outside the listed ranges are unchanged. | No | None | None |

Properties written or suggested by opencode or another AI tool: R1, R2, R3 and R4 were written with Claude Code (an AI coding tool), including the generators. I chose the requirements, reviewed each property against its requirement, and made the triage decisions below.

## Requirement changes

| ID | Original requirement (P4A) | Revised requirement | Why it changed |
|---|---|---|---|
| R2 | For each file, the status and the +/- counts match that file's actual diff. | For each file, the +/- counts match that file's actual diff, and the status matches the one the diff records. A diff with no recorded status is shown as "modified". | The interviewee wanted a deleted file never shown as "modified" (C-2). But a diff's status is optional, and the server's patches have no `/dev/null` header, so a diff without a recorded status can't tell a deleted file from an emptied one. The revision keeps the deleted-vs-modified check whenever the diff records a status and shows "modified" when it doesn't. |
| R5 | The summary only includes changes made by the agent, not edits the user makes by hand during the session. | Edits the user makes by hand before the agent's first step or after its last step in the session are not listed. Hand edits made between those points can't be told apart from the agent's, so they are listed too. | Not feasible as written. The session's diffs come from snapshots of the whole project folder, taken at the agent's first step and at its last step, so any hand edit made in between is counted as the agent's. The revision keeps the part of the user's need (S-3, S-4: don't credit the user's own work to the AI) that the snapshots can support, and says plainly what they can't. |

## Triage of failing properties

| Property | Counterexample (shrunk) | Outcome | Fix |
|---|---|---|---|
| R2 | A deleted file (`a\n` → empty) whose diff has no `status` was shown as "modified". | Requirement problem | The server's patches have no `/dev/null` header, so without a recorded status a deleted file and an emptied file give the same patch. R2 revised (above); property updated. |
| R3 | An empty session plus one edited-then-undone file listed `undone.ts — modified (+0 -0)`. | Code bug | `toSessionInvolvementRows` now drops diffs with a patch but no hunks and no +/- lines. Binary files (empty patch) stay listed. |
| R4 | The same three new files in two orders gave two different Download files. | Code bug | Rows are sorted by file path. |
| R2 (after the R4 fix) | Rows no longer matched the input order. | Wrong test | R2 now looks up each file's row by name instead of by position. |
