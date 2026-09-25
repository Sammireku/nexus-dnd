import { WidgetBlueprint, WidgetNode, PositionUnit } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older RN/Node runtimes).
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Turn a Blueprint (Palette template) into a brand-new LayoutNode
 * instance with a globally unique id. This is the ONLY place NodeIds are
 * minted — insertChild() never has to think about collisions because of it.
 */
export function instantiateBlueprint(
  blueprint: WidgetBlueprint,
  position: { x: number; y: number; unit: PositionUnit }
): WidgetNode {
  return {
    id: generateId(),
    type: 'widget',
    blueprintId: blueprint.id,
    widgetType: blueprint.widgetType, // snapshotted — editing the blueprint later never mutates existing instances
    geometry: {
      position,
      size: { ...blueprint.defaultGeometry.size },
    },
    data: { ...blueprint.defaultData },
  };
}
