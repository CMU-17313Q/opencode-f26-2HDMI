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
