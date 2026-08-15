# Aiden Studio OS

Generic agent-orchestration runtime backing all Aiden AI generation
(Vest/Graft/Terra today; Logic/Data/Automation/Interface are real,
routable categories with no agents registered yet). Lives entirely under
`features/aiden/os/`.

## Layers

```
MasterAgent
  -> AdapterLayer          (features/aiden/os/adapters/)
  -> OrchestrationLayer     (features/aiden/os/orchestration/)
       TaskRouter -> CategoryRouter -> AgentRouter
  -> Category.<Name>        (features/aiden/os/categories/)
       SubMasterAgent -> Agent.<Task>
```

Every node — Master, each Category's SubMasterAgent, each Agent — is built
from the same four-part shape: **Agent** (public entry) → **Kernel**
(validates/transforms input) → **Engine** (does the actual operation) →
**Sandbox** (bounds that operation with a timeout and normalizes errors).
One factory, `features/aiden/os/shared/compose.ts#composeComponent`,
builds this shape everywhere — the architecture doesn't hand-duplicate
Kernel/Engine/Sandbox boilerplate per node.

## Adapter layer (the "plug-n-play" requirement)

Five adapter kinds, each wrapping a different kind of component into the
same Agent/Kernel/Engine/Sandbox shape so OrchestrationLayer can route to
any of them identically:

| Adapter              | Wraps                                    | Status                                                   |
| -------------------- | ---------------------------------------- | -------------------------------------------------------- |
| ExternalModelAdapter | A hosted vendor API (Tripo, etc.)        | Real — this is what Vest/Graft/Terra use                 |
| LocalModelAdapter    | GGUF/ONNX/TensorRT/PyTorch weights       | Fails closed — no GPU inference infra in this deployment |
| AgentAdapter         | A user-provided custom agent function    | Real                                                     |
| ToolAdapter          | A single-purpose deterministic operation | Real                                                     |
| WorkflowAdapter      | An ordered sequence of steps             | Real, sequential only (no DAG/branching yet)             |

`AdapterLayer` (`adapters/adapter-layer.ts`) is the registry every wrapped
component gets plugged into.

## Orchestration layer

Task types are dot-namespaced strings: `"<category>.<agent>"`, e.g.
`"generation.vest"`. `TaskRouter` validates the shape, `CategoryRouter`
maps the prefix to a category, `AgentRouter` extracts the agent id.
`OrchestrationLayer` composes all three into one `route()` call.

## Category layer

Categories are generic, not branded, per the original spec — `GENERATION`,
`LOGIC`, `DATA`, `AUTOMATION`, `INTERFACE`. `category-factory.ts` builds
any category from just a name and an agent registry. Only `GENERATION` has
real agents today (Vest/Graft/Terra); the other four are real, routable
category shells with empty registries, ready for their first real feature.

## Agent layer: Vest / Graft / Terra

`features/aiden/os/categories/generation/agents.ts` wraps each of
`features/aiden/providers/{vest,graft,terra}-provider.ts` as an
`ExternalModelAdapter`. Those three provider files are the actual vendor
integration points — each fails closed (same pattern as
`features/payments/lib/stripe.ts`'s `isStripeConfigured`) until its env
var (`AIDEN_VEST_PROVIDER_API_KEY` / `AIDEN_GRAFT_PROVIDER_API_KEY` /
`AIDEN_TERRA_PROVIDER_API_KEY`) is set to a real credential. **No vendor
is wired yet** — see ROADMAP.md Phase 14's open questions. Dropping in a
real vendor call only touches these three files; nothing upstream changes.

## What "Sandbox" means here

A real, working execution boundary — timeout enforcement + error
normalization (`features/aiden/os/shared/sandbox.ts`) — **not**
process/container/VM isolation. Nothing in this codebase executes
untrusted third-party code today; every Sandbox call wraps our own adapter
code calling a vendor's HTTP API. Revisit if Aiden ever runs
user-submitted code directly (e.g. a custom workflow script), which would
need real process isolation — a genuine infra decision, not scoped here.

## Cost reconciliation

`features/aiden/services/aiden.service.ts#runGeneration`: reserves Coins
at `coinCostPreview` before calling the OS, always **captures the full
reservation** on success (not the actual cost), and records the provider's
real `actualCostUsd` (converted to Coins via `features/aiden/lib/cost.ts`,
the same $0.01 = 1 Coin rate live Coin purchases use) as `coinCostActual`
for audit only. Releasing the delta when actual cost < preview is a
deferred refinement — documented on the `AidenJob.coinCostActual` schema
comment.

## Deferred

- Real vendor wiring for Vest/Graft/Terra (provider choice is a client
  decision — ROADMAP.md Phase 14).
- Partial-capture cost reconciliation (release the preview/actual delta).
- Real process/VM sandboxing (only needed if Aiden ever runs
  user-submitted code).
- WorkflowAdapter branching/parallel steps (sequential only today).
- Logic/Data/Automation/Interface categories getting their first agents.
