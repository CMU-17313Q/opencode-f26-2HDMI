import { createMemo, For, Show } from "solid-js"
import { useI18n } from "@opencode-ai/ui/context/i18n"
import { DiffChanges } from "@opencode-ai/ui/diff-changes"
import { IconButton } from "@opencode-ai/ui/icon-button"
import {
  toSessionInvolvementMarkdown,
  toSessionInvolvementRows,
  type SessionInvolvementDiff,
} from "./session-involvement"

const statusKey = {
  added: "ui.sessionReview.change.added",
  deleted: "ui.sessionReview.change.removed",
  modified: "ui.sessionReview.change.modified",
} as const

export function SessionInvolvementSummary(props: {
  diffs: SessionInvolvementDiff[]
  class?: string
  downloadLabel?: string
  onDownload?: (markdown: string) => void
}) {
  const i18n = useI18n()
  const rows = createMemo(() => toSessionInvolvementRows(props.diffs))

  return (
    <section
      data-component="session-involvement-summary"
      aria-label={i18n.t("ui.sessionReview.title")}
      class={`shrink-0 flex flex-col gap-2 px-4 py-3 border-b border-border-weak-base ${props.class ?? ""}`}
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-12-medium text-text-strong">{i18n.t("ui.sessionReview.title")}</h2>
        <div class="flex items-center gap-2">
          <Show when={rows().length > 0}>
            <div data-slot="session-involvement-totals" class="flex items-center gap-2 text-12-regular text-text-weak">
              <span>{i18n.plural("ui.sessionTurn.diffs.changed", rows().length)}</span>
              <DiffChanges changes={rows()} />
            </div>
          </Show>
          <Show when={props.onDownload}>
            {(onDownload) => (
              <IconButton
                data-slot="session-involvement-download"
                icon="download"
                size="normal"
                variant="ghost"
                aria-label={props.downloadLabel}
                title={props.downloadLabel}
                onClick={() => onDownload()(toSessionInvolvementMarkdown(rows()))}
              />
            )}
          </Show>
        </div>
      </div>
      <Show
        when={rows().length > 0}
        fallback={
          <div data-slot="session-involvement-empty" class="text-12-regular text-text-weak">
            {i18n.t("ui.sessionReviewV2.empty.changes.title")}
          </div>
        }
      >
        <ul class="flex flex-col gap-1 max-h-48 overflow-y-auto">
          <For each={rows()}>
            {(row) => (
              <li
                data-slot="session-involvement-row"
                data-status={row.status}
                class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-12-regular"
              >
                <span class="truncate text-text-base" title={row.file}>
                  {row.file}
                </span>
                <DiffChanges changes={row} />
                <div class="col-span-2 flex flex-wrap items-center gap-x-2 text-text-weak">
                  <span data-slot="session-involvement-status" class="text-text-base">
                    {i18n.t(statusKey[row.status])}
                  </span>
                  <For each={row.lineRanges}>
                    {(range) => (
                      <span data-slot="session-involvement-range" class="tabular-nums">
                        {range.start === range.end ? range.start : `${range.start}–${range.end}`}
                      </span>
                    )}
                  </For>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
