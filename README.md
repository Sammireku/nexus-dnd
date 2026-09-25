# NexusDnD

**A spatial layout engine for hierarchical, drag-and-drop dashboards — built in pure TypeScript, framework-agnostic at the core.**

Most drag-and-drop libraries model your layout as a flat array of `{id, x, y, w, h}` widgets. That works until you need a widget inside a tab inside a grid card — at which point you're stitching together multiple separate DnD contexts and praying they agree with each other.

NexusDnD models layout as a **tree**, not a flat list, so nesting, tabs, and cross-container dragging are native to the data model instead of bolted on.

This project is early. The sections below are honest about what's real today versus what's designed-for-but-not-built — see [Status](#status) before you evaluate whether it fits your use case.

---

## Status

| # | Capability | Status | Notes |
|---|---|---|---|
| 1 | Hierarchical & nested layouts | ✅ **Implemented** | Tree data model (`LayoutTreeState`), `insertChild`/`removeNode`/`moveNode` |
| — | Spatial resolution (relative → absolute px) | 🚧 **In progress** | `px` / `%` resolved today; `fr`, `auto`, and `flex`/`grid` flow layout intentionally throw/error until Phase 3 |
| 2 | Cross-source dragging (Palette → Canvas) | 📋 Planned | Data-layer primitive exists (`instantiateBlueprint`); no UI, no ghost preview yet |
| 3 | Algorithmic smart layouts (bin packing, masonry, treemap) | 📋 Planned | No algorithm code written |
| 4 | True 2D keyboard accessibility | 📋 Planned | No focus manager or keyboard handling yet |
| 5 | State-aware / semantic collisions | 📋 Planned | No "accepts" validation or context-inheritance system yet |
| 6 | Fluid & continuous layouts (snap vs. freeform) | 📋 Planned | Not started |
| 7 | Extreme-scale performance (QuadTree, Web Worker, virtualization) | 📋 Planned | Not started — current collision helpers are bare AABB math, not wired into anything |
| 8 | Multiplayer / collaborative sync (CRDT) | 📋 Planned | Not started; needs a real merge policy for concurrent moves, not just causality ordering |
| 9 | Non-destructive FLIP animations | 📋 Planned | No React/rendering layer exists yet |

**Translation:** if you need a working drag-and-drop dashboard *today*, this isn't it yet. If you want to build one of the ✅/🚧/📋 rows above from a solid foundation, this is a good place to start — see [Contributing](#contributing).

---

## Why a tree, not a flat array

A `ContainerNode` can hold other containers, tabs, or widgets as children, to arbitrary depth:

```typescript
import { createTree, insertChild, resolveLayout } from 'nexusdnd-core';

const root: ContainerNode = {
  id: 'root',
  type: 'container',
  layoutMode: 'absolute',
  geometry: {
    position: { x: 0, y: 0, unit: 'px' },
    size: {
      width: { value: 100, unit: '%' },
      height: { value: 100, unit: '%' },
    },
  },
  children: [],
  data: {},
};

let tree = createTree(root);

tree = insertChild(tree, 'root', {
  id: 'chart-1',
  type: 'widget',
  blueprintId: 'blueprint-revenue-chart',
  widgetType: 'chart',
  geometry: {
    position: { x: 20, y: 20, unit: 'px' },
    size: {
      width: { value: 400, unit: 'px' },
      height: { value: 300, unit: 'px' },
    },
  },
  data: {},
});

const { rects, errors } = resolveLayout(tree, { x: 0, y: 0, width: 1200, height: 800 });
// rects: Map<NodeId, AbsoluteRect> — ready for rendering or collision checks
// errors: non-fatal per-node issues (e.g. a widget using 'fr' outside a flex parent)
```

A single bad node in `resolveLayout` never takes down the whole tree — it's collected in `errors` and skipped, so the rest of the layout still resolves. That matters because this function is meant to run on every drag frame in a live editor, not just at build time.

---

## Architecture

```
packages/
  core/          Framework-agnostic TypeScript. No React. No rendering.
                 Tree data model, mutations, the Layout Resolver.
  react/         (not started) React bindings, drag interactions, rendering.
```

The core is deliberately kept ignorant of React, drag events, and the DOM. Everything spatial — the tree, the math, the resolution — is pure functions over plain data, so it's testable without a browser and portable to other renderers later.

### Core design decisions

- **Discriminated union nodes** (`WidgetNode | ContainerNode | TabsNode`) — exhaustive `switch` handling enforced by `assertNever`, so adding a node type is a compile error everywhere it isn't handled, not a silent gap.
- **Flat, normalized state** — `{ nodes: Record<NodeId, LayoutNode>, index: Record<NodeId, {parentId, depth}> }` rather than nested objects. Content lives in exactly one place; a geometry-only update is O(1), not a path-copy to the root.
- **Blueprint vs. Instance** — Palette templates (`WidgetBlueprint`) are never tree members. Dropping one mints a fresh `LayoutNode` with a globally unique id via `instantiateBlueprint`, so cross-source dragging has no collision logic to write — IDs can't collide if they're only ever minted once, at drop time.
- **Per-axis sizing units** (`px | % | fr | auto`, independently on width and height) — a widget that's `1fr` wide and `200px` tall is representable; a single shared unit across width/height was an earlier design mistake, corrected before it reached the Resolver.
- **Error-collecting Resolver, not throw-on-invalid** — a misconfigured node degrades to a visible error entry, not a blank canvas.

---

## Roadmap

- **Phase 1 — Spatial Core & Data Model** *(current)*: tree, mutations, Blueprint/Instance, Resolver for `px`/`%`/`absolute`.
- **Phase 2**: Palette UI, drag interactions, ghost previews, cross-container dragging in the browser.
- **Phase 3**: `fr`/`auto` resolution (two-pass content measurement), `flex`/`grid` flow layout, bin-packing/masonry/treemap algorithms.
- **Phase 4**: Collision engine (QuadTree), 2D keyboard accessibility, semantic accepts-rules, performance work (virtualization, Web Worker offload).
- **Phase 5**: Multiplayer sync (CRDT with a real concurrent-move merge policy), FLIP animations.

Phases are sequenced, not fixed-scope — see open issues for what's actively being worked on.

---

## Contributing

This is early-stage and every 📋 row above is genuinely open — not busywork carved off a finished product. Good entry points:

- Read `packages/core/src/` — it's small enough to read in full before your first PR.
- Check issues tagged `good first issue`.
- If you want to take on a whole phase item (e.g. the QuadTree, or the CRDT merge policy), open an issue proposing your approach before writing code — some of these (especially collaborative sync) have real design decisions worth agreeing on first.

MIT licensed — see [`LICENSE`](./LICENSE).

---

## Non-goals (for now)

- Mobile-native rendering (React Native support is a possible future package, not a current target).
- Server-side layout persistence/backend — this is a client-side engine; what you do with the resulting tree (save it, sync it) is up to your app.
