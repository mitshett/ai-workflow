import type { CanvasNode, EdgePort } from '../../../core/models/node.models';

// ── Node card geometry constants (must match node.component.scss) ──────────

/** Fixed node card width in world px — must match node.component.scss :host width */
export const NODE_W = 180;
/** Node card height in world px — borders 4px + topbar 29px + header 36px + body 25px */
export const NODE_H = 94;

/**
 * Port Y offsets from node.position.y — must exactly match the hard-coded
 * top values in node.component.scss port CSS (NOT top: 50%).
 *
 * CSS: top: Xpx on a 14px dot → port center = X + 7
 *   input/output: top 39px → center 46px  (≈ NODE_H / 2)
 *   true:         top 24px → center 31px  (≈ NODE_H * 0.33)
 *   false:        top 55px → center 62px  (≈ NODE_H * 0.67)
 */
const PORT_MID_Y   = 46;  // input / output
const PORT_TRUE_Y  = 31;  // gateway true
const PORT_FALSE_Y = 62;  // gateway false

/**
 * Returns the world-coordinate anchor point for a given node port.
 * These must stay in sync with the CSS positioning in node.component.scss.
 */
export function getPortAnchor(
  node: CanvasNode,
  port: EdgePort | 'input'
): { x: number; y: number } {
  switch (port) {
    case 'input':
      return { x: node.position.x, y: node.position.y + PORT_MID_Y };

    case 'output':
      return { x: node.position.x + NODE_W, y: node.position.y + PORT_MID_Y };

    case 'true':
      return { x: node.position.x + NODE_W, y: node.position.y + PORT_TRUE_Y };

    case 'false':
      return { x: node.position.x + NODE_W, y: node.position.y + PORT_FALSE_Y };
  }
}

/**
 * Builds an SVG cubic-bezier path string between two world-coordinate points.
 * The horizontal control-point offset scales with distance for a natural curve.
 */
export function bezierPath(
  sx: number, sy: number,
  tx: number, ty: number
): string {
  const dx = Math.abs(tx - sx);
  const cpOffset = Math.max(60, dx * 0.5);
  const c1x = sx + cpOffset;
  const c2x = tx - cpOffset;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
}
