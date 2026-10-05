# HDR UK integration: handover summary

**As of:** 2026-10-05 · **From:** Călina Cenan → **To:** Neptali Vasquez
**Repos:** `data-interop-service` (DIS, GitHub) and `Catalog` (AD Discovery Catalog / GRIP, Azure DevOps)
**Epic:** GRP-4201. Related tickets: GRP-5015, GRP-5016, GRP-5472.

The full, maintained docs are on the DIS branch `docs/hdruk-handover`, which is **local and not yet committed**:

- `docs/SOWs/HDRUK/README.md`: status and reference.
- `docs/SOWs/HDRUK/NEXT-STEPS.md`: prioritised work queue.
- `docs/Providers/HDRUK/`: API usage.

This file is a condensed, standalone version of those docs.

---

## 1. What it is

The integration moves dataset metadata between ADDI's AD Discovery Catalog and the HDR UK Gateway, in both directions:

| Direction | DIS provider | Who calls whom | Data |
| --- | --- | --- | --- |
| **Pull**: HDR UK → Catalog | `hdruk` | The Catalog cron `SyncJob_HDRUK` (03:00 UTC daily) → DIS → HDR UK Collections API | ADDI's HDR UK collection `143`, 9 datasets (8 in HDRUK v3.0.0, 1 in v4.0.0) |
| **Push**: Catalog → HDR UK | `grip-hdruk` | HDR UK's federation harvester → DIS → Catalog API | ADDI's own datasets with `accessLevel = "Local data access"` and `catalogueName = "ADWB"` (36 of 175 on stage) |

DIS only translates between formats.
It stores nothing permanently, except the pull's job results.

---

## 2. Status at a glance

| | Pull (`hdruk`) | Push (`grip-hdruk`) |
| --- | --- | --- |
| DIS code | Complete | Complete for the level-0 scope |
| DIS deployed | Staging (`main`) and production (`v1.1.8-hdruk-only`) | Same |
| Catalog side | Cron, per-provider credentials and seed data on `catalogdev` + `grip3stage`. **Not on production (`adwblive`)** | `dis-svc` Keycloak client exists. Stage credential verified; **production credential not provisioned** |
| HDR UK side | Public API, no setup needed | Preprod federation `92` (team `154`) → `dis-staging`: **working**. Production (team `172`): **not registered** |
| **Works end to end?** | **No.** See §4.1 | **Preprod only** |

Tests: 162 HDR UK unit tests and the full DIS suite (789) pass.
There are no tests for the push plugin, the federation auth, or the routes.

---

## 3. How it works

### Pull

1. The Catalog calls `GET /api/dis/v1/catalog/studies?providerId=hdruk`, with two headers:
   - `X-API-Key`: the DIS platform key.
   - `personalAccessToken`: the `HDRUK-PERSONAL-ACCESS-TOKEN` secret.
2. DIS fetches `GET https://api.healthdatagateway.org/api/v1/collections/143`, with no auth.
   Every DIS environment reads the **production** Gateway.
3. DIS maps each record with `mapper.from_hdruk()` (v3 and v4 shapes are both handled).
   It saves the results to a JSON file on the container's local disk and the job row to the DB.
4. The Catalog then:
   - Polls `/catalog/studies/status`.
   - Calls `/catalog/metadata` for each study.
   - Maps the results with the `HDRUK` syndication mapping and imports them.

### Push

1. HDR UK's harvester calls `GET /api/dis/v1/catalog/grip-hdruk/datasets` with header `apikey: <GRIP-HDRUK-FEDERATION-API-KEY>`.
2. DIS gets a Catalog token with `client_credentials`, using the `dis-svc` client.
   It fetches all Catalog datasets, caches them for 60 s in a file, and keeps only the level-0 scope.
   The optional env var `GRIP_HDRUK_SAMPLE_DATASET_CODES` narrows that further.
3. DIS returns `{"items": [ GMI listing items ]}`, keyed by `persistentId`, which is a stable UUIDv5.
4. The harvester fetches each new or changed item's `self` URL, which returns the full **HDRUK v4.0.0** record.
5. **Never change** `mapper._IDENTIFIER_NAMESPACE` or the identifier seed once production is live. HDR UK would see every dataset as new.

Key code (DIS, under `code/backend/`):

