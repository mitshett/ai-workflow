import {
  Component,
  ElementRef,
  HostListener,
  NgZone,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { WorkflowStore } from '../../core/services/workflow.store';
import type { CanvasEdge, CanvasNode, EdgePort, Viewport } from '../../core/models/node.models';
import { NodeComponent } from './node/node.component';
import { MinimapComponent } from './minimap/minimap.component';
import { EmptyStateComponent } from '@polarity/components/empty-state';
import { getPortAnchor, bezierPath } from './edge/edge-geometry';

// ── Constants ─────────────────────────────────────────────────────────────

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
/** How many pixels the dot-grid background-size is (must match styles.scss 24px) */
const GRID_SIZE = 24;

// ── Connect-drag state ────────────────────────────────────────────────────

interface ConnectDragState {
  sourceNodeId: string;
  sourcePort: EdgePort;
  anchorX: number;   // world coords
  anchorY: number;
  cursorX: number;   // world coords (updated on mousemove)
  cursorY: number;
}

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [NodeComponent, MinimapComponent, EmptyStateComponent],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.scss',
  host: {
    '[style.background-size]': 'gridStyle().backgroundSize',
    '[style.background-position]': 'gridStyle().backgroundPosition',
    '[class.canvas--readonly]': 'isReadOnly()',
  },
})
export class CanvasComponent implements OnInit, OnDestroy {
  protected readonly store = inject(WorkflowStore);
  private readonly ngZone = inject(NgZone);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  // ── Local viewport signals (mirrors store, driven by pointer/wheel) ───────

  protected readonly vx = signal(0);   // world translate X
  protected readonly vy = signal(0);   // world translate Y
  protected readonly vz = signal(1);   // zoom scale

  /** When true the canvas is in execution mode — no editing interactions. */
  protected readonly isReadOnly = computed(() => this.store.rightPanelMode() === 'execution');

  /** CSS transform string for the world layer */
  protected readonly worldTransform = computed(
    () => `translate(${this.vx()}px, ${this.vy()}px) scale(${this.vz()})`
  );

  /** Background-position shift so the dot-grid follows the pan */
  protected readonly gridStyle = computed(() => {
    const z = this.vz();
    const size = GRID_SIZE * z;
    // offset by half a cell so the grid feels centred at world origin
    const ox = (this.vx() % size + size) % size;
    const oy = (this.vy() % size + size) % size;
    return {
      backgroundSize: `${size}px ${size}px`,
      backgroundPosition: `${ox}px ${oy}px`,
    };
  });

  // ── Pan state ─────────────────────────────────────────────────────────────

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;

  // ── Connect-drag state ────────────────────────────────────────────────────

  protected readonly connectDraft = signal<ConnectDragState | null>(null);

  /** Node id → node lookup used by edgePaths computed */
  protected readonly nodeMap = computed(() => {
    const map = new Map<string, CanvasNode>();
    for (const n of this.store.nodes()) map.set(n.id, n);
    return map;
  });

  /** Pre-computed edge paths — avoids calling getPortAnchor in the template */
  protected readonly edgePaths = computed(() => {
    const nodes = this.nodeMap();
    return this.store.edges().map((edge) => {
      const src = nodes.get(edge.sourceNodeId);
      const tgt = nodes.get(edge.targetNodeId);
      if (!src || !tgt) return null;
      const srcAnchor = getPortAnchor(src, edge.sourcePort);
      const tgtAnchor = getPortAnchor(tgt, 'input');
      const labelX = (srcAnchor.x + tgtAnchor.x) / 2;
      const labelY = (srcAnchor.y + tgtAnchor.y) / 2 - 8;
      return {
        edge,
        d: bezierPath(srcAnchor.x, srcAnchor.y, tgtAnchor.x, tgtAnchor.y),
        labelX,
        labelY,
        portColor: edge.sourcePort === 'true' ? '#22c55e'
                 : edge.sourcePort === 'false' ? '#ef4444'
                 : '#6366f1',
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);
  });

  /** Live draft bezier path while user drags a connection */
  protected readonly draftPath = computed(() => {
    const d = this.connectDraft();
    if (!d) return '';
    return bezierPath(d.anchorX, d.anchorY, d.cursorX, d.cursorY);
  });

  // ── Passive wheel listener ref (for cleanup) ──────────────────────────────

  private wheelListener!: (e: WheelEvent) => void;
  private captureMouseDownListener!: (e: MouseEvent) => void;
  private resizeObserver!: ResizeObserver;

  // ── Canvas host size (for minimap viewport rect) ──────────────────────────

  protected readonly canvasWidth = signal(800);
  protected readonly canvasHeight = signal(600);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Restore viewport from store (e.g. after load)
    const vp = this.store.viewport();
    this.vx.set(vp.x);
    this.vy.set(vp.y);
    this.vz.set(vp.zoom);

    // Track canvas host size for minimap
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      this.ngZone.run(() => {
        this.canvasWidth.set(entry.contentRect.width);
        this.canvasHeight.set(entry.contentRect.height);
      });
    });
    this.resizeObserver.observe(this.hostEl.nativeElement);
    // Set initial size
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    this.canvasWidth.set(rect.width || 800);
    this.canvasHeight.set(rect.height || 600);

