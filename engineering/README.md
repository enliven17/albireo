# Architecture investigation

Evidence and proposals from the 15 November 2026 technical review:

- [Selected technical baseline](2026-11-15-decisions.md): resolved stack/architecture choices, everyday coding rules, and assumption disposition. This supersedes conflicting earlier recommendations.
- [Stack decision lab](../experiments/stack/README.md): package compatibility and architecture assumption tests.
- [Decision-lab findings](../experiments/stack/FINDINGS.md): final results, evidence, and limits.
- [Architecture proposal](2026-11-15-architecture.md): responsibilities, data flow, tradeoffs, and production acceptance gates.
- [Current stack research](2026-11-15-stack-research.md): dated primary sources and what we should adopt, evaluate, or defer.
- [Reliability experiment](../experiments/reliability/README.md): reproduction instructions and fixture boundaries.
- [Experiment findings](../experiments/reliability/FINDINGS.md): measured outcomes and what they establish.

The user selected **Umami internally behind Albireo** and subsequently delegated the remaining technical choices and tests. The selected baseline records those engineering decisions. Experiment code remains disposable investigation code; the application has not been migrated.

These files live in `engineering/` because the repository currently ignores `/docs`.
