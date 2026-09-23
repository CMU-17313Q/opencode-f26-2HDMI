import { describe, expect, test } from "bun:test"
import { toSessionInvolvementRows } from "./session-involvement"

describe("session involvement", () => {
  test("returns an empty list for no diffs", () => {
    expect(toSessionInvolvementRows([])).toEqual([])
  })

  test("maps a multi-hunk patch to one line range per hunk", () => {
    const patch =
      'Index: project.ts\n===================================================================\n--- project.ts\t\n+++ project.ts\t\n@@ -1,3 +1,2 @@\n import { and } from "drizzle-orm"\n-import { sql } from "drizzle-orm"\n import { ProjectTable } from "./project.sql"\n@@ -346,3 +345,3 @@\n import { Database } from "@/storage/db"\n-import { ProjectTable } from "./project.sql"\n+import { ProjectTable } from "../project/project.sql"\n import { SessionTable } from "../session/session.sql"\n'

    const rows = toSessionInvolvementRows([
      { file: "project.ts", patch, additions: 1, deletions: 2, status: "modified" },
    ])

    expect(rows).toEqual([
      {
        file: "project.ts",
        status: "modified",
        additions: 1,
        deletions: 2,
        lineRanges: [
          { start: 1, end: 2 },
          { start: 345, end: 347 },
        ],
      },
    ])
  })

  test("maps a new file to a single addition-side range", () => {
    const patch = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "index 0000000..1a2b3c4",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,2 @@",
      "+line one",
      "+line two",
      "",
    ].join("\n")

    const rows = toSessionInvolvementRows([{ file: "new.ts", patch, additions: 2, deletions: 0, status: "added" }])

    expect(rows).toEqual([
      { file: "new.ts", status: "added", additions: 2, deletions: 0, lineRanges: [{ start: 1, end: 2 }] },
    ])
  })

  test("derives added status from an empty before side when status is missing", () => {
    const patch = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "index 0000000..1a2b3c4",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,2 @@",
      "+line one",
      "+line two",
      "",
    ].join("\n")

    const rows = toSessionInvolvementRows([{ file: "new.ts", patch, additions: 2, deletions: 0 }])

    expect(rows[0]?.status).toBe("added")
  })

  test("maps a deleted file to a single deletion-side range", () => {
    const patch = [
      "diff --git a/old.ts b/old.ts",
      "deleted file mode 100644",
      "index 1a2b3c4..0000000",
      "--- a/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-line one",
      "-line two",
      "",
    ].join("\n")

    const rows = toSessionInvolvementRows([{ file: "old.ts", patch, additions: 0, deletions: 2, status: "deleted" }])

    expect(rows).toEqual([
      { file: "old.ts", status: "deleted", additions: 0, deletions: 2, lineRanges: [{ start: 1, end: 2 }] },
    ])
  })
})