    // Register wheel as a passive listener outside Angular zone for perf
    this.wheelListener = (e: WheelEvent) => this.handleWheel(e);
    // Register capture-phase mousedown to detect port clicks BEFORE
    // pol-card shadow DOM can intercept/stop propagation
    this.captureMouseDownListener = (e: MouseEvent) => this.handleCaptureMouseDown(e);
    this.ngZone.runOutsideAngular(() => {
      this.hostEl.nativeElement.addEventListener('wheel', this.wheelListener, {
        passive: false,
      });
      this.hostEl.nativeElement.addEventListener('mousedown', this.captureMouseDownListener, {
        capture: true,
      });
    });


  }

  ngOnDestroy(): void {
    this.hostEl.nativeElement.removeEventListener('wheel', this.wheelListener);
    this.hostEl.nativeElement.removeEventListener('mousedown', this.captureMouseDownListener, true);
    this.resizeObserver.disconnect();
  }

  // ── Wheel → zoom ──────────────────────────────────────────────────────────

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const oldZoom = this.vz();
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom + delta));
    if (newZoom === oldZoom) return;

    // Zoom toward cursor position
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scale = newZoom / oldZoom;
    const newTx = mouseX - scale * (mouseX - this.vx());
    const newTy = mouseY - scale * (mouseY - this.vy());

    this.ngZone.run(() => {
      this.vx.set(newTx);
      this.vy.set(newTy);
      this.vz.set(newZoom);
      this.commitViewport();
    });
  }

  // ── Mouse → pan ───────────────────────────────────────────────────────────

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent): void {
    // Only pan on primary button on the canvas background (not on nodes)
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.canvas-node')) return;
    if (target.closest('.canvas-edges')) return;

    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panOriginX = this.vx();
    this.panOriginY = this.vy();
    this.hostEl.nativeElement.classList.add('wd-dragging');
    // Only clear selection when not in read-only mode
    if (!this.isReadOnly()) {
      this.store.clearSelection();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      this.vx.set(this.panOriginX + dx);
      this.vy.set(this.panOriginY + dy);
      return;
    }

    // Update connect-draft cursor position
    if (this.connectDraft() !== null) {
      const world = this.toWorldCoords(e.clientX, e.clientY);
      this.connectDraft.update((d) =>
        d ? { ...d, cursorX: world.x, cursorY: world.y } : null
      );
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(e: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.hostEl.nativeElement.classList.remove('wd-dragging');
      this.commitViewport();
      return;
    }

    // Commit or discard connect-draft
    const draft = this.connectDraft();
    if (draft) {
      this.tryCommitEdge(e, draft);
      this.connectDraft.set(null);
      this.hostEl.nativeElement.classList.remove('wd-connecting');
    }
  }

  // ── Connect-drag (initiated by NodeComponent.connectStart) ────────────────

  onConnectStart(event: { nodeId: string; port: EdgePort }): void {
    if (this.isReadOnly()) return;
    const node = this.nodeMap().get(event.nodeId);
    if (!node) return;

    const anchor = getPortAnchor(node, event.port);
    this.connectDraft.set({
      sourceNodeId: event.nodeId,
      sourcePort: event.port,
      anchorX: anchor.x,
      anchorY: anchor.y,
      cursorX: anchor.x,
      cursorY: anchor.y,
    });
    this.hostEl.nativeElement.classList.add('wd-connecting');
  }

  // ── Capture-phase mousedown — fires before pol-card shadow DOM ───────────

  private handleCaptureMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    // Block all connect-drag in read-only mode
    if (this.isReadOnly()) return;

    // Use composedPath() so we pierce shadow DOM boundaries reliably
    const path = e.composedPath() as Element[];

    // Find a port element in the event path
    const portEl = path.find(
      (el) => el instanceof HTMLElement && el.classList?.contains('node-port')
    ) as HTMLElement | undefined;
    if (!portEl) return;

    const portAttr = portEl.getAttribute('data-port');
    if (!portAttr || portAttr === 'input') return;

    // Find the app-node host in the path (has data-node-id)
    const nodeHost = path.find(
      (el) => el instanceof HTMLElement && (el as HTMLElement).tagName?.toLowerCase() === 'app-node'
    ) as HTMLElement | undefined;
    if (!nodeHost) return;

    const nodeId = nodeHost.getAttribute('data-node-id');
    if (!nodeId) return;

    e.stopPropagation();

    this.ngZone.run(() => {
      this.onConnectStart({ nodeId, port: portAttr as EdgePort });
    });
  }

  private tryCommitEdge(e: MouseEvent, draft: ConnectDragState): void {
    const world = this.toWorldCoords(e.clientX, e.clientY);

    const NODE_W = 220;
    const NODE_H = 110;
    // Generous padding so drops near — but not pixel-perfect on — the card still connect
    const PAD = 24;

    for (const node of this.store.nodes()) {
      if (node.id === draft.sourceNodeId) continue;
      if (node.type === 'start') continue;

      const { x, y } = node.position;
      if (
        world.x >= x - PAD &&
        world.x <= x + NODE_W + PAD &&
        world.y >= y - PAD &&
        world.y <= y + NODE_H + PAD
      ) {
        const newEdge: CanvasEdge = {
          id: `edge_${draft.sourceNodeId}_${draft.sourcePort}_${node.id}_${Date.now()}`,
          sourceNodeId: draft.sourceNodeId,
          targetNodeId: node.id,
          sourcePort: draft.sourcePort,
        };
        this.store.addEdge(newEdge);
        return;
      }
    }
  }

  // ── Minimap pan ───────────────────────────────────────────────────────────

  onMinimapPan(worldPos: { x: number; y: number }): void {
    // Centre the viewport on the clicked world position
    const zoom = this.vz();
    const newTx = this.canvasWidth() / 2 - worldPos.x * zoom;
    const newTy = this.canvasHeight() / 2 - worldPos.y * zoom;
    this.vx.set(newTx);
    this.vy.set(newTy);
    this.commitViewport();
  }

  // ── Zoom in / out (toolbar buttons) ──────────────────────────────────────

  zoomIn(): void {
    this.applyZoomStep(ZOOM_STEP);
  }

  zoomOut(): void {
    this.applyZoomStep(-ZOOM_STEP);
  }

  /** Set an exact zoom level, zooming toward canvas centre. */
  setZoom(targetZoom: number): void {
    const oldZoom = this.vz();
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, targetZoom));
    if (newZoom === oldZoom) return;

    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const scale = newZoom / oldZoom;
    this.vx.set(cx - scale * (cx - this.vx()));
    this.vy.set(cy - scale * (cy - this.vy()));
    this.vz.set(newZoom);
    this.commitViewport();
  }

  private applyZoomStep(delta: number): void {
    const oldZoom = this.vz();
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((oldZoom + delta) * 10) / 10));
    if (newZoom === oldZoom) return;

    // Zoom toward canvas centre
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const scale = newZoom / oldZoom;
    this.vx.set(cx - scale * (cx - this.vx()));
    this.vy.set(cy - scale * (cy - this.vy()));
    this.vz.set(newZoom);
    this.commitViewport();
  }

  // ── Fit to screen ─────────────────────────────────────────────────────────

  fitScreen(): void {
    const nodes = this.store.nodes();
    if (nodes.length === 0) {
      this.vx.set(0);
      this.vy.set(0);
      this.vz.set(1);
      this.commitViewport();
      return;
    }

    // Compute bounding box of all nodes (node width/height estimated at 220×110)
    const NODE_W = 220;
    const NODE_H = 110;
    const PADDING = 80;

    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_W));
    const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_H));

    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const viewW = rect.width - PADDING * 2;
    const viewH = rect.height - PADDING * 2;

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const scaleX = viewW / contentW;
    const scaleY = viewH / contentH;
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY)));

    const tx = PADDING - minX * zoom + (viewW - contentW * zoom) / 2;
    const ty = PADDING - minY * zoom + (viewH - contentH * zoom) / 2;

    this.vx.set(tx);
    this.vy.set(ty);
    this.vz.set(zoom);
    this.commitViewport();
  }

  // ── Node drag helpers ─────────────────────────────────────────────────────

  /** Convert a pointer position in canvas-host coords to world coords */
  toWorldCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.vx()) / this.vz(),
      y: (clientY - rect.top - this.vy()) / this.vz(),
    };
  }

  /** Returns the canvas viewport centre in world coordinates */
  getViewportCentreWorld(): { x: number; y: number } {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    return this.toWorldCoords(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  // ── Node & edge event handlers ────────────────────────────────────────────

  onSelectNode(id: string): void {
    if (this.isReadOnly()) return;
    this.store.selectNode(id);
  }

  onMoveNode(event: { id: string; position: { x: number; y: number } }): void {
    this.store.moveNode(event.id, event.position);
  }

  onSelectEdge(id: string): void {
    if (this.isReadOnly()) return;
    this.store.selectEdge(id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private commitViewport(): void {
    const vp: Viewport = { x: this.vx(), y: this.vy(), zoom: this.vz() };
    this.store.updateViewport(vp);
  }
}