- `providers/hdruk/catalog_plugin.py`
- `providers/hdruk/mapper.py`
- `providers/grip_hdruk/catalog_plugin.py`
- `helpers/auth_policy.py`
- `helpers/deps.py`
- `routes/catalog.py`
- Migration `c4e8a06f2b91`

Key code (Catalog):

- `backend/Connectors/src/GRIP.Connectors.DataInteropService/`
- `.../Syndication/Providers/DataInteropService/DataInteropServiceConnector.cs`
- `cfg/environments/{catalogdev,grip3stage}.yaml`
- `src/specifications/seeds/grip/{SyndicationMappingConfigurations/HDRUK.json, EntityTemplates/hdruk/, Catalogues/catalogues.json}`

---

## 4. Problems found in this review (priority order)

### 4.1 The pull doesn't work end to end. All four fixes are in DIS.

1. **Records aren't wrapped in `{"entity": …}`.** The Catalog's `StudyDto` requires that wrapper; SAGE already returns it.
   I fed Catalog's own client code the response DIS gives today, and it threw `EntityValidationException`. That stops the whole sync run.
2. **No `acronym`.** The Catalog skips studies without one and uses it to tell studies apart.
   On live data, 0 of 9 records have it. `externalId` is unique, so it's a good candidate value.
3. **`/catalog/metadata?providerId=hdruk` returns 500.** The method raises `NotImplementedError`, and the Catalog then drops each study.
   Fix: return "completed, no files" in the shapes the Catalog expects.
4. **Results are stored on container-local disk.** A poll that hits another replica, or comes after a restart, gets "Result file not found" and is treated as zero studies.
   This likely explains the "No mappings found for catalogue HDRUK" error Calina saw, but that is unconfirmed; check staging logs.
   Fix: store the results in the DB (`job_metadata`).
5. Minor: with a 24 h TTL and a cron that runs daily at 03:00, the data refreshes only about every other day. Set the TTL to about 20 h.

**Effect:** Calina's last Catalog PR (3161, Oct 2: seed data) fixed one error, but HDR UK datasets still won't appear until items 1–4 are fixed.

### 4.2 The push isn't safe to enable in production yet

1. **Fake data fallback.** With no Catalog token, or if the Catalog call fails, DIS serves a fake sample dataset (`syn12345678`).
   Production has no Catalog credential yet, so production would serve that fake dataset today.
   Fix: allow the fallback only in development.
2. **No production Catalog credential.** The GRIP team (Cory White) needs to copy `dis-svc` from realm `adwblivemain` into `grip-dis-keyvault-shared`, as `GRIP-SYSTEM-CLIENT-ID-prod` and `GRIP-SYSTEM-CLIENT-SECRET-prod`.
3. **Leaked, shared federation key.** `GRIP-HDRUK-FEDERATION-API-KEY` is a single secret shared by every environment, and its value is the "test" key written in plaintext in two `reports/` files.
   Fix:
   - Create `GRIP-HDRUK-FEDERATION-API-KEY-production` with a new value.
   - Rotate staging, and update federation 92 in the HDR UK UI at the same time.
   - Remove the key from the reports.
4. **Placeholders HDR UK would publish.** These need owner decisions:
   - A fake ROR ID (`https://ror.org/00000plchd`).
   - `observationDate` / `startDate` = 2026-01-01 for every dataset.
   - `spatial = "US"`.
   - `publishingFrequency = Static`, `timeLag = Not applicable`.
5. **Unanswered question for HDR UK:** do the extra-schema errors in their run log (CRUK, GWDM, HDRUK 2.x/3.0, SchemaOrg) block acceptance?
6. Minor:
   - An unknown dataset id returns 400 instead of 404.
   - Some code comments are stale.
   - The `HDRUK_FEDERATION_API_KEY` key in the DB config is unused.

### 4.3 Deployment oddity

Production runs `v1.1.8-hdruk-only`, tagged from `release/hdruk-only-v1.1.6`.
That branch starts from a July 1 base and carries only the cherry-picked HDR UK commits.
The HDR UK code on `main` is identical to it.
`main` is ahead only by:

