type ClipboardWriter = Pick<Clipboard, "writeText">

// Resolves to false instead of throwing so the caller can show a failure toast.
// The clipboard is a parameter so tests can pass a stand-in without touching navigator.
// null means the Clipboard API is unavailable (for example on a non-secure origin).
export function copyInvolvementMarkdown(markdown: string, clipboard: ClipboardWriter | null = browserClipboard()) {
  if (!clipboard) return Promise.resolve(false)
  return clipboard.writeText(markdown).then(
    () => true,
    () => false,
  )
}

function browserClipboard() {
  if (typeof navigator === "undefined") return null
  return navigator.clipboard ?? null
}
