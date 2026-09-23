import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import type { FileDiffInfo } from "@opencode-ai/client/promise"
import { normalize } from "./session-diff"

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
    status: view.status ?? "modified",
    additions: view.additions,
    deletions: view.deletions,
    lineRanges: [],
  }
}
