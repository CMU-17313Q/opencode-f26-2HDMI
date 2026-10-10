import { describe, expect, test } from "bun:test"
import { toSessionInvolvementMarkdown, toSessionInvolvementRows } from "@opencode-ai/session-ui/session-involvement"
import { copyInvolvementMarkdown } from "./involvement-clipboard"

function recordingClipboard() {
  const written: string[] = []
  return {
    written,
    writeText: async (text: string) => {
      written.push(text)
    },
  }
}

describe("copyInvolvementMarkdown", () => {
  test("writes the exact markdown report and reports success", async () => {
    const clipboard = recordingClipboard()
    const markdown = "# AI involvement summary\n\n1 file changed\n\n- `a.ts` — modified (+1 -0): lines 3\n"

    expect(await copyInvolvementMarkdown(markdown, clipboard)).toBe(true)
    expect(clipboard.written).toEqual([markdown])
  })

  test("copies the same report the Review summary builds from session diffs", async () => {
    const clipboard = recordingClipboard()
    const patch = ["--- /dev/null", "+++ b/src/new.ts", "@@ -0,0 +1,2 @@", "+line one", "+line two", ""].join("\n")
    const rows = toSessionInvolvementRows([{ file: "src/new.ts", patch, additions: 2, deletions: 0, status: "added" }])

    expect(await copyInvolvementMarkdown(toSessionInvolvementMarkdown(rows), clipboard)).toBe(true)
    expect(clipboard.written).toEqual([
      "# AI involvement summary\n\n1 file changed\n\n- `src/new.ts` — added (+2 -0): lines 1-2\n",
    ])
  })

  test("copies a valid empty report when the session has no changes", async () => {
    const clipboard = recordingClipboard()

    expect(await copyInvolvementMarkdown(toSessionInvolvementMarkdown([]), clipboard)).toBe(true)
    expect(clipboard.written).toEqual(["# AI involvement summary\n\nNo changes in this session.\n"])
  })

  test("reports failure instead of throwing when the browser denies clipboard access", async () => {
    const clipboard = {
      writeText: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")),
    }

    expect(await copyInvolvementMarkdown("# AI involvement summary\n", clipboard)).toBe(false)
  })

  test("reports failure when the Clipboard API is unavailable", async () => {
    expect(await copyInvolvementMarkdown("# AI involvement summary\n", null)).toBe(false)
  })
})
