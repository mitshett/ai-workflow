import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { WorkflowStore } from '../../../core/services/workflow.store';
import { NODE_TEMPLATES } from '../../../core/models/node.models';

// Minimap display dimensions (px)
const MM_W = 160;
const MM_H = 100;
// Padding around the node bounding box inside the minimap
const MM_PAD = 10;
// Estimated node dimensions in world space
const NODE_W = 200;
const NODE_H = 90;

interface MiniNode {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  selected: boolean;
}

interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

@Component({
  selector: 'app-minimap',
  standalone: true,
  imports: [],
  templateUrl: './minimap.component.html',
  styleUrl: './minimap.component.scss',
  // NO_ERRORS_SCHEMA not needed — no unknown elements, pure SVG
})
export class MinimapComponent {
  protected readonly store = inject(WorkflowStore);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  /** Canvas host size — provided by parent so the minimap knows the viewport dims */
  readonly canvasWidth = input<number>(800);
  readonly canvasHeight = input<number>(600);

  /** Emitted when user clicks/drags on minimap — world coordinate to pan to */
  readonly panTo = output<{ x: number; y: number }>();

  protected readonly MM_W = MM_W;
  protected readonly MM_H = MM_H;

  // ── Computed: scale + offset to fit all nodes in minimap ─────────────────

  private readonly worldBounds = computed(() => {
    const nodes = this.store.nodes();
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_W));
    const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_H));
    // Include the current viewport in bounds so empty-canvas area is visible
    const vpMinX = -this.store.viewport().x / this.store.viewport().zoom;
    const vpMinY = -this.store.viewport().y / this.store.viewport().zoom;
    const vpMaxX = vpMinX + this.canvasWidth() / this.store.viewport().zoom;
    const vpMaxY = vpMinY + this.canvasHeight() / this.store.viewport().zoom;
    return {
      minX: Math.min(minX, vpMinX),
      minY: Math.min(minY, vpMinY),
      maxX: Math.max(maxX, vpMaxX),
      maxY: Math.max(maxY, vpMaxY),
    };
  });

  private readonly mmScale = computed(() => {
    const b = this.worldBounds();
    const contentW = b.maxX - b.minX;
    const contentH = b.maxY - b.minY;
    const usableW = MM_W - MM_PAD * 2;
    const usableH = MM_H - MM_PAD * 2;
    return Math.min(usableW / contentW, usableH / contentH);
  });

  private readonly mmOffset = computed(() => {
    const b = this.worldBounds();
    const scale = this.mmScale();
    const contentW = (b.maxX - b.minX) * scale;
    const contentH = (b.maxY - b.minY) * scale;
    return {
      x: MM_PAD + (MM_W - MM_PAD * 2 - contentW) / 2 - b.minX * scale,
      y: MM_PAD + (MM_H - MM_PAD * 2 - contentH) / 2 - b.minY * scale,
    };
  });

  // ── Computed node rects ───────────────────────────────────────────────────

  protected readonly miniNodes = computed<MiniNode[]>(() => {
    const scale = this.mmScale();
    const off = this.mmOffset();
    const selectedId = this.store.selectedNodeId();

    return this.store.nodes().map((node) => {
      const tmpl = NODE_TEMPLATES.find((t) => t.type === node.type);
      return {
        x: node.position.x * scale + off.x,
        y: node.position.y * scale + off.y,
        w: Math.max(4, NODE_W * scale),
        h: Math.max(3, NODE_H * scale),
        color: tmpl?.color ?? 'var(--pol-color-neutral-400)',
        selected: node.id === selectedId,
      };
    });
  });

  // ── Computed viewport rectangle ───────────────────────────────────────────

  protected readonly viewportRect = computed<ViewportRect>(() => {
    const vp = this.store.viewport();
    const scale = this.mmScale();
    const off = this.mmOffset();
    // Viewport rect in world coords
    const worldX = -vp.x / vp.zoom;
    const worldY = -vp.y / vp.zoom;
    const worldW = this.canvasWidth() / vp.zoom;
    const worldH = this.canvasHeight() / vp.zoom;
    return {
      x: worldX * scale + off.x,
      y: worldY * scale + off.y,
      w: worldW * scale,
      h: worldH * scale,
    };
  });

  // ── Click / drag on minimap → pan canvas ─────────────────────────────────

  private isPressing = false;

  protected onMouseDown(e: MouseEvent): void {
    e.stopPropagation();
    this.isPressing = true;
    this.emitPan(e);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (!this.isPressing) return;
    this.emitPan(e);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isPressing = false;
  }

  private emitPan(e: MouseEvent): void {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const mmX = e.clientX - rect.left;
    const mmY = e.clientY - rect.top;
    // Convert minimap coords → world coords
    const scale = this.mmScale();
    const off = this.mmOffset();
    const worldX = (mmX - off.x) / scale;
    const worldY = (mmY - off.y) / scale;
    this.panTo.emit({ x: worldX, y: worldY });
  }
}
