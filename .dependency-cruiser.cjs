// Enforces the package layering described in AGENTS.md:
//   Schema -> Core and Protocol -> Server
//   Client may depend on Schema and Protocol, never Core or Server
//   sdk-next is the only package that composes Client, Core, and Server
// Workspace imports such as "@opencode-ai/core" resolve through symlinks to
// packages/<name>/src, so the rules below match on the resolved paths.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "schema-is-the-base-layer",
      comment: "Schema is the bottom layer and must not import any other layered package.",
      severity: "error",
      from: { path: "^packages/schema/src/" },
      to: { path: "^packages/(core|protocol|server|client|sdk-next)/" },
    },
    {
      name: "core-not-to-upper-layers",
      comment: "Core sits below Server, Client, and sdk-next and must not import them.",
      severity: "error",
      from: { path: "^packages/core/src/" },
      to: { path: "^packages/(server|client|sdk-next)/" },
    },
    {
      name: "protocol-not-to-upper-layers",
      comment: "Protocol sits below Server, Client, and sdk-next and must not import them.",
      severity: "error",
      from: { path: "^packages/protocol/src/" },
      to: { path: "^packages/(server|client|sdk-next)/" },
    },
    {
      name: "server-not-to-client-or-sdk-next",
      comment: "Server may depend on Core and Protocol, but not on Client or sdk-next.",
      severity: "error",
      from: { path: "^packages/server/src/" },
      to: { path: "^packages/(client|sdk-next)/" },
    },
    {
      name: "client-runtime-only-schema-and-protocol",
      comment:
        "Client runtime code may depend on Schema and Protocol but never Core or Server. " +
        "Core and Server are devDependencies used only by the generator in packages/client/script.",
      severity: "error",
      from: { path: "^packages/client/src/" },
      to: { path: "^packages/(core|server|sdk-next)/" },
    },
    {
      name: "not-to-unresolvable",
      comment:
        "Workspace packages are only linked into node_modules of packages that declare them, so an " +
        "undeclared wrong-direction import (e.g. schema importing @opencode-ai/server) fails to resolve.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-cross-package-circular",
      comment:
        "A cycle that passes through more than one package means two layers depend on each other. " +
        "Cycles inside a single package (including the self-export pattern `export * as Foo from './foo'`) " +
        "are upstream design choices and are not checked here.",
      severity: "error",
      from: { path: "^packages/([^/]+)/" },
      to: { circular: true, viaSomeNot: "^packages/$1/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|test|generated-effect-test)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "bun", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".d.ts"],
      mainFields: ["module", "main", "types"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
