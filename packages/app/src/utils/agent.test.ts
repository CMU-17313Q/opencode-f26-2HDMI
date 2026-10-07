import { describe, expect, test } from "bun:test"
import { agentColor, agentLabel } from "./agent"

describe("agentColor", () => {
  test("gives Learn its own tutor color", () => {
    expect(agentColor("learn")).toBe("var(--icon-agent-learn-base)")
    expect(agentColor("Learn")).toBe("var(--icon-agent-learn-base)")
    expect(agentColor("learn")).not.toBe(agentColor("build"))
  })
})

describe("agentLabel", () => {
  test("labels Learn as a tutor and leaves other agents alone", () => {
    const t = () => "Learn (tutor)"
    expect(agentLabel("learn", t)).toBe("Learn (tutor)")
    expect(agentLabel("build", t)).toBe("build")
  })
})
