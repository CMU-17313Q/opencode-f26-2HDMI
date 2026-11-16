import { expect, test } from "bun:test"
import fc from "fast-check"
import { formatPatch, structuredPatch } from "diff"
import { toSessionInvolvementRows, type SessionInvolvementDiff } from "./session-involvement"

// Generators. File contents use a few short, often repeated lines so edits land next to
// each other and repeat. Diffs are built like the server's snapshot diffs (one full-context
// patch per file, counts from the +/- lines), so the inputs look like real session data.
const content = fc.array(fc.constantFrom("a", "b", "return x", ""), { maxLength: 8 }).map((l) => l.map((s) => s + "\n").join(""))
const change = fc.record({
  file: fc.constantFrom("a.ts", "b.ts", "src/c.ts", "README.md", "old.txt", "my notes.md"),
  before: content,
  after: content,
})

function toDiff(c: { file: string; before: string; after: string }): SessionInvolvementDiff {
  const hunks = structuredPatch(c.file, c.file, c.before, c.after, "", "", { context: Number.MAX_SAFE_INTEGER })
  const lines = hunks.hunks.flatMap((h) => h.lines)
  const status = c.before === "" ? "added" : c.after === "" ? "deleted" : "modified"
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
