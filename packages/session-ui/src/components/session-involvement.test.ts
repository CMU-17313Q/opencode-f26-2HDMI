import { describe, expect, test } from "bun:test"
import { toSessionInvolvementRows } from "./session-involvement"

describe("session involvement", () => {
  test("returns an empty list for no diffs", () => {
    expect(toSessionInvolvementRows([])).toEqual([])
  })
})
