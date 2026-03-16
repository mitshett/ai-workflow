// ─────────────────────────────────────────────
// Execution state machine
// ─────────────────────────────────────────────

export type ExecutionState =
  | 'idle'
  | 'collecting'
  | 'running'
  | 'paused_approval'
  | 'completed'
  | 'failed';

export type NodeStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'timeout';

// ─────────────────────────────────────────────
// Per-node result (from Temporal status poll)
// ─────────────────────────────────────────────

export interface NodeResult {
  nodeId: string;
  alias: string;
  status: NodeStatus;
  data?: unknown;
  error?: string;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────
// Full execution result
// ─────────────────────────────────────────────

export interface ExecutionResult {
  runId: string;
  state: ExecutionState;
  nodeResults: NodeResult[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
  /** Resolved value of the End node's result template, set when execution completes. */
  workflowOutput?: unknown;
}

// ─────────────────────────────────────────────
// Temporal API request / response shapes
// ─────────────────────────────────────────────

// Definition wrapper used in Format A requests
export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: TemporalNodeDef[];
}

export interface WorkflowExecuteRequest {
  // Format A — preferred: wrap nodes in a definition object
  definition?: WorkflowDefinition;
  // Format B — flat nodes array (fallback)
  nodes?: TemporalNodeDef[];
  input_data?: Record<string, unknown>;
  run_id?: string;
  execution_options?: {
    max_parallel_nodes?: number;
    continue_on_failure?: boolean;
    timeout_seconds?: number;
  };
}

export interface TemporalNodeDef {
  id: string;
  type: string;
  alias: string;
  config: Record<string, unknown>;
  name?: string;
  description?: string;
  next?: string[];
  dependencies?: string[];
  trigger_rule?: string;
  tags?: string[];
}

export interface ExecuteResponse {
  run_id: string;
  workflow_id: string;
  status: string;
  message: string;
}

// Actual backend status response shape from /api/v1/workflows/{run_id}/status
export interface BackendNodeResult {
  node_id: string;
  status: string;  // 'success'|'failed'|'in_progress'|'pending'|'skipped'|'timeout'
  data: Record<string, unknown>;
  error: string | null;
}

export interface StatusResponse {
  run_id: string;
  workflow_id: string;
  status: string;  // 'running'|'completed'|'failed'|'cancelled'|'timeout'|'paused_approval'
  completed_nodes: string[];
  node_results: BackendNodeResult[];
  context: Record<string, unknown>;
  end_data: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface ApprovalResponse {
  message: string;
  run_id: string;
  node_id: string;
}

// ─────────────────────────────────────────────
// Chat Q&A over workflow results
// ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WorkflowChatContext {
  workflow_name: string;
  run_id: string;
  node_results: {
    alias: string;
    type: string;
    status: string;
    data?: unknown;
    error?: string;
    duration_ms?: number;
  }[];
  workflow_output?: unknown;
}

export interface ChatResponse {
  reply: string;
  model: string;
}
