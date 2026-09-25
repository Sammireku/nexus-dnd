// ==========================================
// IDS
// ==========================================
export type NodeId = string;
export type BlueprintId = string;

// ==========================================
// GEOMETRY & UNITS
// ==========================================
export type PositionUnit = 'px' | '%';
export type SizeUnit = 'px' | '%' | 'fr' | 'auto';

export interface SizeValue {
  value: number;
  unit: SizeUnit;
}

export interface Geometry {
  position: { x: number; y: number; unit: PositionUnit };
  size: { width: SizeValue; height: SizeValue };
}

/** Absolute pixel rectangle. Never stored in the tree — always derived
 *  by the Resolver for a given viewport. */
export interface AbsoluteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutMode = 'absolute' | 'flex' | 'grid';

// ==========================================
// NODES (discriminated union)
// ==========================================
interface BaseNode {
  id: NodeId;
  geometry: Geometry;
  data: Record<string, unknown>;
}

export interface WidgetNode extends BaseNode {
  type: 'widget';
  blueprintId: BlueprintId;
  /** Snapshotted at instantiation, not looked up live from the blueprint —
   *  editing or deleting a blueprint later must never silently change or
   *  break an already-built layout. */
  widgetType: string;
}

export interface ContainerNode extends BaseNode {
  type: 'container';
  children: NodeId[];
  layoutMode: LayoutMode;
}

export interface TabsNode extends BaseNode {
  type: 'tabs';
  children: NodeId[];
  activeTabId: NodeId;
}

export type LayoutNode = WidgetNode | ContainerNode | TabsNode;

export function isContainer(node: LayoutNode): node is ContainerNode {
  return node.type === 'container';
}

export function isTabs(node: LayoutNode): node is TabsNode {
  return node.type === 'tabs';
}

export function isWidget(node: LayoutNode): node is WidgetNode {
  return node.type === 'widget';
}

/** Exhaustiveness guard — adding a node/unit variant breaks the build
 *  wherever this is called with a non-narrowed value. */
export function assertNever(value: never, context?: string): never {
  throw new Error(`Unhandled variant${context ? ` in ${context}` : ''}: ${JSON.stringify(value)}`);
}

// ==========================================
// BLUEPRINT (Palette — never a tree member)
// ==========================================
export interface WidgetBlueprint {
  id: BlueprintId;
  name: string;
  icon: string;
  widgetType: string;
  defaultGeometry: Geometry;
  defaultData: Record<string, unknown>;
}

// ==========================================
// DENORMALIZED STATE (flat tree + structural index)
// ==========================================
export interface IndexEntry {
  parentId: NodeId | null;
  depth: number;
}

export interface LayoutTreeState {
  rootId: NodeId;
  /** Content lives here ONLY — single source of truth per node. */
  nodes: Record<NodeId, LayoutNode>;
  /** Structural metadata only (parentId, depth) — never node content,
   *  so nothing can drift out of sync with `nodes`. */
  index: Record<NodeId, IndexEntry>;
}
