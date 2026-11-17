import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import type { FileDiffInfo } from "@opencode-ai/client/promise"
import { normalize, type ViewDiff } from "./session-diff"

export type SessionInvolvementDiff = FileDiffInfo | (SnapshotFileDiff & { file: string }) | VcsFileDiff

export type SessionInvolvementLineRange = {
  start: number
  end: number
}

export type SessionInvolvementRow = {
  file: string
  status: "added" | "deleted" | "modified"
  additions: number
  deletions: number
  lineRanges: SessionInvolvementLineRange[]
}

export function toSessionInvolvementRows(diffs: SessionInvolvementDiff[]): SessionInvolvementRow[] {
  return diffs.map(toRow)
}

function toRow(diff: SessionInvolvementDiff): SessionInvolvementRow {
  const view = normalize(diff)
  return {
    file: view.file,
    status: view.status ?? deriveStatus(diff.patch),
    additions: view.additions,
    deletions: view.deletions,
    lineRanges: hunkRanges(view),
  }
}

function deriveStatus(patch: string | undefined): "added" | "deleted" | "modified" {
  if (patch === undefined) return "modified"
  if (/^--- \/dev\/null[\t\r]*$/m.test(patch)) return "added"
  if (/^\+\+\+ \/dev\/null[\t\r]*$/m.test(patch)) return "deleted"
  return "modified"
}

function hunkRanges(view: ViewDiff): SessionInvolvementLineRange[] {
  return view.fileDiff.hunks.flatMap(changedRanges)
}

// A hunk also contains unchanged context lines around each change (a whole file
// for full-context patches), so report only each change block inside it: the
// new-file lines it adds, or, for a block that only deletes, the old-file lines
// it removes.
function changedRanges(hunk: ViewDiff["fileDiff"]["hunks"][number]): SessionInvolvementLineRange[] {
  const cursor = { addition: hunk.additionStart, deletion: hunk.deletionStart }
  return hunk.hunkContent.flatMap((content) => {
    if (content.type === "context") {
      cursor.addition += content.lines
      cursor.deletion += content.lines
      return []
    }
    const range =
      content.additions > 0
        ? { start: cursor.addition, end: cursor.addition + content.additions - 1 }
        : { start: cursor.deletion, end: cursor.deletion + content.deletions - 1 }
    cursor.addition += content.additions
    cursor.deletion += content.deletions
    return [range]
  })
}

export function toSessionInvolvementMarkdown(rows: SessionInvolvementRow[]): string {
  const lines = ["# AI involvement summary", ""]
  if (rows.length === 0) return [...lines, "No changes in this session.", ""].join("\n")
  lines.push(`${rows.length} ${rows.length === 1 ? "file" : "files"} changed`, "")
  for (const row of rows) {
    const ranges = row.lineRanges.map(formatRange).join(", ")
    const counts = `+${row.additions} -${row.deletions}`
    lines.push(`- \`${row.file}\` — ${row.status} (${counts})${ranges ? `: lines ${ranges}` : ""}`)
  }
  return [...lines, ""].join("\n")
}

function formatRange(range: SessionInvolvementLineRange): string {
  return range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`
}
