import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import type { FileDiffInfo } from "@opencode-ai/client/promise"

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
