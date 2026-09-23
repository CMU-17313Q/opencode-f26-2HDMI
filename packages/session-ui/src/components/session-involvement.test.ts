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
})