- GRP-537 (#156)
- A docs PR (#153)
- The DUA change and its revert (#161/#162, net zero)

The next production release can be tagged from `main`. Then delete the release branch.
Note that any `v*` tag deploys staging, pre-prod **and production** at once.

---

## 5. Next steps checklist

**Engineering (DIS):**
- [ ] Fix pull items 4.1.1–4.1.4. Then test on `grip3stage` and confirm 9 HDR UK datasets appear in the catalogue.
- [ ] Remove the fake-data fallback outside development (4.2.1).
- [ ] Add tests for `GripHdrukCatalog`, the federation auth and the `grip-hdruk` routes.

**Catalog:**
- [ ] Add an `HDRUK` syndication entry to `adwblive.yaml` (production `main` org) that points at `dis-prod`, using the `hdruk-personal-access-token-live` secret.

**Secrets (ask the GRIP team; DIS has no write access to `grip-dis-keyvault-shared`):**
- [ ] `GRIP-SYSTEM-CLIENT-ID-prod` / `-SECRET-prod`, copied from `dis-svc` in `adwblivemain`.
- [ ] `GRIP-HDRUK-FEDERATION-API-KEY-production` with a new value. Also rotate the staging value.
- [ ] Check that the production pull token exists as `HDRUK-PERSONAL-ACCESS-TOKEN-production` (or the bare name).
      DIS never reads a `-live` suffix, but Calina's notes say `-live`.

**Decisions (ADDI or business):**
- [ ] ADDI's real ROR ID, and whether the placeholder dates and spatial value are acceptable.
- [ ] Which datasets beyond level 0 may be shared with HDR UK, and on what terms.
- [ ] Whether HDR UK datasets should appear in the production catalogue.

**HDR UK production registration (after the items above):**
- [ ] Register a federation for team `172` in HDR UK's **web UI**.
  Use the same shape as preprod federation `92`, with `endpoint_baseurl = https://dis-prod.alzheimersdata.org/api/dis/v1/catalog/grip-hdruk/`.
- [ ] Start with `enabled: false` and `GRIP_HDRUK_SAMPLE_DATASET_CODES` set to one dataset.
- [ ] Test → Run → confirm on healthdatagateway.org → widen the scope.

**Handover:**
- [ ] Get your own HDR UK accounts on teams `154` and `172`, with the `integrations.metadata` permission. The preprod login is currently Calina's personal Google account, `calina@cenan.net`. Kelly provisioned these accounts last time.
- [ ] Change federation 92's notification contact. It is currently `calina@cenan.net`, notification id 477.
- [ ] Ask Calina to forward the email threads: HDR UK (Richard / Loki) and the GRIP team Key Vault asks.
- [ ] Ask Calina for her Claude Code memory files: `hdruk_push_staging_test_2026-09-21.md` and `grip-dis-keyvault-shared-access`. The plan cites them, but they aren't in any repo.
- [ ] Commit the `docs/hdruk-handover` branch and open a PR.

---

## 6. Cheat sheet

**Hosts**

| | Staging | Production |
| --- | --- | --- |
| DIS | `https://dis-staging.alzheimersdata.org` (runs `main`) | `https://dis-prod.alzheimersdata.org` (runs `v1.1.8-hdruk-only`) |
| HDR UK API | `https://api.preprod.hdruk.cloud` | `https://api.healthdatagateway.org` |
| HDR UK UI | `https://web.preprod.hdruk.cloud` | `https://healthdatagateway.org` |
| HDR UK team / federation | `154` / `92` (enabled, harvesting `dis-staging`) | `172` / none |
| Catalog Keycloak realm | `gripstagehybrid` @ `stage.grip-research.org` | `adwblivemain` @ `discover.alzheimersdata.org` |

**Secrets.** All are in Key Vault `grip-dis-keyvault-shared` (subscription "GRIP - ADRC", owned by the GRIP team).
DIS looks up `NAME-<ENVIRONMENT>` first, then the bare `NAME`.

| Secret | Purpose |
| --- | --- |
| `HDRUK-PERSONAL-ACCESS-TOKEN[-staging \| -production]` | Pull auth. Must equal the Catalog's `hdruk-personal-access-token-<env>` |
| `GRIP-HDRUK-FEDERATION-API-KEY[-production]` | Push auth. Must equal the federation's `auth_secret_key` at HDR UK |
| `GRIP-SYSTEM-CLIENT-ID/SECRET-{stage \| prod}` | The Catalog service credential the push uses (`dis-svc`) |
| `DIS-PLATFORM-API-KEY` | `X-API-Key` on the pull. The Catalog stores it as `sage-api-key[-live]` |

**DIS environment variables**

- `GRIP_HDRUK_SAMPLE_DATASET_CODES`: staged-rollout filter.
- `GRIP_HDRUK_SERVICE_TOKEN`: a manually pasted Catalog token, for one-off tests.
- `ENVIRONMENT`: selects the secret suffix and the token endpoint.

**HDR UK federation gotchas**

- Use their web UI, not `curl` (HDR UK asked for this).
- `auth_type` must be exactly `API_KEY`.
- `run_time_minute` is required and must be a string, such as `"00"`.
- `notifications` must be emails or numeric ids.
- `/run` needs the stored record to be enabled, tested and not already running.
- Register the path-scoped URL. Never use `?providerId=…`, because the harvester drops query strings.

**Quick test (push)**

```bash
curl -H "apikey: <key>" https://dis-staging.alzheimersdata.org/api/dis/v1/catalog/grip-hdruk/datasets
```

**People**

- Kelly: ADDI's HDR UK account provisioning.
- Matt: Data Custodian registration contact.
- Richard / Loki: HDR UK technical contacts.
- Cory White: GRIP platform, Keycloak, Key Vault.

---

## 7. Inventory of Calina's work

### DIS (`data-interop-service`)

| When | PR / commit | What |
| --- | --- | --- |
| 2026-07-08 | #146 (merged by Lawrence; Calina co-author; branch `hdruk-first`) | Phase 1 scaffold and Phase 2 pull: both providers, migration `c4e8a06f2b91`, `from_hdruk` (v3 + v4), `HdrukAuthPolicy`, tests, SOW / plan / schema-mapping docs |
| 2026-07-09 | #154 | Provider API docs (`docs/Providers/HDRUK/`) |
| 2026-09-21 | #155 (branch `hdruk-push`, 2 months of work) | Push: `GripHdrukCatalog`, `to_hdruk` / `to_hdruk_listing` (GMI split), path-scoped routes, federation auth, level-0 scope filter, `client_credentials` service token, federation debugging reports |
| 2026-09-21 | `bffdcf7` | Docs update |
| 2026-09-22 | #157 (GRP-5472) | Default publisher name (schema fix), nginx `X-Forwarded-Proto` passthrough |
| 2026-09-22 | #158 (GRP-5472) | Real `issued` / `modified` from the Catalog's `createdDate` / `lastUpdatedDate` |
| 2026-09-24 | #159 | Entities cache, fixing N+1 Catalog fetches that timed out the harvester |
| 2026-09-24 | #160 | File-backed cache shared across the 8 uvicorn workers |
| 2026-09-23/24 | Tags `v1.1.6/7/8-hdruk-only` | Production releases from `release/hdruk-only-v1.1.6` |
| Earlier | #145 (Jun), branch `temp-calina-dec5` (Dec 2025) | Not HDR UK: SAGE empty-dataLink filter; workspace-filtering experiments |

On preprod, Calina also debugged five server-side bugs with HDR UK (July–August) until federation 92 worked.
The full trail is in `reports/hdruk-federation-registration-attempt-2026-07-21.md`.

### Catalog

| When | PR | What |
| --- | --- | --- |
| 2026-09-08 | PR 2893 (GRP-5016) | HDR UK pull calls: per-provider DIS credentials (`CredentialsFor`), `HDRUK` syndication config on `catalogdev` and `grip3stage`, unit tests |
| 2026-10-02 | PR 3161 (GRP-5016) | HDR UK seed data: syndication mapping, entity templates, catalogue entry. Deployment not verified |
| 2026-09-14 | PR 2984 (GRP-5015, **by Cory White**) | `dis-svc` Keycloak client that the push relies on |
| Sep 2026 | PRs 2971, 2980, 3011, 3013, 3128 | Not HDR UK: CUI notice text and styling (GRP-5229, 5080, 5388) |
| 2026-09-08 | Branch `calina/grp-3781-dcc-fixes`, **unmerged** | Not HDR UK: review fixes on KaHo's DCC feature (55 files). Ask the DCC owner (Andrew) whether it's still wanted |
