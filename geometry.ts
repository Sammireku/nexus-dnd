import { AbsoluteRect } from './types';

export function rectsIntersect(a: AbsoluteRect, b: AbsoluteRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function pointInRect(point: { x: number; y: number }, rect: AbsoluteRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
