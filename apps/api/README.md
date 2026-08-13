# apps/api

NestJS backend. One module per domain under `src/modules/` — each has its
own README mapping it to a ROADMAP.md phase. `src/common/` holds cross-cutting
concerns (guards, interceptors, the RBAC decorator used by every module).

Not scaffolded yet — bootstrap with `nest new` (or `pnpm create nest`) when
Phase 1 backend work starts, then move `src/modules/*` into the generated app.
