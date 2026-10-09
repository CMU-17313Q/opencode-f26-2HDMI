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
  return view.fileDiff.hunks
    .map((hunk) =>
      hunk.additionCount > 0
        ? { start: hunk.additionStart, end: hunk.additionStart + hunk.additionCount - 1 }
        : { start: hunk.deletionStart, end: hunk.deletionStart + hunk.deletionCount - 1 },
    )
    .filter((range) => range.end >= range.start)
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
