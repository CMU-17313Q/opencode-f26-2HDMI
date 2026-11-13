import { afterAll, describe, expect, test } from "bun:test"
import fc from "fast-check"
import { formatPatch, parsePatch, structuredPatch } from "diff"
import { mkdtemp, rm } from "fs/promises"
import os from "os"
import path from "path"
import { SessionInvolvement } from "../../src/session/involvement"

// Generators
//
// A session diff in opencode is a file path plus a patch that the snapshot code builds with
// `formatPatch(structuredPatch(file, file, before, after, "", "", { context: Number.MAX_SAFE_INTEGER }))`.
// So instead of random strings, the generators build a realistic `before` and `after` file and turn
// them into a patch exactly the way opencode does (see `toDiff`).
//
// A file edit is a list of blocks. Each block keeps some unchanged lines, then deletes `del` lines
// and inserts `ins` lines. This reaches the cases interviewees asked about:
// - added files (empty before), deleted files (empty after), and modified files
// - edits on the first line (first block keeps 0 lines) and on the last line (tail keeps 0 lines)
// - pure insertions, pure deletions, and replacements, alone or several in one file
// Every line is unique (`keep3`, `old2`, `new5`), so there is exactly one correct answer for which
// lines changed. That is what lets the R2 property know the expected line ranges.
const block = fc.record({ keep: fc.nat({ max: 4 }), del: fc.nat({ max: 3 }), ins: fc.nat({ max: 3 }) })
const fileEdit = fc
  .record({ blocks: fc.array(block, { minLength: 1, maxLength: 4 }), tail: fc.nat({ max: 4 }) })
  .map(build)
  .filter((edit) => edit.additions + edit.deletions > 0)

// Paths look like real project files, including nested folders, spaces, and non-ASCII names.
const filePath = fc
  .tuple(
    fc.array(fc.constantFrom("src", "lib", "test", "my folder", "ünïcode"), { maxLength: 2 }),
    fc.constantFrom("hello", "a", "b", "utils", "index", "foo"),
    fc.constantFrom(".ts", ".md", ".json", ""),
  )
  .map(([dirs, name, ext]) => [...dirs, name + ext].join("/"))

// A whole session: several different files, each with its own edit.
const session = fc.uniqueArray(fc.record({ file: filePath, edit: fileEdit }), {
  selector: (entry) => entry.file,
  minLength: 1,
  maxLength: 6,
})

describe("session involvement properties", () => {
  // R1 (No invented files): The report lists exactly the files in the session's recorded diffs,
  // each file once. It never lists a file that is not in the session's recorded changes.
  // Kind: invariant
  test("R1: the report lists exactly the recorded files, each once", () => {
    fc.assert(
      fc.property(session, (entries) => {
        const rows = SessionInvolvement.fromDiffs(entries.map((entry) => toDiff(entry.file, entry.edit)))
        const lines = SessionInvolvement.formatReport("ses_test", rows)
          .split("\n")
          .filter((line) => line.startsWith("- "))

        expect(rows.map((row) => row.file)).toEqual(entries.map((entry) => entry.file))
        expect(lines).toHaveLength(entries.length)
        lines.forEach((line, i) => expect(line.startsWith(`- ${entries[i].file} (`)).toBe(true))
      }),
    )
  })

  // R2 (Exact changed lines): For every file the AI changed, the report shows the file path, its
  // status (added, modified or deleted), and the line ranges the AI changed.
  // Kind: model / oracle. The model is the generator itself: it knows which lines it changed.
  // Insertions and replacements are reported as the new-file lines; a pure deletion has no new
  // lines, so it is reported as the old-file lines that were removed.
  test("R2: the report shows the status and exactly the changed line ranges", () => {
    fc.assert(
      fc.property(filePath, fileEdit, (file, edit) => {
        const [row] = SessionInvolvement.fromDiffs([toDiff(file, edit)])

        expect(row.file).toBe(file)
        expect(row.status).toBe(statusOf(edit))
        expect(row.ranges).toEqual(edit.expected)
      }),
    )
  })

  // R3 (Deleted files stay listed): A file the AI added in a session stays in that session's report
  // even if it is later deleted from disk, and the entry for one file never depends on the other
  // files in the report.
  // Kind: metamorphic. Removing one file's diff from the session removes exactly that row and
  // leaves every other row unchanged. Building the report twice from the same recorded diffs gives
  // the same report, so an added file is still reported as added on a later run.
  test("R3: removing one file leaves every other entry unchanged", () => {
    fc.assert(
      fc.property(
        session.chain((entries) => fc.tuple(fc.constant(entries), fc.nat({ max: entries.length - 1 }))),
        ([entries, removed]) => {
          const diffs = entries.map((entry) => toDiff(entry.file, entry.edit))
          const all = SessionInvolvement.fromDiffs(diffs)

          expect(SessionInvolvement.fromDiffs(diffs.filter((_, i) => i !== removed))).toEqual(
            all.filter((_, i) => i !== removed),
          )
          expect(SessionInvolvement.fromDiffs(diffs)).toEqual(all)
        },
      ),
    )
  })

  // R4 (Trailing blank line is harmless): An extra blank line at the end of a file does not change
  // that file's name, status, or the line ranges of the real edit. The blank line itself may still
  // be reported.
  // Kind: metamorphic. Same edit with and without one extra blank line at the end: once the new last
  // line is taken out of the second report, both reports must be equal, and + differs by exactly 1.
  test("R4: an extra blank line at the end does not change the real edit", () => {
    fc.assert(
      fc.property(
        filePath,
        fileEdit.filter((edit) => statusOf(edit) === "modified"),
        (file, edit) => {
          const [plain] = SessionInvolvement.fromDiffs([toDiff(file, edit)])
          const [blank] = SessionInvolvement.fromDiffs([
            toDiff(file, { ...edit, after: [...edit.after, ""], additions: edit.additions + 1 }),
          ])
          const last = edit.after.length + 1

          expect(blank.file).toBe(plain.file)
          expect(blank.status).toBe(plain.status)
          expect(blank.additions).toBe(plain.additions + 1)
          expect(withoutLine(blank.ranges, last)).toEqual(plain.ranges)
        },
      ),
    )
  })

  // R5 (Counts match git diff): For each file, the + and - line counts in the report match git diff
  // for the same change.
  // Kind: model / oracle. The oracle is real `git diff --no-index --numstat` on the same two files.
  // This generator is different on purpose: lines come from a tiny alphabet so they repeat (which
  // makes diffs ambiguous), and files may or may not end with a newline, because those are the
  // cases where two diff tools are most likely to disagree.
  test("R5: + and - counts match git diff --numstat", async () => {
    const content = fc
      .tuple(fc.array(fc.constantFrom("a", "b", "c", "", "  "), { maxLength: 8 }), fc.boolean())
      .map(([lines, newline]) => (lines.length === 0 ? "" : lines.join("\n") + (newline ? "\n" : "")))

    await fc.assert(
      fc.asyncProperty(content, content, async (before, after) => {
        const git = await numstat(before, after)
        const diff = {
          file: "foo.ts",
          patch: formatPatch(
            structuredPatch("foo.ts", "foo.ts", before, after, "", "", { context: Number.MAX_SAFE_INTEGER }),
          ),
          additions: git.additions,
          deletions: git.deletions,
          status: "modified" as const,
        }
        const [row] = SessionInvolvement.fromDiffs([diff])
        const lines = parsePatch(diff.patch).flatMap((file) => file.hunks.flatMap((hunk) => hunk.lines))

        expect({ additions: row.additions, deletions: row.deletions }).toEqual(git)
        expect(lines.filter((line) => line.startsWith("+")).length).toBe(git.additions)
        expect(lines.filter((line) => line.startsWith("-")).length).toBe(git.deletions)
        expect(SessionInvolvement.formatReport("ses_test", [row])).toContain(`+${git.additions} / -${git.deletions}`)
      }),
      { numRuns: 50 },
    )
  })
})

