import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import type { FileDiffInfo } from "@opencode-ai/client/promise"
import { normalize, text, type ViewDiff } from "./session-diff"

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
    status: deriveStatus(view.status, view),
    additions: view.additions,
    deletions: view.deletions,
    lineRanges: hunkRanges(view),
  }
}

function deriveStatus(
  status: "added" | "deleted" | "modified" | undefined,
  view: ViewDiff,
): "added" | "deleted" | "modified" {
  if (status) return status
  const before = text(view, "deletions")
  const after = text(view, "additions")
  if (before.length === 0 && after.length > 0) return "added"
  if (after.length === 0 && before.length > 0) return "deleted"
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
