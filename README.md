# The Tribunal

ASE-26 running project. A seven-agent deliberation over one fixed case.

Four advocates (two defence, two prosecution) each produce an independent
argument from the charge sheet. Three judges, each modelled on a distinct
judicial method, then read the charge sheet and all four arguments and each
produce an opinion. The three opinions are reported side by side and are never
combined into a single verdict.

## The case
T-001, The Realm v. Jon Snow. See `specs/charge-sheet.yaml` — the charge sheet
is a structured specification, not prose, and it is the only source of
established fact in the system.

## Layout
    specs/     the charge sheet specification
    prompts/   the seven agent prompts, versioned
    config/    run configurations (single-model and multi-model)
    runs/      committed output of each run: protocol, verdicts, cost
    docs/      decisions, prompt changelog, lessons learned

## Status
Work in progress. See PLAN.md.
