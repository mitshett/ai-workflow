import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { CanvasEdge, CanvasNode, RunField, Viewport } from '../models/node.models';
import type { ExecutionResult, ExecutionState, NodeResult } from '../models/execution.models';

// ─────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────

export type RightPanelMode = 'properties' | 'execution';
export type Theme = 'magnetic-blue-light' | 'magnetic-dark';

export interface WorkflowState {
  // Canvas
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  viewport: Viewport;

  // Workflow metadata
  workflowName: string;

  // Execution
  executionState: ExecutionState;
  executionResult: ExecutionResult | null;
  activeRunId: string | null;
  pendingApprovalNodeId: string | null;
  runInputFields: RunField[];

  // UI
  sidebarCollapsed: boolean;
  sidebarWasCollapsedBeforeExecution: boolean;
  rightPanelMode: RightPanelMode;
  rightPanelOpen: boolean;
  rightPanelExpanded: 'docked' | 'fullscreen' | false;
  theme: Theme;
}

const initialState: WorkflowState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  viewport: { x: 0, y: 0, zoom: 0.75 },
  workflowName: 'Untitled Workflow',
  executionState: 'idle',
  executionResult: null,
  activeRunId: null,
  pendingApprovalNodeId: null,
  runInputFields: [],
  sidebarCollapsed: false,
  sidebarWasCollapsedBeforeExecution: false,
  rightPanelMode: 'properties',
  rightPanelOpen: false,
  rightPanelExpanded: false,
  theme: 'magnetic-blue-light',
};

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const WorkflowStore = signalStore(
  { providedIn: 'root' },
  withState<WorkflowState>(initialState),

  // ── Computed ──────────────────────────────
  withComputed(({ nodes, edges, selectedNodeId, selectedEdgeId, executionResult }) => ({
    selectedNode: computed(() =>
      nodes().find((n) => n.id === selectedNodeId()) ?? null
    ),
    selectedEdge: computed(() =>
      edges().find((e) => e.id === selectedEdgeId()) ?? null
    ),
    canRun: computed(() =>
      nodes().some((n) => n.type === 'start') &&
      nodes().some((n) => n.type === 'end')
    ),
    nodeCount: computed(() => nodes().length),
    edgeCount: computed(() => edges().length),
    nodeResultMap: computed(() => {
      const results = executionResult()?.nodeResults ?? [];
      return new Map(results.map((r) => [r.nodeId, r]));
    }),
  })),

  // ── Methods ───────────────────────────────
  withMethods((store) => ({

    // ── Node CRUD ──

    addNode(node: CanvasNode): void {
      patchState(store, { nodes: [...store.nodes(), node] });
    },

    removeNode(id: string): void {
      patchState(store, {
        nodes: store.nodes().filter((n) => n.id !== id),
        edges: store.edges().filter(
          (e) => e.sourceNodeId !== id && e.targetNodeId !== id
        ),
        selectedNodeId:
          store.selectedNodeId() === id ? null : store.selectedNodeId(),
      });
    },

    updateNode(id: string, changes: Partial<CanvasNode>): void {
      patchState(store, {
        nodes: store.nodes().map((n) =>
          n.id === id ? { ...n, ...changes } : n
        ),
      });
    },

    updateNodeConfig(id: string, config: Partial<CanvasNode['config']>): void {
      patchState(store, {
        nodes: store.nodes().map((n) =>
          n.id === id ? { ...n, config: { ...n.config, ...config } } : n
        ),
      });
    },

    moveNode(id: string, pos: { x: number; y: number }): void {
      patchState(store, {
        nodes: store.nodes().map((n) =>
          n.id === id ? { ...n, position: pos } : n
        ),
      });
    },

    // ── Edge CRUD ──

    addEdge(edge: CanvasEdge): void {
      // Prevent duplicate edges on same source port
      const existing = store.edges().find(
        (e) =>
          e.sourceNodeId === edge.sourceNodeId &&
          e.sourcePort === edge.sourcePort &&
          e.targetNodeId === edge.targetNodeId
      );
      if (existing) return;
      patchState(store, { edges: [...store.edges(), edge] });
    },

    removeEdge(id: string): void {
      patchState(store, {
        edges: store.edges().filter((e) => e.id !== id),
        selectedEdgeId:
          store.selectedEdgeId() === id ? null : store.selectedEdgeId(),
      });
    },

    updateEdge(id: string, changes: Partial<CanvasEdge>): void {
      patchState(store, {
        edges: store.edges().map((e) =>
          e.id === id ? { ...e, ...changes } : e
        ),
      });
    },

    // ── Selection ──

    selectNode(id: string | null): void {
      const v = store.viewport();
      patchState(store, {
        selectedNodeId: id,
        selectedEdgeId: null,
        rightPanelMode: 'properties',
        rightPanelOpen: id !== null,
        rightPanelExpanded: id !== null ? 'docked' : false,
        viewport: { ...v, zoom: id !== null ? 0.60 : 0.75 },
      });
    },

    selectEdge(id: string | null): void {
      patchState(store, {
        selectedEdgeId: id,
        selectedNodeId: null,
      });
    },

    clearSelection(): void {
      patchState(store, { selectedNodeId: null, selectedEdgeId: null });
    },

    closePanel(): void {
      const v = store.viewport();
      patchState(store, {
        rightPanelOpen: false,
        rightPanelExpanded: false,
        viewport: { ...v, zoom: 0.75 },
      });
    },

    openRunPanel(fields: RunField[]): void {
      patchState(store, {
        executionState: 'collecting',
        rightPanelMode: 'execution',
        rightPanelOpen: true,
        rightPanelExpanded: false,
        runInputFields: fields,
        selectedNodeId: null,
        selectedEdgeId: null,
        sidebarWasCollapsedBeforeExecution: store.sidebarCollapsed(),
        sidebarCollapsed: true,
      });
    },

    // ── Viewport ──

    updateViewport(viewport: Viewport): void {
      patchState(store, { viewport });
    },

    // ── Workflow metadata ──

    setWorkflowName(name: string): void {
      patchState(store, { workflowName: name });
    },

    loadWorkflow(nodes: CanvasNode[], edges: CanvasEdge[], name?: string): void {
      patchState(store, {
        nodes,
        edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        workflowName: name ?? store.workflowName(),
        executionState: 'idle',
        executionResult: null,
        activeRunId: null,
        pendingApprovalNodeId: null,
        rightPanelMode: 'properties',
        rightPanelOpen: false,
        rightPanelExpanded: false,
      });
    },

    clearCanvas(): void {
      patchState(store, {
        nodes: [],
        edges: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        executionState: 'idle',
        executionResult: null,
        activeRunId: null,
        pendingApprovalNodeId: null,
      });
    },

    // ── Execution ──

    startExecution(runId: string): void {
      patchState(store, {
        executionState: 'running',
        activeRunId: runId,
        pendingApprovalNodeId: null,
        executionResult: {
          runId,
          state: 'running',
          nodeResults: [],
          startedAt: new Date().toISOString(),
        },
        rightPanelMode: 'execution',
        rightPanelExpanded: false,
        // Collapse sidebar for execution view; remember prior state for restore
        sidebarWasCollapsedBeforeExecution: store.sidebarCollapsed(),
        sidebarCollapsed: true,
      });
    },

    setExecutionState(state: ExecutionState): void {
      patchState(store, { executionState: state });
    },

    setExecutionResult(result: ExecutionResult): void {
      patchState(store, {
        executionResult: result,
        executionState: result.state,
        activeRunId: result.runId,
      });
    },

    updateNodeResult(nodeResult: NodeResult): void {
      const current = store.executionResult();
      if (!current) return;
      const existing = current.nodeResults.findIndex(
        (r) => r.nodeId === nodeResult.nodeId
      );
      const nodeResults =
        existing >= 0
          ? current.nodeResults.map((r, i) => (i === existing ? nodeResult : r))
          : [...current.nodeResults, nodeResult];
      patchState(store, {
        executionResult: { ...current, nodeResults },
      });
    },

    setPendingApproval(nodeId: string | null): void {
      patchState(store, {
        pendingApprovalNodeId: nodeId,
        executionState: nodeId ? 'paused_approval' : store.executionState(),
      });
    },

    setWorkflowOutput(value: unknown): void {
      const current = store.executionResult();
      if (!current) return;
      patchState(store, {
        executionResult: { ...current, workflowOutput: value },
      });
    },

    resetExecution(): void {
      const v = store.viewport();
      patchState(store, {
        executionState: 'idle',
        executionResult: null,
        activeRunId: null,
        pendingApprovalNodeId: null,
        runInputFields: [],
        rightPanelMode: 'properties',
        rightPanelOpen: false,
        rightPanelExpanded: false,
        viewport: { ...v, zoom: 0.75 },
        // Restore sidebar to state it was in before execution started
        sidebarCollapsed: store.sidebarWasCollapsedBeforeExecution(),
      });
    },

    // ── UI ──

    toggleSidebar(): void {
      patchState(store, { sidebarCollapsed: !store.sidebarCollapsed() });
    },

    setRightPanelMode(mode: RightPanelMode): void {
      patchState(store, { rightPanelMode: mode });
    },

    setTheme(theme: Theme): void {
      patchState(store, { theme });
    },

    setRightPanelExpanded(mode: 'docked' | 'fullscreen' | false): void {
      patchState(store, { rightPanelExpanded: mode });
    },
  }))
);
