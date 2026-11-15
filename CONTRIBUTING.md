# Contribution conventions

Use conventional prefixes for branches and commits.

- Branches: `feat/<description>`, `fix/<description>`, `chore/<description>`; use
  `docs/`, `refactor/`, `test/`, `perf/`, `build/` or `ci/` when appropriate.
- Commits: `<type>: <description>` or `<type>(<scope>): <description>`, following
  Conventional Commits. Use the same types listed above.
- Use short, lowercase, hyphen-separated branch descriptions. Do not use an
  agent or tool name as a branch prefix or commit type.

Examples: `feat/ingress-service`, `fix/receipt-validation`,
`chore/security-dependencies`, and `fix(ingestion): reject malformed events`.
