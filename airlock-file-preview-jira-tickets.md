# Jira tickets: Airlock file preview for reviewers

*Drafted 2026-09-28. Estimates are in developer-days for one developer. The spike (AFP-1) and the product decision (AFP-2) come first; the estimates for the other tickets assume both go as expected.*

---

## EPIC: Let airlock reviewers view the files they are approving

**Problem.** Airlock (file export) reviewers, including workspace owners, admins and third-party reviewers, only see file names and sizes. They cannot open a file before approving or rejecting it, so a real review isn't possible. Downloading only works after approval, and third-party reviewers can't download at all.

**Goal.** From the airlock request popup, an authorised reviewer can open each file in the request and view its contents in the browser. Every view is audited. No extra copies of the data are created, and no direct storage links are exposed to the browser.

**How it works today (from code review).**
- On creation, Workspaces Core zips the selected files into one zip in a blob container named after the request, in the workspace's storage account (`stgws…`).
- On approval, the zip moves to download storage and the review copy is deleted.
- The Workspaces API only offers a whole-zip download link, and only after approval. Third-party reviewers are refused.
- The Catalog UI has no file viewer.

**Scope of the first version.** Preview of text/JSON/code/logs, CSV/TSV (first rows), images and PDF, with a size cap. Other formats show "Preview not available".

**Out of scope.** Editing files; previewing inside nested archives; specialist formats such as Parquet, Excel, R or SPSS; changing how Core packages files.

**Total estimate.** About 2–3 weeks of development, plus other teams' tasks (see "Needed from other teams").

---

## Phase 0: Decisions and unknowns (do first)

### AFP-1 · Spike: can the Workspaces API read a file from an airlock review zip?
- **Type:** Spike
- **Team:** Workspaces API (Orchestrator)
- **Estimate:** 1–2 days
- **Depends on:** none (may raise tasks for Platform, see OT-1)

**Description.** In the dev environment, prove that the Workspaces API can:
- open the review zip of an airlock request (workspace storage account `stgws…`, container = airlock ID)
- list the entries in the zip
- read the first N KB of one entry without downloading the whole zip

It must use the same identity it already uses for workspace file shares. Also confirm where the zip is after approval (download storage) and after rejection.

**Acceptance criteria.**
- [ ] A throwaway endpoint or test run shows the entries and the first bytes of a file for a real airlock request in dev
- [ ] Network access to the blob endpoint of workspace storage is confirmed, or the blocker is documented and handed to Platform (OT-1)
- [ ] The permission (role) needed on the storage account is documented
- [ ] Documented where the files are in each state: in review, approved, rejected
- [ ] Documented how large requests behave (read time for the first bytes of a multi-GB file)

---

### AFP-2 · Product decision: reviewer file viewing policy
- **Type:** Task (decision)
- **Team:** Product Owner, with Security/Compliance (see OT-2)
- **Estimate:** n/a (meetings)
- **Depends on:** none

**Description.** Viewing files in the browser shows the data to the reviewer, who is often an external third party. We need agreed answers before development is finalised.

**Questions to answer.**
- [ ] May third-party reviewers view file contents? And owners and admins?
- [ ] Should copying or saving from the viewer be discouraged or blocked? (It cannot be fully prevented in a browser.)
- [ ] Watermark the preview with the viewer's email and time? (yes/no)
- [ ] Maximum preview size per file (proposal: first 2 MB of text, first 500 CSV rows, images and PDFs up to 20 MB)
- [ ] Which file types are allowed in the first version?
- [ ] Can reviewers still view files after the request is approved or rejected, and for how long?
- [ ] What must be recorded in the audit log, and who can see it?

**Acceptance criteria.**
- [ ] Decisions written in the epic description and signed off by the Product Owner and Security/Compliance

---

## Phase 1: Workspaces API (Orchestrator)

### AFP-3 · API: list the files of an airlock request
- **Type:** Story
- **Team:** Workspaces API
- **Estimate:** 1–1.5 days
- **Depends on:** AFP-1

**Description.** New endpoint, for example `GET /api/workspace/{workspaceId}/airlock/{airlockId}/files`. It returns the entries in the request's zip: path, size, and whether each can be previewed (by type and size). During review it reads the review zip in workspace storage; after approval, the zip in download storage.

**Acceptance criteria.**
- [ ] Returns path, size and a "previewable" flag for every file in the request
- [ ] Works for multi-file requests (zipped) and single-zip requests (copied as-is; listed as one non-previewable file)
- [ ] Clear error responses for "request not found" and "files not ready yet" (still uploading)
- [ ] Unit tests

---

### AFP-4 · API: preview one file of an airlock request
- **Type:** Story
- **Team:** Workspaces API
- **Estimate:** 2–3 days
- **Depends on:** AFP-1, AFP-2 (size limits and types), AFP-3

