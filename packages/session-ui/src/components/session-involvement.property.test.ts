import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { createTwoFilesPatch } from "diff"
import { toSessionInvolvementMarkdown, toSessionInvolvementRows } from "./session-involvement"

// Property tests for the "Copy involvement summary" button. The button copies
// toSessionInvolvementMarkdown(toSessionInvolvementRows(diffs)), so these
// properties check that text for every generated session.
// Requirements and interview evidence: traceability/delshark.md

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// A file edit is modelled as blocks. Each block keeps some unchanged lines, then
// deletes `del` old lines and inserts `ins` new lines. Every line's text is unique,
// so the diff algorithm cannot line things up differently from the model, and the
// expected changed lines can be computed from the model alone (no patch parsing).
// Sizes stay small so fast-check reaches the interesting boundaries: changes on
// line 1, changes at the end of the file, one-line changes, pure insertions, pure
// deletions, replacements, and blocks close enough to share one diff hunk.
const block = fc
  .record({
    keep: fc.integer({ min: 1, max: 6 }),
    del: fc.integer({ min: 0, max: 3 }),
    ins: fc.integer({ min: 0, max: 3 }),
  })
  .filter((b) => b.del + b.ins > 0)

const edit = fc.record({
  leading: fc.integer({ min: 0, max: 4 }),
  blocks: fc.array(block, { minLength: 1, maxLength: 4 }),
  trailing: fc.integer({ min: 0, max: 4 }),
  // Tool patches use jsdiff's short default context. Snapshot and VCS patches
  // use full context, which the summary code parses through a different path.
  context: fc.constantFrom(0, 1, 3, 1000),
})

type Edit = typeof edit extends fc.Arbitrary<infer T> ? T : never

// The same shape the Review panel receives for a file the AI changed.
type ChangedFile = {
  file: string
  patch: string
  additions: number
  deletions: number
  status: "added" | "deleted" | "modified"
}

// File paths a real project could contain: nested folders, dots, dashes,
// spaces and non-ASCII names.
const segment = fc.stringMatching(/^[A-Za-z0-9 ._-]{1,8}$/).filter((s) => s.trim() === s && s !== "." && s !== "..")
const filePath = fc
  .tuple(fc.array(fc.constantFrom("src", "packages", "test", "docs", "my folder", "données"), { maxLength: 3 }), segment)
  .map(([dirs, name]) => [...dirs, `${name}.ts`].join("/"))

const fileDiff = fc.tuple(filePath, edit).map(([file, e]) => toDiff(file, e))

