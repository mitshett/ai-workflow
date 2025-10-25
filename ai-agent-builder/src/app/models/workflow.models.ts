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
  type: 'http' | 'stdio';
  url?: string;
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

export interface MCPConfig {
  name?: string;
  description?: string;
  server: MCPServerConfig;
  toolName?: string;
  toolArguments?: { [key: string]: any };
  timeout?: number;
  retryAttempts?: number;
  availableTools?: MCPTool[];
}

export interface NodeData {
  inputVariables?: Variable[];
  stateVariables?: Variable[];
  agentConfig?: AgentConfig;
  mcpConfig?: MCPConfig;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant' | 'system';
  timestamp: Date;
}