**Description.** New endpoint, for example `GET /api/workspace/{workspaceId}/airlock/{airlockId}/files/preview?path=…`. It streams one file from the zip through the API; the browser never gets a storage link.

**Acceptance criteria.**
- [ ] Only reads the part of the zip needed for the requested file; the whole zip is not downloaded
- [ ] Applies the size caps from AFP-2 and says in the response when content was cut off
- [ ] Sets the content type from an allowlist of file types; anything else returns "not previewable"
- [ ] Rejects paths that are not in the request's file list (no path tricks such as `../`)
- [ ] Does not open archives inside the zip
- [ ] Response headers prevent caching (`Cache-Control: no-store`) and are served inline, not as an attachment
- [ ] Unit tests for each type, size truncation, a missing file and an invalid path

---

### AFP-5 · API: permissions for file preview
- **Type:** Story
- **Team:** Workspaces API
- **Estimate:** 1–1.5 days
- **Depends on:** AFP-3, AFP-4

**Description.** Only these users may list or preview files of a request:
- the workspace owner or admin
- third-party reviewers **assigned to that specific request**, as recorded when the external review starts
- (per AFP-2) possibly the requester

Add both endpoints to the reviewer-only API whitelist (`AirlockApproverScopeFilter`).

**Acceptance criteria.**
- [ ] Owner, admin and assigned reviewer: allowed
- [ ] Reviewer of a different request in the same workspace: 403
- [ ] Researcher who is not the requester, and any user from another workspace: 403
- [ ] Reviewer-only users can call both endpoints (whitelist updated, with a test)
- [ ] Unit tests for each role

---

### AFP-6 · API: audit every file view
- **Type:** Story
- **Team:** Workspaces API
- **Estimate:** 0.5–1 day
- **Depends on:** AFP-4, AFP-2 (what to record)

**Description.** Record an audit entry for every preview: user, workspace, airlock request, file path and time. Use the existing audit mechanism, and add telemetry for success and failure.

**Acceptance criteria.**
- [ ] Every successful preview creates one audit entry with the fields above
- [ ] The entry shows up wherever workspace audit entries are viewed today
- [ ] Failed or denied previews are logged in telemetry

---

## Phase 2: Catalog UI (workspace section)

### AFP-7 · UI: file viewer popup in the airlock review screen
- **Type:** Story
- **Team:** Catalog UI
- **Estimate:** 1.5–2 days
- **Depends on:** AFP-3 (the API shape can be agreed early and mocked)

**Description.** In the airlock request popup (`ApproveRejectDetailsModal`), clicking a file opens a viewer instead of starting the whole-zip download. The viewer provides:
- a header with the file name, size and a close button
- a loading state and error messages
- "showing the first part of this file" when content was cut off
- (per AFP-2) an optional watermark with the viewer's email and time

**Acceptance criteria.**
- [ ] Available to owners, admins and assigned reviewers while the request is in review
- [ ] The existing Download button is unchanged and still only works after approval
- [ ] Non-previewable files show "Preview not available" with name and size
- [ ] Keyboard accessible (Esc closes the viewer, focus is handled correctly)
- [ ] Unit tests

---

### AFP-8 · UI: text, JSON, code and log preview
- **Type:** Story
- **Team:** Catalog UI
- **Estimate:** 1 day
- **Depends on:** AFP-7, AFP-4

**Description.** Show text-based files read-only, using the `monaco-editor` library already in the UI, with syntax highlighting by file extension.

**Acceptance criteria.**
- [ ] `.txt .log .json .xml .yaml .md .py .r .sql .sh` and similar display correctly, read-only
- [ ] Large content is cut off per AFP-2, with a notice
- [ ] Unit tests

---

### AFP-9 · UI: CSV/TSV table preview
- **Type:** Story
- **Team:** Catalog UI
- **Estimate:** 1–1.5 days
- **Depends on:** AFP-7, AFP-4

**Description.** Show the first rows of CSV/TSV files as a table with a header row and horizontal scroll.

**Acceptance criteria.**
- [ ] Handles quoted values, commas inside quotes, and both `,` and tab separators
- [ ] Shows "first N rows of M" (or "first N rows" when the total is unknown)
- [ ] Falls back to the text preview if the file can't be parsed
- [ ] Unit tests

---

### AFP-10 · UI: image and PDF preview
- **Type:** Story
- **Team:** Catalog UI
- **Estimate:** 1 day
- **Depends on:** AFP-7, AFP-4

**Description.** Show images inline, and PDFs with the browser's built-in viewer, from data loaded through the preview endpoint. No direct storage links.

