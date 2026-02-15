export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  alias: string;              // MANDATORY: Short identifier for variable access
  icon: string;
  position: { x: number; y: number };
  data?: NodeData;
  connections?: string[];
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  updatedAt: Date;
}

export type NodeType =
  | 'start'
  | 'agent'
  | 'end'
  | 'mcp'
  | 'if-else'
  | 'sequential'
  | 'parallel';

export interface NodeTemplate {
  type: NodeType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface DragData {
  nodeType: NodeType;
  template: NodeTemplate;
}

export interface Variable {
  name: string;
  type: string;
  defaultValue?: any;
  description?: string;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface SchemaProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  description?: string;
  required: boolean;
  enumValues?: string[];
}

export interface JsonSchema {
  name: string;
  properties: SchemaProperty[];
}

export interface AgentConfig {
  name?: string;
  instructions?: string;
  context?: 'none' | 'recent_messages';
  model?: string;
  stateVariables?: Variable[];
  tools?: Tool[];
  outputFormat?: 'text' | 'json' | 'widget' | 'chatkit';
  jsonSchema?: JsonSchema;
}

export interface MCPServerConfig {
  type: 'http' | 'streamable-http' | 'stdio';
  url?: string;
  headers?: { [key: string]: string };
  timeout?: number;
  command?: string;
  args?: string[];
}

export interface MCPTool {
  name: string;
  description?: string;
  arguments: { [key: string]: any };
  enabled: boolean;
}

export interface MCPLLMConfig {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface MCPConfig {
  name?: string;
  description?: string;
  server: MCPServerConfig;
  smart_mcp_enabled: boolean;
  
  // Regular MCP fields (when smart_mcp_enabled = false)
  toolName?: string;
  toolArguments?: { [key: string]: any };
  tool_arguments?: { [key: string]: any };
  output_format?: string;
  
  // Smart MCP fields (when smart_mcp_enabled = true)
  llm_config?: MCPLLMConfig;
  user_prompt?: string;
  context_data?: { [key: string]: any };
  
  // Common fields
  timeout: number;
  availableTools?: MCPTool[];
}

export interface EndConfig {
  nodeName?: string; // Name of the node whose response should be displayed
}

export interface NodeData {
  inputVariables?: Variable[];
  stateVariables?: Variable[];
  agentConfig?: AgentConfig;
  mcpConfig?: MCPConfig;
  endConfig?: EndConfig;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'system';
  timestamp: Date;
  executionResponse?: WorkflowExecutionResponse; // Optional execution data for timeline display
}

// ===============================
// WORKFLOW EXECUTION MODELS
// ===============================

export interface NodeResult {
  node_id: string;
  node_name: string;
  node_type: string;  // "start", "end", "agent", "mcp_tool", "condition"
  status: string;     // "success", "failed", "running"
  response: string | null;  // Simple text summary of node execution
  structured_output: Record<string, any>;  // JSON object with predefined keys (empty {} if no schema)
  error: string | null;  // Error message if failed
}

export interface WorkflowExecutionResponse {
  run_id: string;
  workflow_id: string;
  status: string;  // "completed", "failed", "running"
  success: boolean;
  started_at: string;  // ISO timestamp
  finished_at: string | null;  // ISO timestamp or null if still running
  duration_seconds: number | null;
  nodes: NodeResult[];  // Node execution results array
}

// Legacy interface for backward compatibility
export interface NodeExecutionResult {
  node_id: string;
  node_name: string;
  node_type: string;
  alias: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  output?: any;
  error?: string;
}

export interface WorkflowExecutionRequest {
  definition: {
    id: string;
    name: string;
    description?: string;
    nodes: any[];
  };
  input_data: { [key: string]: any };
  run_id?: string;
}