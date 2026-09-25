import { LayoutNode, LayoutTreeState, ContainerNode, TabsNode, NodeId } from './types';

function childrenOf(node: LayoutNode): NodeId[] {
  return node.type === 'widget' ? [] : node.children;
}

export function createTree(root: ContainerNode): LayoutTreeState {
  return {
    rootId: root.id,
    nodes: { [root.id]: root },
    index: { [root.id]: { parentId: null, depth: 0 } },
  };
}

export function getNode(state: LayoutTreeState, id: NodeId): LayoutNode | undefined {
  return state.nodes[id];
}

export function getParentId(state: LayoutTreeState, id: NodeId): NodeId | null | undefined {
  return state.index[id]?.parentId;
}

export function getDepth(state: LayoutTreeState, id: NodeId): number | undefined {
  return state.index[id]?.depth;
}

/**
 * Insert `child` under `parentId`. Because instantiateBlueprint() is the
 * only place NodeIds are minted, the duplicate check below is an
 * invariant assertion, not collision-avoidance logic — it should never
 * actually fire.
 */
export function insertChild(
  state: LayoutTreeState,
  parentId: NodeId,
  child: LayoutNode,
  atIndex?: number
): LayoutTreeState {
  const parent = state.nodes[parentId];
  if (!parent || parent.type === 'widget') {
    throw new Error(`Node "${parentId}" cannot accept children`);
  }
  if (state.nodes[child.id]) {
    throw new Error(`Node "${child.id}" already exists — use moveNode instead`);
  }

  const siblings = childrenOf(parent);
  const at = atIndex === undefined ? siblings.length : Math.max(0, Math.min(atIndex, siblings.length));
  const nextSiblings = [...siblings];
  nextSiblings.splice(at, 0, child.id);

  const updatedParent = { ...parent, children: nextSiblings } as LayoutNode;
  const parentDepth = state.index[parentId].depth;

  return {
    ...state,
    nodes: { ...state.nodes, [parentId]: updatedParent, [child.id]: child },
    index: { ...state.index, [child.id]: { parentId, depth: parentDepth + 1 } },
  };
}

function collectSubtreeIds(state: LayoutTreeState, id: NodeId): NodeId[] {
  const node = state.nodes[id];
  if (!node) return [];
  const ids = [id];
  for (const childId of childrenOf(node)) ids.push(...collectSubtreeIds(state, childId));
  return ids;
}

export function removeNode(state: LayoutTreeState, id: NodeId): LayoutTreeState {
  const parentId = getParentId(state, id);
  if (parentId === null || parentId === undefined) {
    throw new Error('Cannot remove the root node');
  }
  const parent = state.nodes[parentId];
  if (!parent || parent.type === 'widget') {
    throw new Error(`Parent "${parentId}" not found or cannot contain children`);
  }

  const idsToRemove = collectSubtreeIds(state, id);
  const nextNodes = { ...state.nodes };
  const nextIndex = { ...state.index };
  for (const removeId of idsToRemove) {
    delete nextNodes[removeId];
    delete nextIndex[removeId];
  }

  const updatedParent = {
    ...parent,
    children: childrenOf(parent).filter((c) => c !== id),
  } as LayoutNode;
  nextNodes[parentId] = updatedParent;

  return { ...state, nodes: nextNodes, index: nextIndex };
}

/** Recompute depth for `startId` and its entire subtree — needed after a
 *  move, since a moved subtree's distance from root may have changed. */
function recalculateDepths(state: LayoutTreeState, startId: NodeId): LayoutTreeState {
  const startDepth = state.index[startId]?.depth ?? 0;
  const nextIndex = { ...state.index };

  function walk(id: NodeId, depth: number): void {
    const entry = nextIndex[id];
    if (!entry) return;
    nextIndex[id] = { ...entry, depth };
    const node = state.nodes[id];
    if (node) for (const childId of childrenOf(node)) walk(childId, depth + 1);
  }
  walk(startId, startDepth);

  return { ...state, index: nextIndex };
}

/**
 * The unified move primitive: detach, reattach, recompute depths.
 * Cross-container dragging needs no special case beyond "the two
 * parents happen to be different nodes."
 */
export function moveNode(
  state: LayoutTreeState,
  id: NodeId,
  newParentId: NodeId,
  atIndex?: number
): LayoutTreeState {
  const node = state.nodes[id];
  if (!node) throw new Error(`Node "${id}" not found`);
  const detached = removeNode(state, id);
  const reattached = insertChild(detached, newParentId, node, atIndex);
  return recalculateDepths(reattached, id);
}
