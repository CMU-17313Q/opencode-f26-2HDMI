import { expect, test } from "bun:test"
import fc from "fast-check"
import { diffLines, formatPatch, structuredPatch } from "diff"
import { toSessionInvolvementRows, type SessionInvolvementDiff } from "./session-involvement"

// Generators. File contents use a few short, often repeated lines so edits land next to
// each other and repeat. Diffs are built like the server's snapshot diffs (one full-context
// patch per file, counts from the +/- lines), so the inputs look like real session data.
const content = fc.array(fc.constantFrom("a", "b", "return x", ""), { maxLength: 8 }).map((l) => l.map((s) => s + "\n").join(""))
const change = fc.record({
  file: fc.constantFrom("a.ts", "b.ts", "src/c.ts", "README.md", "old.txt", "my notes.md"),
  before: content,
  after: content,
  // An empty side can mean the file didn't exist (added/deleted) or was just empty (modified).
  existence: fc.boolean(),
})
type Change = { file: string; before: string; after: string; existence: boolean }
const statusOf = (c: Change) =>
  c.before === "" && c.existence ? "added" : c.after === "" && c.existence ? "deleted" : "modified"

function toDiff(c: Change): SessionInvolvementDiff {
  const hunks = structuredPatch(c.file, c.file, c.before, c.after, "", "", { context: Number.MAX_SAFE_INTEGER })
  const lines = hunks.hunks.flatMap((h) => h.lines)
  const status = statusOf(c)
  const additions = lines.filter((l) => l.startsWith("+")).length
  return { file: c.file, patch: formatPatch(hunks), additions, deletions: lines.filter((l) => l.startsWith("-")).length, status }
}

// A session's changes: distinct files, each really changed (before differs from after).
const session = fc.uniqueArray(change.filter((c) => c.before !== c.after), { selector: (c) => c.file, maxLength: 6 })

// R1: The summary lists every file the agent changed in the session, and no file it didn't change.
// Kind: invariant
test("R1: every changed file is listed exactly once, and nothing else", () => {
  fc.assert(
    fc.property(session, (changes) => {
      const files = toSessionInvolvementRows(changes.map(toDiff)).map((r) => r.file)
      expect(files.toSorted()).toEqual(changes.map((c) => c.file).toSorted())
    }),
  )
})

// R2 (revised in P4B): For each file, the +/- counts match that file's actual diff, and the
// status matches the one the diff records. A diff with no recorded status is shown as
// "modified", because its patch can't tell a deleted file from an emptied one.
// Kind: model/oracle. The oracle counts lines with diffLines. Half the runs drop `status`,
// which the API allows (SnapshotFileDiff.status is optional).
test("R2: status and +/- counts match a simple line-diff oracle", () => {
  fc.assert(
    fc.property(session, fc.boolean(), (changes, dropStatus) => {
      const diffs = changes.map(toDiff).map((d) => (dropStatus ? { ...d, status: undefined } : d))
      const rows = toSessionInvolvementRows(diffs)
      changes.forEach((c, i) => {
        const parts = diffLines(c.before, c.after)
        const count = (key: "added" | "removed") => parts.filter((p) => p[key]).reduce((n, p) => n + (p.count ?? 0), 0)
        const status = dropStatus ? "modified" : statusOf(c)
        expect(rows[i]).toMatchObject({ status, additions: count("added"), deletions: count("removed") })
      })
    }),
  )
})