// Sessions with 0, 1 and many files, each path at most once.
const session = fc.uniqueArray(fileDiff, { selector: (d) => d.file, maxLength: 8 })

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("copy involvement summary properties", () => {
  // R1: The copied summary lists every file the AI changed in the session, each
  // exactly once, and its file count matches the number of files listed.
  // Kind: invariant
  test("R1: every changed file is listed exactly once with a matching count", () => {
    fc.assert(
      fc.property(session, (diffs) => {
        const markdown = summary(diffs)
        const items = bullets(markdown)
        expect(items).toHaveLength(diffs.length)
        diffs.forEach((diff) => {
          expect(items.filter((line) => line.startsWith(`- \`${diff.file}\` — `))).toHaveLength(1)
        })
        if (diffs.length === 0) {
          expect(markdown).toContain("No changes in this session.")
          return
        }
        expect(markdown).toContain(`\n${diffs.length} ${diffs.length === 1 ? "file" : "files"} changed\n`)
      }),
      { numRuns: 300 },
    )
  })

  // R3: The copied summary shows the exact line ranges the AI changed in each file.
  // Kind: model / oracle (the expected ranges come from the edit model, not from the patch)
  test("R3: line ranges are exactly the lines the AI changed", () => {
    fc.assert(
      fc.property(filePath, edit, (file, e) => {
        const [row] = toSessionInvolvementRows([toDiff(file, e)])
        expect(row?.lineRanges).toEqual(expectedRanges(e))
      }),
      { numRuns: 500 },
    )
  })

  // R5: When the AI changes one more file, the next copy adds exactly that file
  // and leaves every existing entry unchanged.
  // Kind: metamorphic
  test("R5: one more changed file adds exactly one entry and changes nothing else", () => {
    fc.assert(
      fc.property(session, fileDiff, (diffs, extra) => {
        // The extra file must be one the session has not touched yet.
        fc.pre(!diffs.some((diff) => diff.file === extra.file))
        const before = summary(diffs)
        const after = summary([...diffs, extra])
        expect(bullets(after)).toEqual([...bullets(before), bullets(summary([extra]))[0]])
        expect(after).toContain(`\n${diffs.length + 1} ${diffs.length + 1 === 1 ? "file" : "files"} changed\n`)
      }),
      { numRuns: 300 },
    )
  })

  // R7: The copied text never contains "\r", even when a diff uses Windows-style
  // line endings, and Windows line endings do not change the summary.
  // Kind: metamorphic (CRLF version of a session vs. the LF version)
  test("R7: Windows line endings never change the copied summary", () => {
    fc.assert(
      fc.property(session, (diffs) => {
        const windows = diffs.map((diff) => ({ ...diff, patch: diff.patch.replace(/\n/g, "\r\n") }))
        const markdown = summary(windows)
        expect(markdown).not.toContain("\r")
        expect(markdown).toBe(summary(diffs))
      }),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summary(diffs: ChangedFile[]) {
  return toSessionInvolvementMarkdown(toSessionInvolvementRows(diffs))
}

function bullets(markdown: string) {
  return markdown.split("\n").filter((line) => line.startsWith("- "))
}

// Builds the before/after file text described by the edit model, then the patch
// the same way opencode's tools do (jsdiff), with the counts the server reports.
function toDiff(file: string, e: Edit): ChangedFile {
  const lines = build(e)
  const before = text(lines.before)
  const after = text(lines.after)
  return {
    file,
    patch: createTwoFilesPatch(file, file, before, after, "", "", { context: e.context }),
    additions: lines.after.filter((line) => line.startsWith("new")).length,
    deletions: lines.before.filter((line) => line.startsWith("gone")).length,
    status: lines.before.length === 0 ? "added" : lines.after.length === 0 ? "deleted" : "modified",
  }
}

function build(e: Edit) {
  const counter = { keep: 0, gone: 0, new: 0 }
  const keep = (n: number) => Array.from({ length: n }, () => `keep ${counter.keep++}`)
  const lead = keep(e.leading)
  return e.blocks.reduce(
    (acc, b, i) => {
      const kept = i === 0 ? [] : keep(b.keep)
      const gone = Array.from({ length: b.del }, () => `gone ${counter.gone++}`)
      const added = Array.from({ length: b.ins }, () => `new ${counter.new++}`)
      const tail = i === e.blocks.length - 1 ? keep(e.trailing) : []
      return {
        before: [...acc.before, ...kept, ...gone, ...tail],
        after: [...acc.after, ...kept, ...added, ...tail],
      }
    },
    { before: lead, after: lead },
  )
}

function text(lines: string[]) {
  return lines.map((line) => `${line}\n`).join("")
}

// The model: walk the blocks with old/new line cursors. A block that inserts lines
// is reported by its new-file lines; a block that only deletes is reported by the
// old-file lines it removed.
function expectedRanges(e: Edit) {
  const cursor = { old: 1 + e.leading, new: 1 + e.leading }
  return e.blocks.map((b, i) => {
    if (i > 0) {
      cursor.old += b.keep
      cursor.new += b.keep
    }
    const range =
      b.ins > 0
        ? { start: cursor.new, end: cursor.new + b.ins - 1 }
        : { start: cursor.old, end: cursor.old + b.del - 1 }
    cursor.old += b.del
    cursor.new += b.ins
    return range
  })
}
