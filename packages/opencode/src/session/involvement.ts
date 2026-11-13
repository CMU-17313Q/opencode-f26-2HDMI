import { parsePatch, type StructuredPatchHunk } from "diff"
import { FileDiff } from "@opencode-ai/schema/file-diff"

export type LineRange = {
  start: number
  end: number
}

export type Row = {
  file: string
  status: "added" | "deleted" | "modified"
  additions: number
  deletions: number
  ranges: LineRange[]
}

export function fromDiffs(diffs: FileDiff.Info[]): Row[] {
  return diffs.map(toRow)
}

export function formatReport(sessionID: string, rows: Row[]): string {
  const additions = rows.reduce((sum, row) => sum + row.additions, 0)
  const deletions = rows.reduce((sum, row) => sum + row.deletions, 0)
  const header = [`AI involvement — session ${sessionID}`, `${rows.length} files, +${additions} / -${deletions}`]
  if (rows.length === 0) return header.join("\n")
  return [...header, "", ...rows.map(formatRow)].join("\n")
}

function formatRow(row: Row): string {
  if (row.ranges.length === 0) return `- ${row.file} (${row.status})`
  const ranges = row.ranges.map((range) => `${range.start}–${range.end}`).join(", ")
  return `- ${row.file} (${row.status})  lines ${ranges}`
}

function toRow(diff: FileDiff.Info): Row {
  return {
    file: diff.file ?? "",
    status: diff.status ?? statusFromPatch(diff.patch),
    additions: diff.additions,
    deletions: diff.deletions,
    ranges: rangesFromPatch(diff.patch),
  }
}

function statusFromPatch(patch: string | undefined): Row["status"] {
  if (patch === undefined) return "modified"
  if (/^--- \/dev\/null[\t\r]*$/m.test(patch)) return "added"
  if (/^\+\+\+ \/dev\/null[\t\r]*$/m.test(patch)) return "deleted"
  return "modified"
}

function rangesFromPatch(patch: string | undefined): LineRange[] {
  if (patch === undefined) return []
  const parsed = parsePatchSafe(patch)
  if (!parsed) return []
  return parsed.flatMap((file) => file.hunks.flatMap(changedRanges))
}

// Session patches are built with unlimited context, so one hunk can span the whole file.
// Report only each run of changed lines: the new-file lines it inserts, or, for a run that
// only deletes, the old-file lines it removes.
function changedRanges(hunk: StructuredPatchHunk): LineRange[] {
  const runs: { added: number[]; removed: number[] }[] = []
  const cursor = { old: hunk.oldStart, new: hunk.newStart, inRun: false }
  for (const line of hunk.lines) {
    if (line.startsWith("\\")) continue
    if (line.startsWith(" ")) {
      cursor.old++
      cursor.new++
      cursor.inRun = false
      continue
    }
    if (!cursor.inRun) runs.push({ added: [], removed: [] })
    cursor.inRun = true
    const run = runs[runs.length - 1]
    if (line.startsWith("+")) run.added.push(cursor.new++)
    if (line.startsWith("-")) run.removed.push(cursor.old++)
  }
  return runs.map((run) => {
    const lines = run.added.length > 0 ? run.added : run.removed
    return { start: lines[0], end: lines[lines.length - 1] }
  })
}

function parsePatchSafe(patch: string) {
  try {
    return parsePatch(patch)
  } catch {
    return
  }
}

export * as SessionInvolvement from "./involvement"
