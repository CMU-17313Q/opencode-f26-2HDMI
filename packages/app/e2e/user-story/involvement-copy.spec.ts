import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/InvolvementCopy"
const projectID = "proj_involvement_copy"
const sessionID = "ses_involvement_copy"
const title = "Involvement copy"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

const newFilePatch = [
  "diff --git a/src/new.ts b/src/new.ts",
  "new file mode 100644",
  "index 0000000..1a2b3c4",
  "--- /dev/null",
  "+++ b/src/new.ts",
  "@@ -0,0 +1,2 @@",
  "+line one",
  "+line two",
  "",
].join("\n")

test.use({ viewport: { width: 1440, height: 900 } })

test("copies the involvement summary markdown from the Review panel", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await openSessionWithChanges(page)

  const summary = page.locator('#review-panel [data-component="session-involvement-summary"]')
  await expect(summary.locator('[data-slot="session-involvement-row"]')).toHaveCount(1)
  await summary.getByRole("button", { name: "Copy involvement summary" }).click()

  await expect(page.getByText("Involvement summary copied", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "# AI involvement summary\n\n1 file changed\n\n- `src/new.ts` — added (+2 -0): lines 1-2\n",
  )
})

test("shows an error toast when the browser blocks clipboard access", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) },
    })
  })
  await openSessionWithChanges(page)

  const summary = page.locator('#review-panel [data-component="session-involvement-summary"]')
  await summary.getByRole("button", { name: "Copy involvement summary" }).click()

  await expect(page.getByText("Failed to copy involvement summary", { exact: true })).toBeVisible()
  await expect(page.getByText("Involvement summary copied", { exact: true })).toHaveCount(0)
})

async function openSessionWithChanges(page: Page) {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "involvement-copy-project",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { test: { id: "test", name: "Test", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    vcsDiff: [{ file: "src/new.ts", patch: newFilePatch, additions: 2, deletions: 0, status: "added" }],
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(
    (input) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: input.directory, expanded: true }] },
          lastProject: { local: input.directory },
        }),
      )
      localStorage.setItem(
        "opencode.global.dat:layout",
        JSON.stringify({ review: { diffStyle: "split", panelOpened: true } }),
      )
      localStorage.setItem(
        "opencode.window.browser.dat:tabs",
        JSON.stringify([{ type: "session", server: input.server, sessionId: input.sessionID }]),
      )
    },
    { directory, server, sessionID },
  )
  await page.goto(`/server/${base64Encode(server)}/session/${sessionID}`)
  await expectSessionTitle(page, title)
}
