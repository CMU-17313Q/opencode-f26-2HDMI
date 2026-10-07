import { describe, expect, test } from "bun:test"
import { agentColor } from "./agent"

describe("agentColor", () => {
  test("gives Learn its own tutor color", () => {
    expect(agentColor("learn")).toBe("var(--icon-agent-learn-base)")
    expect(agentColor("Learn")).toBe("var(--icon-agent-learn-base)")
    expect(agentColor("learn")).not.toBe(agentColor("build"))
  })
})
