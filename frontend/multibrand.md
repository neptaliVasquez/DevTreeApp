# Runtime theming — demo runbook

**Branch:** `spike/runtime-theme-tokens` · **Baseline:** `main`

Goal of the session: show that the application no longer has to be compiled per organisation, and
translate that into the pipeline cost it removes.

---

## Before the call (10 minutes)

```bash
cd ~/projects/Catalog/ui

# warm both caches so nothing compiles from cold during the demo
git checkout main
BUILD_THEME=grip pnpm exec nx build shell --configuration=development

git checkout spike/runtime-theme-tokens
BUILD_THEME=grip pnpm exec nx build shell --configuration=development

# end on main, ready for Act 1
git checkout main
nx serve shell
```

Checklist:

- [ ] `apps/shell/src/environments/config.local.json` says `"theme": "grip"`
- [ ] Two browser tabs open: catalogue home, and `/theme`
- [ ] Terminal visible on screen — the recompile in Act 1 is part of the story
- [ ] Pipeline run open in another tab (see *Numbers* below)

**Backup plan:** if the dev server misbehaves, Act 3 runs in three seconds and needs no browser.

---

## Act 1 — The problem (2 min, on `main`)

**Do:** edit `config.local.json`, change `"theme": "grip"` to `"epnd"`. Watch the recompile.
Reload — the app is now green.

**Say:**

> I changed one word: which organisation this is. The whole application had to recompile before I
> could see it. That isn't a development quirk, it's how the product is built — each
> organisation's colours, logo, footer and text are compiled *into* the JavaScript. The bundle we
> ship to EPND physically cannot render AD Workbench.
>
> That's why every change to the catalogue triggers nine separate builds of the same source code.
> A one-line bug fix pays that cost nine times.

---

## Act 2 — The fix (4 min, on the branch)

```bash
# Ctrl-C the server
git checkout spike/runtime-theme-tokens
nx serve shell
```

**While it starts, fill the silence:**

> The change is small to describe. The app used to be *told* which organisation it was, at compile
> time. Now it *reads* which organisation it is when it starts, from a config file it already
> downloads on every page load — a file that already contains the organisation's name. We just
> made the app act on it.

**Do:** use the picker at bottom-right. Go EPND → AD Workbench → MJFF → ACTC. Point at each thing
as it changes: colours, typeface, header logo, header menu, footer, side navigation, page text,
**and the browser tab icon**.

**Say:**

> Same application, still running. Nothing has been rebuilt since I started it. One JavaScript
> bundle is rendering every one of our organisations.

**Then reframe immediately, so nobody misreads the picker:**

> The picker is a developer tool I added for this demo. In production nobody picks — the config
> decides, and each customer's deployment has its own. What the picker proves is that the *bundle*
> is no longer tied to a customer.

---

## Act 3 — The proof (2 min)

**Do:** set `config.local.json` back to `"theme": "adwb"` and reload the browser. It boots into AD
Workbench with no rebuild.

> That's the production path exactly. That file is generated per organisation when we package a
> release. It already exists, it already says which org this is.

**Then the hard evidence:**

```bash
npx tailwindcss -c apps/shell/tailwind.config.js -i apps/shell/src/styles.css -o after.css
```

> That builds our entire stylesheet with no organisation specified. On `main` that command fails —
> it's impossible. And we didn't just eyeball the result: for all ten organisations, substituting
> their values back into this one stylesheet reproduces their old stylesheet exactly. 1,864
> selectors, every declaration identical. Users see no difference at all — and that check is
> automated, so it stays true.

---

## The business translation (2 min — the part that matters)

> Today any change to the catalogue rebuilds the app nine times, once per organisation. I pulled
> the last release: nine jobs, about five minutes each — **forty-six agent-minutes per release,
> and eight ninths of it is the same source code compiled nine times.** One build replaces all of
> it.
>
> The saving isn't one-off. It's on every release, forever. And today the cost scales with
> success: the tenth organisation made every release slower for the other nine. After this,
> releasing costs the same whether we have ten customers or thirty.
>
> The same nine-way split runs on **every pull request** too, which is where most of the waste
> actually is — that's our own feedback loop.
>
> There's a second benefit that matters here. Nine builds are nine chances to fail. A release can
> partially succeed, and nothing structurally guarantees two customers run the same code. With one
> artifact, "which build is EPND running?" has exactly one answer.

---

## Be straight about what isn't done (1 min)

Say this before anyone asks. It buys more credibility than the demo does.

> What's proven today: the **application** is organisation-agnostic. Every visible piece of
> branding follows a config value.
>
> What isn't done: the **build system** still assumes one build per organisation — that's pipeline
> work, and it's the conversation I need to have with DevOps next. And swapping a logo still needs
> a release, because logos are still compiled in. That's a further frontend step.
>
> This took a few hours for the whole application. That's the signal about the size of what's left.

---

## Questions to have answers ready for

| Question | Answer |
|---|---|
| Is the bundle bigger? | ~5 KB for all ten palettes and fonts. Logos add ~530 KB to the artifact but nothing to what a user downloads — each browser fetches only its own org's logo |
| Will users see a flash of the wrong brand? | No. The config fetch already happens before anything renders. We're using an existing gate, not adding one |
| Are we shipping other customers' code to AD Workbench? | Yes — inert, never executed, about 16 KB. Standard trade for a multi-tenant bundle. Flag it if any partner has a contractual objection |
| What about the login page? | Unchanged. That's Keycloak, selected per realm — a different system |
| Does this make onboarding a new org fast? | It removes the UI part and stops each new org taxing every future release. Provisioning, Keycloak realm and seed data are untouched — and they're the bigger half |
| How risky is it? | Nothing deleted, `BUILD_THEME` still works, four commits on a branch. If the runtime path failed we'd still have the compiled one |
| Can we still ship to one org only? | Yes. Build once, deploy to whoever you choose — deployment is already per-organisation. The choice moves from build time to deploy time |
| Why nine builds today, why not just build the one that changed? | A release is one version, and any org must be deployable at it — so every version needs all nine artifacts. One artifact makes every version complete by definition |

---

## Numbers

Measured from the last release run of `tools/ci/pipelines/ci.yml`:

| | |
|---|---|
| UI publish jobs per release | **9**, ~5m 10s each |
| Agent-time per release | **~46 minutes**, ~41 of it duplicated (**88%**) |
| UI build jobs per pull request | **7** (`pr.yml`) — runs far more often than releases |
| Themes in the repo / in production | 10 / 9 |
| Colour tokens per organisation | 103 — structurally identical across all ten, only values differ |
| Stylesheet selectors verified identical | 1,864 |
| Added weight for all ten palettes + fonts | ~4.7 KB gzipped |

**Do not say "2–3 hours".** That figure came from the original planning document and the pipeline
contradicts it — the UI jobs are five minutes each. If you repeat it and someone opens the run,
you lose the room. Say the forty-six agent-minutes instead; it's measured and it's enough.

Still worth grabbing before the call, if you have five minutes:

- Job **start times** — did all nine start together (agent-rich, so the saving is cost) or in
  waves (queueing, so the saving is also elapsed time)?
- Duration of the **scan stage** and the four **container image** jobs — the part this work does
  *not* improve. Knowing it stops you overclaiming.

---

## The ask

> I'd like to take the pipeline half to DevOps: collapsing nine build jobs to one, and two
> unrelated quick wins I found — Storybook is built in all nine jobs but only development
> environments use it, and the pipeline has no path filters, so a UI-only change also rebuilds
> four container images.
