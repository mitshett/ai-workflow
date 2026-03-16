// ─────────────────────────────────────────────
// Form field definitions (Start node input schema)
// ─────────────────────────────────────────────

export type FormFieldType = 'text' | 'number' | 'boolean' | 'dropdown' | 'textarea';

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];     // for dropdown
  description?: string;
}

/** A FormFieldDef with the schema key attached — used for run-time input collection. */
export interface RunField extends FormFieldDef {
  key: string;
}

// ─────────────────────────────────────────────
// Node Types
// ─────────────────────────────────────────────

export type NodeType =
  | 'start'
  | 'end'
  | 'agent'
  | 'mcp_tool'
  | 'gateway'
  | 'approval'
  | 'rest_client';

export type TriggerRule = 'all_success' | 'any_success' | 'all_done';

// ─────────────────────────────────────────────
// Canvas primitives
// ─────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ─────────────────────────────────────────────
// Node config interfaces (per type)
// ─────────────────────────────────────────────

export interface StartConfig {
  workflow_name?: string;
  workflow_id?: string;
  workflow_description?: string;
  input_schema?: Record<string, FormFieldDef>;
}

export interface EndConfig {
  /** Jinja2 template string resolved at runtime, e.g. {{ workflow.agent_1.response }} */
  result?: string;
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  user_prompt?: string;
  prompt?: string;
  response_format?: 'text' | 'json_object' | 'json_schema';
  json_schema?: JsonSchemaDefinition;
  tools?: string[];
  context_data?: Record<string, string>;
}

export interface JsonSchemaProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface JsonSchemaDefinition {
  name: string;
  properties: JsonSchemaProperty[];
}

export interface McpConfig {
  server_url: string;
  smart_mcp_enabled?: boolean;
  // Smart mode
  user_prompt?: string;
  max_tool_calls?: number;
  preferred_tools?: string[];
  context_data?: Record<string, string>;
  // Direct mode
  tool_name?: string;
  tool_arguments?: Record<string, unknown>;
}

export type ConditionType =
  | 'string_match'
  | 'string_contains'
  | 'regex_match'
  | 'numeric_comparison'
  | 'boolean_check';

export type NumericOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

export interface GatewayRule {
  value: string;
  operator?: NumericOperator;
  target_node: string;
  label?: string;
}

export interface GatewayConfig {
  input_source: string;
  condition_type: ConditionType;
  rules: GatewayRule[];
  default_target?: string;
}

export interface ApprovalConfig {
  approver?: string;
  message?: string;
  timeout_hours?: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RestClientConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  body?: string;
  expected_status?: number;
  timeout?: number;
}

export type NodeConfig =
  | StartConfig
  | EndConfig
  | AgentConfig
  | McpConfig
  | GatewayConfig
  | ApprovalConfig
  | RestClientConfig;

// ─────────────────────────────────────────────
// Canvas node & edge
// ─────────────────────────────────────────────

export interface CanvasNode {
  id: string;
  type: NodeType;
  alias: string;
  label: string;
  position: Position;
  config: NodeConfig;
  description?: string;
  tags?: string[];
  trigger_rule?: TriggerRule;
  /** next node IDs — derived from edges on serialization */
  next?: string[];
  /** dependency node IDs — derived from edges on serialization */
  dependencies?: string[];
}

export type EdgePort = 'output' | 'true' | 'false';

export interface CanvasEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePort: EdgePort;
  label?: string;
}

// ─────────────────────────────────────────────
// Node palette metadata (for the sidebar)
// ─────────────────────────────────────────────

export type NodeCategory = 'Control Flow' | 'AI' | 'Integration';

export interface NodeTemplate {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: NodeCategory;
  color: string;
  defaultConfig: NodeConfig;
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: 'start',
    label: 'Start',
    description: 'Entry point of the workflow',
    icon: 'play-circle',
    category: 'Control Flow',
    color: 'var(--magnetic-color-green-60)',
    defaultConfig: {} as StartConfig,
  },
  {
    type: 'end',
    label: 'End',
    description: 'Terminal node of the workflow',
    icon: 'stop-circle',
    category: 'Control Flow',
    color: 'var(--magnetic-color-red-60)',
    defaultConfig: {} as EndConfig,
  },
  {
    type: 'gateway',
    label: 'Gateway',
    description: 'Route flow based on conditions',
    icon: 'git-branch',
    category: 'Control Flow',
    color: 'var(--magnetic-color-orange-60)',
    defaultConfig: {
      input_source: '',
      condition_type: 'string_match',
      rules: [],
    } as GatewayConfig,
  },
  {
    type: 'approval',
    label: 'Approval',
    description: 'Pause and wait for human approval',
    icon: 'user-check',
    category: 'Control Flow',
    color: 'var(--magnetic-color-purple-55)',
    defaultConfig: {
      message: 'Please review and approve',
      timeout_hours: 24,
    } as ApprovalConfig,
  },
  {
    type: 'agent',
    label: 'Agent',
    description: 'Run an LLM agent with a prompt',
    icon: 'robot',
    category: 'AI',
    color: 'var(--magnetic-color-blue-55)',
    defaultConfig: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: 'text',
    } as AgentConfig,
  },
  {
    type: 'mcp_tool',
    label: 'MCP Tool',
    description: 'Call an MCP server tool',
    icon: 'plug',
    category: 'Integration',
    color: 'var(--magnetic-color-teal-65)',
    defaultConfig: {
      server_url: 'cisco',
      smart_mcp_enabled: true,
    } as McpConfig,
  },
  {
    type: 'rest_client',
    label: 'REST Client',
    description: 'Make an HTTP request',
    icon: 'cloud-arrow-up',
    category: 'Integration',
    color: 'var(--magnetic-color-orange-65)',
    defaultConfig: {
      method: 'GET',
      url: '',
    } as RestClientConfig,
  },
];