**Acceptance criteria.**
- [ ] `.png .jpg .jpeg .gif .svg` display; SVG is shown safely as an image, never as live HTML
- [ ] PDFs display in the browser's PDF viewer inside the popup
- [ ] Files over the size cap show "Preview not available"
- [ ] Unit tests

---

## Phase 3: Quality and release

### AFP-11 · QA: end-to-end test plan and test data
- **Type:** Task
- **Team:** QA
- **Estimate:** 2–3 days
- **Depends on:** AFP-3 to AFP-10

**Description.** Prepare airlock requests in dev with:
- a text, CSV, JSON, image and PDF file
- a large file (for example 1 GB)
- a request with many files
- a single-zip request
- an unsupported format

Test with an owner, an admin, an assigned third-party reviewer, an unassigned reviewer and a researcher.

**Acceptance criteria.**
- [ ] Every file type behaves as specified
- [ ] Every role sees exactly what AFP-5 allows
- [ ] Each view appears in the audit log (AFP-6)
- [ ] Large and many-file requests stay responsive (preview opens in under ~5 seconds)
- [ ] Tested in Chrome, Edge and Firefox

---

### AFP-12 · Documentation and reviewer guidance
- **Type:** Task
- **Team:** Product / Catalog UI
- **Estimate:** 0.5 day
- **Depends on:** AFP-2, AFP-7

**Description.** User-facing help text in the review screen (what can be previewed and the size limits), release notes, and an update to the reviewer instructions or invitation email if needed.

**Acceptance criteria.**
- [ ] Help text in the viewer or review screen
- [ ] Release notes drafted
- [ ] Reviewer instructions updated (if they exist)

---

## Needed from other teams

### OT-1 · Platform / Cloud infrastructure: storage access for the Workspaces API
- **Team:** Platform / DevOps (Terraform, networking)
- **Estimate:** depends on AFP-1 results
- **Depends on:** AFP-1

**Description.** Only needed if the spike shows a gap. Make sure the Workspaces API can **read blobs** in every workspace storage account (`stgws…`):
- **network:** private endpoint or firewall rule for the **blob** endpoint, not only the file share
- **permission:** a read role, such as Storage Blob Data Reader, for the identity the API uses

It must also apply automatically to **newly provisioned workspaces**, not only existing ones.

**Acceptance criteria.**
- [ ] The Workspaces API can read the review zip in dev, staging and production workspaces
- [ ] The workspace provisioning process includes this access for new workspaces
- [ ] Access is read-only

---

### OT-2 · Security / Compliance: approve the viewing policy and review the endpoints
- **Team:** Security / Compliance (with the Product Owner)
- **Estimate:** 1–2 days of their time
- **Depends on:** AFP-2 (policy), AFP-4 and AFP-5 (review)

**Description.** Approve the policy in AFP-2 (external reviewers viewing data, watermarking, retention, audit), and review the new endpoints before release: permissions, path validation, caching headers, content types.

**Acceptance criteria.**
- [ ] Policy approved
- [ ] Security review done; findings fixed or accepted

---

### OT-3 · Workspaces Core team: confirm file lifecycle, and optional improvements
- **Team:** Workspaces Core (function app)
- **Estimate:** 0.5 day to confirm; improvements estimated separately
- **Depends on:** AFP-1

**Description.** Confirm:
- what happens to the review zip when a request is **rejected** (kept or deleted)
- whether the zip stays in place for the whole review period

Only if AFP-2 requires it: keep the review copy for a set time after a decision.

**Optional, later:** Core currently builds the zip **in memory**, which is a risk for very large requests. Consider streaming the zip creation, or keeping files unzipped for review.

**Acceptance criteria.**
- [ ] File lifecycle per state documented in the epic
- [ ] Any change needed for the AFP-2 decisions is ticketed separately

---

### Not needed
- **Data Interop Service (DIS) team:** no changes. File preview doesn't involve dataset registration or agreements.

---

## Suggested order

1. **Week 0:** AFP-1 (spike) and AFP-2 (decisions) in parallel; OT-1 and OT-3 start as soon as AFP-1 reports
2. **Week 1:** AFP-3, AFP-4 and AFP-5 (API); AFP-7 (viewer popup) against a mocked API
3. **Week 2:** AFP-6 (audit); AFP-8, AFP-9 and AFP-10 (file types); OT-2 security review
4. **Week 3:** AFP-11 (QA), AFP-12 (docs), fixes, release

| Area | Tickets | Estimate |
|---|---|---|
| Spike and decisions | AFP-1, AFP-2 | 1–2 days (+ meetings) |
| Workspaces API | AFP-3 to AFP-6 | 4.5–7 days |
| Catalog UI | AFP-7 to AFP-10 | 4.5–5.5 days |
| QA and documentation | AFP-11, AFP-12 | 2.5–3.5 days |
| **Development total** | | **~2.5–3.5 weeks** (other teams' work not included) |
