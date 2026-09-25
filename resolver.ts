import { LayoutTreeState, AbsoluteRect, NodeId, LayoutMode, SizeValue, assertNever } from './types';

export interface ResolverError {
  nodeId: NodeId;
  message: string;
}

export interface ResolveResult {
  rects: Map<NodeId, AbsoluteRect>;
  errors: ResolverError[];
}

/**
 * Resolves relative Geometry (px | % | fr | auto) into absolute pixel
 * rects for a given viewport. Runs on every drag frame and resize, so it
 * never throws — a single misconfigured node is collected as an error
 * and its subtree is skipped, while everything else still resolves.
 */
export function resolveLayout(
  tree: LayoutTreeState,
  rootContainerRect: AbsoluteRect
): ResolveResult {
  const rects = new Map<NodeId, AbsoluteRect>();
  const errors: ResolverError[] = [];

  function resolveNode(
    nodeId: NodeId,
    parentRect: AbsoluteRect,
    parentLayoutMode: LayoutMode | null // null only for the root call
  ): void {
    const node = tree.nodes[nodeId];
    if (!node) return;

    // Flow-based positioning (flex/grid) requires a sibling-aware pass
    // not implemented until Phase 3. Skip this node and its subtree
    // rather than guessing at a position.
    if (parentLayoutMode === 'flex' || parentLayoutMode === 'grid') {
      errors.push({
        nodeId,
        message: `Parent uses '${parentLayoutMode}', which requires flow positioning not implemented in Phase 1.`,
      });
      return;
    }

    const units = [node.geometry.size.width.unit, node.geometry.size.height.unit];
    if (units.includes('fr')) {
      errors.push({ nodeId, message: `'fr' unit requires a 'flex' or 'grid' parent, but parent is 'absolute'.` });
      return;
    }
    if (units.includes('auto')) {
      errors.push({ nodeId, message: `'auto' unit requires DOM measurement, deferred to Phase 3.` });
      return;
    }

    const posX =
      node.geometry.position.unit === 'px'
        ? node.geometry.position.x
        : (node.geometry.position.x / 100) * parentRect.width;
    const posY =
      node.geometry.position.unit === 'px'
        ? node.geometry.position.y
        : (node.geometry.position.y / 100) * parentRect.height;

    const width = resolveSizeValue(node.geometry.size.width, parentRect.width, nodeId, errors);
    const height = resolveSizeValue(node.geometry.size.height, parentRect.height, nodeId, errors);

    const rect: AbsoluteRect = { x: parentRect.x + posX, y: parentRect.y + posY, width, height };
    rects.set(nodeId, rect);

    if (node.type === 'container') {
      node.children.forEach((childId) => resolveNode(childId, rect, node.layoutMode));
    } else if (node.type === 'tabs') {
      // Only the active tab is resolved. Inactive tabs get NO entry in
      // `rects` — not an entry that happens to overlap the active one —
      // so collision/hit-testing never has to know about tabs at all.
      if (node.children.includes(node.activeTabId)) {
        // A tab pane never arranges siblings (exactly one child is ever
        // visible), so there is no meaningful mode to inherit here —
        // this is deliberately always 'absolute', not a fallback of
        // whatever mode governed the TabsNode's own position.
        resolveNode(node.activeTabId, rect, 'absolute');
      } else {
        errors.push({
          nodeId: node.id,
          message: `TabsNode has invalid activeTabId '${node.activeTabId}'. No tab content will be rendered.`,
        });
      }
    }
  }

  resolveNode(tree.rootId, rootContainerRect, null);
  return { rects, errors };
}

function resolveSizeValue(
  sizeValue: SizeValue,
  parentDimension: number,
  nodeId: NodeId,
  errors: ResolverError[]
): number {
  switch (sizeValue.unit) {
    case 'px':
      return sizeValue.value;
    case '%':
      return (sizeValue.value / 100) * parentDimension;
    case 'fr':
      // Unreachable via the guard above today, but kept resilient rather
      // than a throw — if the guard's ordering ever changes, this stays
      // a logged error instead of taking the whole tree down again.
      errors.push({ nodeId, message: `'fr' unit reached size resolution unexpectedly. Falling back to 0.` });
      return 0;
    case 'auto':
      errors.push({ nodeId, message: `'auto' unit reached size resolution unexpectedly. Falling back to 0.` });
      return 0;
    default:
      return assertNever(sizeValue.unit);
  }
}
