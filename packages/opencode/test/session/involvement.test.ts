import { describe, expect, test } from "bun:test"
import { SessionInvolvement } from "../../src/session/involvement"

describe("session involvement", () => {
  test("returns an empty list for no diffs", () => {
    expect(SessionInvolvement.fromDiffs([])).toEqual([])
  })

  test("maps a one-hunk modified file", () => {
    const patch =
      "Index: a.ts\n===================================================================\n--- a.ts\t\n+++ a.ts\t\n@@ -1,2 +1,2 @@\n one\n-two\n+three\n"

    expect(
      SessionInvolvement.fromDiffs([{ file: "a.ts", patch, additions: 1, deletions: 1, status: "modified" }]),
    ).toEqual([{ file: "a.ts", status: "modified", additions: 1, deletions: 1, ranges: [{ start: 1, end: 2 }] }])
  })

  test("maps a multi-hunk modified file", () => {
    const patch =
      'Index: project.ts\n===================================================================\n--- project.ts\t\n+++ project.ts\t\n@@ -1,3 +1,2 @@\n import { and } from "drizzle-orm"\n-import { sql } from "drizzle-orm"\n import { ProjectTable } from "./project.sql"\n@@ -346,3 +345,3 @@\n import { Database } from "@/storage/db"\n-import { ProjectTable } from "./project.sql"\n+import { ProjectTable } from "../project/project.sql"\n import { SessionTable } from "../session/session.sql"\n'

    expect(
      SessionInvolvement.fromDiffs([{ file: "project.ts", patch, additions: 1, deletions: 2, status: "modified" }]),
    ).toEqual([
      {
        file: "project.ts",
        status: "modified",
        additions: 1,
        deletions: 2,
        ranges: [
          { start: 1, end: 2 },
          { start: 345, end: 347 },
        ],
      },
    ])
  })

  test("maps an added file to the new-file line range", () => {
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

    expect(SessionInvolvement.fromDiffs([{ file: "new.ts", patch, additions: 2, deletions: 0, status: "added" }])).toEqual(
      [{ file: "new.ts", status: "added", additions: 2, deletions: 0, ranges: [{ start: 1, end: 2 }] }],
    )
  })

  test("maps a deleted file to the old-file line range", () => {
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

    expect(
      SessionInvolvement.fromDiffs([{ file: "old.ts", patch, additions: 0, deletions: 2, status: "deleted" }]),
    ).toEqual([{ file: "old.ts", status: "deleted", additions: 0, deletions: 2, ranges: [{ start: 1, end: 2 }] }])
  })

  test("does not throw when patch is missing", () => {
    expect(SessionInvolvement.fromDiffs([{ file: "untouched.ts", additions: 0, deletions: 0 }])).toEqual([
      { file: "untouched.ts", status: "modified", additions: 0, deletions: 0, ranges: [] },
    ])
  })
})

describe("session involvement report", () => {
  test("formats several files with totals and line ranges", () => {
    const text = SessionInvolvement.formatReport("ses_xxx", [
      { file: "packages/app/src/foo.ts", status: "modified", additions: 42, deletions: 10, ranges: [{ start: 12, end: 40 }, { start: 88, end: 95 }] },
      { file: "packages/app/src/bar.ts", status: "added", additions: 0, deletions: 8, ranges: [{ start: 1, end: 60 }] },
      { file: "README.md", status: "deleted", additions: 0, deletions: 0, ranges: [] },
    ])

    expect(text).toBe(
      [
        "AI involvement — session ses_xxx",
        "3 files, +42 / -18",
        "",
        "- packages/app/src/foo.ts (modified)  lines 12–40, 88–95",
        "- packages/app/src/bar.ts (added)  lines 1–60",
        "- README.md (deleted)",
      ].join("\n"),
    )
  })

  test("formats an empty session without crashing", () => {
    expect(SessionInvolvement.formatReport("ses_empty", [])).toBe("AI involvement — session ses_empty\n0 files, +0 / -0")
  })
})
