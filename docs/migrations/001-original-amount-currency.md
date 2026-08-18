# Migration 001: Original Amount and Currency

Status: Release A is merged into `staging`; the production backfill must run before Release B.

## Scope

This migration affects the ledger amount fields on:

- `expenses`
- `incomings`
- `recurrings`

For existing rows, `originalAmount` is copied from `amount` and
`originalCurrency` is set to `ILS`. No amount conversion is performed.

## Rollout stages

### Release A: expand and dual-write

Release A adds optional `originalAmount` and `originalCurrency` fields,
keeps the legacy `amount` field required, dual-writes both representations,
and adds compatibility reads for legacy rows.

This stage is safe to deploy while rows still have only `amount`.

### Backfill: migrate and verify

Run the numbered runner after Release A is deployed to the target production
deployment and before Release B:

```sh
npm run convex:backfill-original-amount-currency -- --prod
```

The runner processes each table in bounded, repeatable batches. Verify the
result with:

```sh
npx convex run "migrations/001_original_amount_currency:verify" '{}' --prod
```

The `missing` count must be `0` for all three tables before Release B is
promoted.

The backfill is idempotent: rerunning it should find no rows to patch.

### Release B: canonicalize and contract

Release B makes `originalAmount` and `originalCurrency` required canonical
storage fields. It accepts legacy `amount` mutation payloads and returns an
`amount` response alias so existing clients can continue working.

Release B must not be deployed until the backfill verification passes.

## Compatibility matrix

| Scenario                               | Supported? | Reason                                                                          |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Release A reads legacy rows            | Yes        | Compatibility reads fall back to `amount`.                                      |
| Old client writes to Release A         | Yes        | A keeps the old `amount` input and dual-writes.                                 |
| Release B reads backfilled rows        | Yes        | Required canonical fields are present.                                          |
| Old client writes to Release B         | Yes        | B accepts legacy `amount` and canonicalizes it.                                 |
| Release B before backfill              | No         | The required-field schema gate must stop this rollout.                          |
| Blind rollback from B to an old server | No         | B can create rows without legacy `amount`; rollback must be planned separately. |

## Test coverage

The numbered Convex test covers:

- legacy rows with only `amount`;
- batched backfill across all three tables;
- verification of zero missing fields;
- safe reruns after completion.

Release B extends this coverage with canonical-row and compatibility behavior.

## Migration history

- `001`: add original ledger amount and currency fields; backfill legacy rows.
- Future unrelated data migrations should receive the next unused number and
  keep this migration implementation unchanged.