// Builds the before/after file and the line ranges a correct report must show for this edit.
function build(input: { blocks: { keep: number; del: number; ins: number }[]; tail: number }) {
  const counter = { keep: 0, old: 0, new: 0 }
  const before: string[] = []
  const after: string[] = []
  const expected: SessionInvolvement.LineRange[] = []
  input.blocks.forEach((block, i) => {
    // Keep at least one unchanged line between edits so each edit is its own range.
    const keep = Array.from({ length: i === 0 ? block.keep : Math.max(1, block.keep) }, () => `keep${counter.keep++}`)
    before.push(...keep)
    after.push(...keep)
    if (block.ins > 0) expected.push({ start: after.length + 1, end: after.length + block.ins })
    if (block.ins === 0 && block.del > 0) expected.push({ start: before.length + 1, end: before.length + block.del })
    before.push(...Array.from({ length: block.del }, () => `old${counter.old++}`))
    after.push(...Array.from({ length: block.ins }, () => `new${counter.new++}`))
  })
  const tail = Array.from({ length: input.tail }, () => `keep${counter.keep++}`)
  return {
    before: [...before, ...tail],
    after: [...after, ...tail],
    expected,
    additions: counter.new,
    deletions: counter.old,
  }
}

// Turns an edit into a session diff the same way opencode's snapshot code does.
function toDiff(file: string, edit: { before: string[]; after: string[]; additions: number; deletions: number }) {
  const text = (lines: string[]) => (lines.length === 0 ? "" : lines.join("\n") + "\n")
  return {
    file,
    patch: formatPatch(
      structuredPatch(file, file, text(edit.before), text(edit.after), "", "", { context: Number.MAX_SAFE_INTEGER }),
    ),
    additions: edit.additions,
    deletions: edit.deletions,
    status: statusOf(edit),
  }
}

function statusOf(edit: { before: string[]; after: string[] }) {
  if (edit.before.length === 0) return "added" as const
  if (edit.after.length === 0) return "deleted" as const
  return "modified" as const
}

// Removes one line number from a list of ranges (dropping a range that becomes empty).
function withoutLine(ranges: SessionInvolvement.LineRange[], line: number) {
  return ranges.flatMap((range) => {
    if (range.start === line && range.end === line) return []
    if (range.end === line) return [{ start: range.start, end: line - 1 }]
    return [range]
  })
}

const dir = mkdtemp(path.join(os.tmpdir(), "involvement-property-"))
afterAll(async () => rm(await dir, { recursive: true, force: true }))

async function numstat(before: string, after: string) {
  const cwd = await dir
  await Bun.write(path.join(cwd, "before"), before)
  await Bun.write(path.join(cwd, "after"), after)
  const output = Bun.spawnSync(["git", "diff", "--no-index", "--numstat", "before", "after"], { cwd }).stdout.toString()
  const [additions, deletions] = output.trim().split("\t")
  return { additions: Number(additions ?? 0) || 0, deletions: Number(deletions ?? 0) || 0 }
}
