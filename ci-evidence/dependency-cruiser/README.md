# dependency-cruiser check: evidence

- `local-run-pass.txt`: `bun run check:deps` on this branch. 0 violations, 539 modules, 2180 dependencies.
- `local-run-violation-test.txt`: same command with three deliberate wrong-direction imports added for the test and removed afterwards. All three were caught and the command exited non-zero.
- CI: `.github/workflows/dependency-cruiser.yml` runs on PRs to `main` and pushes to `main`, and uploads the report as the `dependency-cruiser-report` artifact.

## What we installed

- `dependency-cruiser` pinned to `18.7.0` in the root `devDependencies` (`package.json`, `bun.lock`)
- `.dependency-cruiser.cjs`: layering rules from AGENTS.md
- `check:deps` script in the root `package.json`
- `.github/workflows/dependency-cruiser.yml`: separate job, independent of unit, typecheck, and e2e

## Changes from the design doc

1. **Circular-dependency rule narrowed to cross-package cycles.** The first real run reported 406 `no-circular` errors, all inside single packages (mostly `packages/core`):
   - 236 were false positives from the repo's self-export pattern (`export * as Foo from "./foo"`), which dependency-cruiser treats as a file importing itself.
   - 170 were real cycles inside `packages/core`, inherited from upstream OpenCode.

   There were 0 cycles crossing package boundaries. The design doc's goal is layering, so the rule (`no-cross-package-circular`) now flags only cycles that pass through more than one package. Fixing core's internal cycles would mean changing upstream application code, which is out of scope.
2. **Design doc's import count was incomplete.** Core also imports `llm`, `plugin`, `sdk`, and `effect-drizzle-sqlite`, not just Schema. AGENTS.md doesn't restrict those, so the rules only constrain the six layered packages (schema, core, protocol, server, client, sdk-next) against each other.
3. **Added `not-to-unresolvable`.** In the violation test, an undeclared import (`@opencode-ai/server` from schema) was *not* caught at first. Bun only links a workspace package into the `node_modules` of packages that declare it, so the import never resolved to a path the layer rules could match. The new rule fails on any unresolved import. The current code has 0 unresolved imports, so it adds no noise.
4. **Client generator excluded.** `packages/client` lists Core and Server as devDependencies for its code generator (`packages/client/script`). AGENTS.md restricts client *runtime* code only, so the client rule covers `packages/client/src` only.
5. **Runs under Bun's Node runtime (`bun --bun`).** dependency-cruiser 18.7.0 refuses to start on Node 25 (it supports `^22 || ^24 || >=26`). Running through Bun makes the script work locally regardless of the system Node version. CI also sets up Node 24.
6. **False positive on the first CI run: `node:sqlite`.** The first GitHub Actions run failed with `not-to-unresolvable: packages/core/src/database/sqlite.node.ts → node:sqlite`. dependency-cruiser takes its list of built-in modules from the runtime it runs on. CI uses Bun 1.3.14 (pinned in `packageManager`), whose list doesn't include `node:sqlite`. My local Bun 1.4.2 does, so the local run passed. The fix adds `node:sqlite`, `sqlite`, and `bun:sqlite` through `builtInModules.add` in `.dependency-cruiser.cjs`. I reproduced the failure locally with Bun 1.3.14 and confirmed the fix, then regenerated both evidence files with Bun 1.3.14 to match CI.
7. **`bun.lock` cleanup.** Installing the package made Bun prune a few orphaned lock entries (e.g. `@vitest/coverage-v8`) that no `package.json` references.

Still to do after merge: a repo admin adds `dependency-cruiser` as a required status check on `main`.
