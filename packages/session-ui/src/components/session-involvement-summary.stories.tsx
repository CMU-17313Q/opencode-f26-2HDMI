// @ts-nocheck
import { SessionInvolvementSummary } from "./session-involvement-summary"

const docs = `### Overview
Summary of the files and line ranges modified during a session, shown at the top of the Review panel.

### API
- \`diffs\`: the same review diffs rendered by the Review panel.

### Variants and states
- Rows with path, status, line ranges, and additions/deletions.
- Empty state when the session has no changes.
`

const modified = [
  "Index: src/project.ts",
  "===================================================================",
  "--- src/project.ts\t",
  "+++ src/project.ts\t",
  "@@ -1,3 +1,2 @@",
  ' import { and } from "drizzle-orm"',
  '-import { sql } from "drizzle-orm"',
  ' import { ProjectTable } from "./project.sql"',
  "@@ -346,3 +345,3 @@",
  ' import { Database } from "@/storage/db"',
  '-import { ProjectTable } from "./project.sql"',
  '+import { ProjectTable } from "../project/project.sql"',
  ' import { SessionTable } from "../session/session.sql"',
  "",
].join("\n")

const added = ["--- /dev/null", "+++ b/src/new.ts", "@@ -0,0 +1,2 @@", "+line one", "+line two", ""].join("\n")

const deleted = ["--- a/src/old.ts", "+++ /dev/null", "@@ -1,3 +0,0 @@", "-one", "-two", "-three", ""].join("\n")

const diffs = [
  { file: "src/project.ts", patch: modified, additions: 1, deletions: 2, status: "modified" },
  { file: "src/new.ts", patch: added, additions: 2, deletions: 0, status: "added" },
  { file: "src/old.ts", patch: deleted, additions: 0, deletions: 3, status: "deleted" },
]

export default {
  title: "UI/SessionInvolvementSummary",
  id: "components-session-involvement-summary",
  component: SessionInvolvementSummary,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: docs,
      },
    },
  },
}

export const WithChanges = {
  render: () => (
    <div style={{ width: "480px" }}>
      <SessionInvolvementSummary diffs={diffs} />
    </div>
  ),
}

export const Empty = {
  render: () => (
    <div style={{ width: "480px" }}>
      <SessionInvolvementSummary diffs={[]} />
    </div>
  ),
}
