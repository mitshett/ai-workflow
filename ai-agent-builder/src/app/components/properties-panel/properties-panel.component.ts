import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Polarity Components
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent, SelectItem, SelectValue } from '@polarity/components/select';

// Models
import { WorkflowNode, AgentConfig, MCPConfig, JsonSchema, SchemaProperty } from '../../models/workflow.models';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    SelectComponent,
  ],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss'
})
export class PropertiesPanelComponent implements OnChanges {
  
  // Inputs from parent component
  @Input() selectedNodeId: string | null = null;
  @Input() canvasNodes: WorkflowNode[] = [];
  @Input() showJsonSchemaModal: boolean = false;
  @Input() currentJsonSchema: JsonSchema = { name: '', properties: [] };
  @Input() schemaMode: string = 'simple';
  @Input() newEnumValue: string = '';
  
  // Output events to parent component
  @Output() closePanel = new EventEmitter<void>();
  @Output() nodeUpdate = new EventEmitter<WorkflowNode>();
  @Output() openJsonSchemaModal = new EventEmitter<void>();

  // ===============================
  // CACHED VALUES TO PREVENT INFINITE LOOPS
  // ===============================
  
  cachedSelectedNode: WorkflowNode | null = null;
  cachedMCPToolArguments: Array<{key: string, value: string}> = [];
  cachedWorkflowInputs: { path: string; type: string; description?: string }[] = [];
  cachedRuntimeVariables: { path: string; type: string; description?: string }[] = [];
  cachedNodeOutputs: Map<string, { path: string; type: string; description?: string }[]> = new Map();

  // ===============================
  // WORKFLOW VARIABLES PANEL STATE
  // ===============================
  
  variablesPanelExpanded = false;

  // ===============================
  // AUTOCOMPLETE STATE
  // ===============================
  
  showAutocomplete = false;
  autocompleteVariables: { path: string; type: string; description?: string }[] = [];
  autocompletePosition = { top: 0, left: 0 };
  activeAutocompleteIndex = 0;

  // ===============================
  // POLARITY SELECT OPTIONS
  // ===============================
  
  readonly modelOptions: SelectItem[] = [
    { value: 'gpt-35-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'azure-gpt-35-turbo', label: 'Azure GPT-3.5 Turbo' },
    { value: 'azure-gpt-4', label: 'Azure GPT-4' },
    { value: 'azure-gpt-4-turbo', label: 'Azure GPT-4 Turbo' },
    { value: 'azure-gpt-4o', label: 'Azure GPT-4o' },
    { value: 'azure-gpt-4o-mini', label: 'Azure GPT-4o Mini' }
  ];
  
  readonly outputFormatOptions: SelectItem[] = [
    { value: 'text', label: 'Plain Text' },
    { value: 'json', label: 'Structured JSON' }
  ];

  readonly variableTypeOptions: SelectItem[] = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'object', label: 'Object' },
    { value: 'array', label: 'Array' }
  ];

  readonly serverTypeOptions: SelectItem[] = [
    { value: 'http', label: 'HTTP' },
    { value: 'stdio', label: 'Stdio' }
  ];

  // ===============================
  // ONCHANGES IMPLEMENTATION
  // ===============================

  ngOnChanges(changes: SimpleChanges): void {
    // Update cached selected node when selectedNodeId or canvasNodes change
    if (changes['selectedNodeId'] || changes['canvasNodes']) {
      this.updateCachedSelectedNode();
      this.updateCachedMCPToolArguments();
    }
    
    // Update cached variables when canvasNodes change
    if (changes['canvasNodes']) {
      this.updateCachedVariables();
    }
  }

  private updateCachedSelectedNode(): void {
    if (!this.selectedNodeId) {
      this.cachedSelectedNode = null;
      return;
    }
    
    const node = this.canvasNodes.find(node => node.id === this.selectedNodeId) || null;
    
    // Ensure data is initialized for agent and MCP nodes
    if (node) {
      if (node.type === 'agent') {
        this.ensureAgentData(node);
      } else if (node.type === 'mcp') {
        this.ensureMCPData(node);
      }
    }
    
    this.cachedSelectedNode = node;
  }

  private updateCachedMCPToolArguments(): void {
    if (!this.cachedSelectedNode?.data?.mcpConfig?.toolArguments) {
      this.cachedMCPToolArguments = [];
      return;
    }
    
    const toolArguments = this.cachedSelectedNode.data.mcpConfig.toolArguments;
    this.cachedMCPToolArguments = Object.entries(toolArguments).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }

  private updateCachedVariables(): void {
    // Cache workflow inputs
    this.cachedWorkflowInputs = [
      { path: 'workflow.user_request', type: 'string', description: 'The user\'s initial message/request' },
      { path: 'workflow.run_id', type: 'string', description: 'Unique identifier for this workflow execution' },
      { path: 'workflow.timestamp', type: 'string', description: 'ISO timestamp when workflow started' }
    ];

    // Cache runtime variables
    this.cachedRuntimeVariables = [
      { path: 'context.current_time', type: 'string', description: 'Current timestamp in ISO format' },
      { path: 'context.session_id', type: 'string', description: 'Unique session identifier' }
    ];

    // Cache node outputs
    this.cachedNodeOutputs.clear();
    this.canvasNodes.forEach(node => {
      const outputs = this.calculateNodeOutputs(node);
      this.cachedNodeOutputs.set(node.id, outputs);
    });
  }

  private calculateNodeOutputs(node: WorkflowNode): { path: string; type: string; description?: string }[] {
    const outputs: { path: string; type: string; description?: string }[] = [];
    
    if (node.alias) {
      switch (node.type) {
        case 'agent':
          outputs.push(
            { path: `workflow.${node.alias}.response`, type: 'string', description: 'AI agent response' },
            { path: `workflow.${node.alias}.full`, type: 'object', description: 'Complete agent output' }
          );
          break;
        case 'mcp':
          outputs.push(
            { path: `workflow.${node.alias}.result`, type: 'any', description: 'MCP tool execution result' },
            { path: `workflow.${node.alias}.status`, type: 'string', description: 'Execution status' }
          );
          break;
        case 'start':
          outputs.push(
            { path: `workflow.${node.alias}.timestamp`, type: 'string', description: 'Start time' }
          );
          break;
        case 'end':
          outputs.push(
            { path: `workflow.${node.alias}.final_result`, type: 'any', description: 'Final workflow result' }
          );
          break;
      }
    }
    
    return outputs;
  }

  // ===============================
  // NODE SELECTION METHODS
  // ===============================

  // Get the currently selected node (now returns cached value)
  getSelectedNode(): WorkflowNode | null {
    return this.cachedSelectedNode;
  }

  // Close the properties panel
  onClosePanel(): void {
    console.log('🔴 CLOSE BUTTON CLICKED!!! Properties panel close button clicked - emitting closePanel event');
    console.log('🔴 About to emit closePanel event');
    this.closePanel.emit();
    console.log('🔴 closePanel event emitted');
  }

  // Get icon name with proper typing
  getIconName(iconName: string): any {
    return iconName as any;
  }

  // ===============================
  // NODE DATA INITIALIZATION
  // ===============================

  // Initialize agent data structure if it doesn't exist
  private ensureAgentData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.agentConfig) {
      node.data.agentConfig = {
        name: node.label,
        instructions: 'You are a helpful assistant. User request: ${user_request}',
        context: 'recent_messages',
        model: 'gpt-35-turbo',
        stateVariables: [
          {
            name: 'user_request',
            type: 'string',
            description: 'The user\'s input message or query'
          }
        ],
        tools: [],
        outputFormat: 'text'
      };
    }
    
    // Ensure stateVariables array exists
    if (!node.data.agentConfig.stateVariables) {
      node.data.agentConfig.stateVariables = [
        {
          name: 'user_request',
          type: 'string',
          description: 'The user\'s input message or query'
        }
      ];
    }
    
    // Auto-add user_request if not present
    const hasUserRequest = node.data.agentConfig.stateVariables.some(v => v.name === 'user_request');
    if (!hasUserRequest) {
      node.data.agentConfig.stateVariables.push({
        name: 'user_request',
        type: 'string',
        description: 'The user\'s input message or query'
      });
    }
  }

  // Initialize MCP data structure if it doesn't exist
  private ensureMCPData(node: WorkflowNode): void {
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.mcpConfig) {
      node.data.mcpConfig = {
        name: node.label,
        description: '',
        server: {
          type: 'http',
          url: 'http://localhost:8080',
          timeout: 30
        },
        toolName: '',
        toolArguments: {},
        timeout: 60,
        retryAttempts: 3
      };
    }
  }

  // ===============================
  // AGENT CONFIGURATION METHODS
  // ===============================

  // Agent name change handler - sync with canvas node label
  onAgentNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    
    // Update the agent config name
    selectedNode.data!.agentConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'Agent';
    
    console.log('Agent name changed:', { newName, nodeLabel: selectedNode.label });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Output format change handler
  onOutputFormatChange(value?: SelectValue): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;
    
    this.ensureAgentData(selectedNode);
    
    console.log('Output format changed to:', selectedNode.data!.agentConfig!.outputFormat);

    // Clear JSON schema if switching away from JSON
    if (selectedNode.data!.agentConfig!.outputFormat !== 'json') {
      selectedNode.data!.agentConfig!.jsonSchema = undefined;
    }
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Add agent state variable
  addAgentStateVariable(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    selectedNode.data!.agentConfig!.stateVariables!.push({
      name: '',
      type: 'string',
      description: ''
    });
    
    console.log('Added agent state variable to node:', selectedNode.id);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Remove agent state variable
  removeAgentStateVariable(index: number): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'agent') return;

    this.ensureAgentData(selectedNode);
    const agentConfig = selectedNode.data!.agentConfig!;
    
    if (!agentConfig.stateVariables) return;

    // Prevent removing the required user_request variable
    const variable = agentConfig.stateVariables[index];
    if (variable && variable.name === 'user_request') {
      alert('Cannot remove the required user_request variable. This variable is needed to pass user input to the agent.');
      return;
    }

    agentConfig.stateVariables.splice(index, 1);
    console.log('Removed agent state variable at index:', index);
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // ===============================
  // MCP CONFIGURATION METHODS
  // ===============================

  // MCP name change handler - sync with canvas node label  
  onMCPNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    
    // Update the MCP config name
    selectedNode.data!.mcpConfig!.name = newName;
    
    // Sync with canvas node label - use name if provided, fallback to default
    selectedNode.label = newName && newName.trim() ? newName.trim() : 'MCP';
    
    console.log('MCP name changed:', { newName, nodeLabel: selectedNode.label });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // MCP server type change handler
  onMCPServerTypeChange(value?: SelectValue): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    console.log('MCP server type changed');
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Get MCP tool arguments as array for template iteration
  getMCPToolArgumentsArray(): Array<{key: string, value: string}> {
    return this.cachedMCPToolArguments;
  }

  // Handle MCP argument key change
  onMCPArgumentKeyChange(event: Event, oldKey: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newKey = (event.target as HTMLInputElement).value;
    if (newKey === oldKey) return;

    this.ensureMCPData(selectedNode);
    const toolArguments = selectedNode.data!.mcpConfig!.toolArguments!;
    
    // Update the key
    const value = toolArguments[oldKey];
    delete toolArguments[oldKey];
    toolArguments[newKey] = value;
    
    console.log('MCP argument key changed:', { oldKey, newKey });
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Handle MCP argument value change
  onMCPArgumentValueChange(event: Event, key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newValue = (event.target as HTMLInputElement).value;
    
    this.ensureMCPData(selectedNode);
    selectedNode.data!.mcpConfig!.toolArguments![key] = newValue;
    
    console.log('MCP argument value changed:', { key, newValue });
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Add MCP tool argument
  addMCPToolArgument(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    
    // Find a unique key name
    let newKey = 'arg';
    let counter = 1;
    const toolArguments = selectedNode.data!.mcpConfig!.toolArguments!;
    
    while (toolArguments.hasOwnProperty(newKey)) {
      newKey = `arg${counter}`;
      counter++;
    }
    
    toolArguments[newKey] = '';
    console.log('Added MCP tool argument:', newKey);
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Remove MCP tool argument
  removeMCPToolArgument(key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.ensureMCPData(selectedNode);
    delete selectedNode.data!.mcpConfig!.toolArguments![key];
    
    console.log('Removed MCP tool argument:', key);
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Test MCP connection
  testMCPConnection(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    console.log('🔌 Testing MCP connection...', selectedNode.data!.mcpConfig);
    // TODO: Implement actual MCP connection test
    alert('MCP connection test would be implemented here');
  }

  // ===============================
  // ALIAS VALIDATION METHODS
  // ===============================

  // Alias change handler - validate and update (no parameter version for template)
  onAliasChange(newAlias?: string): void {
    if (typeof newAlias === 'undefined') return;
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return;

    // Clean and validate the alias
    const cleanAlias = newAlias.trim().toLowerCase();
    const validation = this.validateAlias(cleanAlias, selectedNode.id);

    if (validation.valid) {
      selectedNode.alias = cleanAlias;
      console.log('Alias changed successfully:', { nodeId: selectedNode.id, newAlias: cleanAlias });
      
      // Emit node update
      this.nodeUpdate.emit(selectedNode);
    }
  }

  // Check if current node has alias error
  hasAliasError(): boolean {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return false;

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return !validation.valid;
  }

  // Get alias error message
  getAliasErrorMessage(): string {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode) return '';

    const validation = this.validateAlias(selectedNode.alias, selectedNode.id);
    return validation.message || '';
  }

  // Validate alias uniqueness and format
  private validateAlias(alias: string, nodeId: string): { valid: boolean; message?: string } {
    if (!alias) {
      return { valid: false, message: 'Alias is required' };
    }

    // Check format (alphanumeric + underscore)
    if (!/^[a-z][a-z0-9_]*$/.test(alias)) {
      return { valid: false, message: 'Alias must start with a letter and contain only lowercase letters, numbers, and underscores' };
    }

    // Check uniqueness
    const duplicateNode = this.canvasNodes.find(node => 
      node.id !== nodeId && node.alias === alias
    );

    if (duplicateNode) {
      return { valid: false, message: 'This alias is already used by another node' };
    }

    return { valid: true };
  }

  // ===============================
  // JSON SCHEMA METHODS
  // ===============================

  // Setup JSON schema
  setupJsonSchema(): void {
    console.log('🎛️ Setup JSON schema button clicked');
    console.log('  - Emitting openJsonSchemaModal event');
    this.openJsonSchemaModal.emit();
  }

  // Edit JSON schema
  editJsonSchema(): void {
    console.log('Edit JSON schema for selected node');
    this.openJsonSchemaModal.emit();
  }

  // ===============================
  // WORKFLOW VARIABLES METHODS
  // ===============================

  // Toggle variables panel expansion
  toggleVariablesPanel(): void {
    this.variablesPanelExpanded = !this.variablesPanelExpanded;
  }

  // Get workflow input variables
  getWorkflowInputs(): { path: string; type: string; description?: string }[] {
    return this.cachedWorkflowInputs;
  }

  // Get runtime variables
  getRuntimeVariables(): { path: string; type: string; description?: string }[] {
    return this.cachedRuntimeVariables;
  }

  // Get node outputs for variables (now returns cached value)
  getNodeOutputs(node: WorkflowNode): { path: string; type: string; description?: string }[] {
    return this.cachedNodeOutputs.get(node.id) || [];
  }

  // Get icon for node type  
  getNodeIcon(nodeType: string): "play-circle" | "user" | "gear" | "stop-circle" | "circle" {
    switch (nodeType) {
      case 'start': return 'play-circle';
      case 'agent': return 'user';
      case 'mcp': return 'gear';
      case 'end': return 'stop-circle';
      default: return 'circle';
    }
  }

  // Copy variable to clipboard
  copyToClipboard(variablePath: string): void {
    const textToCopy = `\${${variablePath}}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        console.log('Variable copied to clipboard:', textToCopy);
        // TODO: Show toast notification
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Variable copied to clipboard (fallback):', textToCopy);
      } catch (err) {
        console.error('Failed to copy to clipboard (fallback):', err);
      }
      document.body.removeChild(textArea);
    }
  }

  // ===============================
  // AUTOCOMPLETE METHODS
  // ===============================

  // Handle input in instructions textarea
  onInstructionsInput(event: Event, textareaElement: HTMLTextAreaElement): void {
    const target = event.target as HTMLTextAreaElement;
    const value = target.value;
    const cursorPosition = target.selectionStart;
    
    // Check if user is typing workflow variables (trigger on just "workflow.")
    const beforeCursor = value.substring(0, cursorPosition);
    const match = beforeCursor.match(/workflow\.([^}\s]*)$/);
    
    if (match) {
      const partialPath = match[1];
      this.showVariableAutocomplete(textareaElement, partialPath);
    } else {
      this.hideAutocomplete();
    }
  }

  // Show autocomplete dropdown with filtered variables
  private showVariableAutocomplete(textareaElement: HTMLTextAreaElement, partialPath: string): void {
    // Get all available variables
    const allVariables = [
      ...this.getWorkflowInputs(),
      ...this.getRuntimeVariables(),
      ...this.canvasNodes.flatMap(node => this.getNodeOutputs(node))
    ];
    
    // Filter variables based on partial path
    this.autocompleteVariables = allVariables.filter(variable => 
      variable.path.toLowerCase().includes(partialPath.toLowerCase())
    );
    
    if (this.autocompleteVariables.length > 0) {
      // Calculate position for dropdown
      this.calculateAutocompletePosition(textareaElement);
      this.showAutocomplete = true;
      this.activeAutocompleteIndex = 0;
    } else {
      this.hideAutocomplete();
    }
  }

  // Calculate position for autocomplete dropdown
  private calculateAutocompletePosition(textareaElement: HTMLTextAreaElement): void {
    const rect = textareaElement.getBoundingClientRect();
    const cursorPosition = textareaElement.selectionStart;
    
    // Calculate approximate cursor position
    const lineHeight = 20; // Approximate line height
    const charWidth = 8; // Approximate character width
    const lines = textareaElement.value.substring(0, cursorPosition).split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    // Basic position
    let top = rect.top + (currentLine * lineHeight) + 25;
    let left = rect.left + (currentColumn * charWidth);
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Estimated dropdown dimensions
    const dropdownWidth = 300;
    const dropdownHeight = Math.min(this.autocompleteVariables.length * 40, 200);
    
    // Adjust horizontal position if it would go off-screen
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 20; // 20px margin from edge
    }
    
    // Adjust vertical position if it would go off-screen
    if (top + dropdownHeight > viewportHeight) {
      top = rect.top - dropdownHeight - 5; // Show above textarea instead
    }
    
    // Ensure minimum margins
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    this.autocompletePosition = { top, left };
  }

  // Handle keyboard navigation in autocomplete
  onInstructionsKeydown(event: KeyboardEvent, textareaElement: HTMLTextAreaElement): void {
    if (!this.showAutocomplete) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeAutocompleteIndex = Math.min(
          this.activeAutocompleteIndex + 1,
          this.autocompleteVariables.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeAutocompleteIndex = Math.max(this.activeAutocompleteIndex - 1, 0);
        break;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        this.insertAutocompleteVariable(textareaElement);
        break;
      case 'Escape':
        event.preventDefault();
        this.hideAutocomplete();
        break;
    }
  }

  // Insert selected variable into textarea
  insertAutocompleteVariable(textareaElement: HTMLTextAreaElement): void {
    if (!this.showAutocomplete || this.autocompleteVariables.length === 0) return;

    const selectedVariable = this.autocompleteVariables[this.activeAutocompleteIndex];
    const currentValue = textareaElement.value;
    const cursorPosition = textareaElement.selectionStart;
    
    // Find the start of the current workflow variable being typed (now matches just "workflow.")
    const beforeCursor = currentValue.substring(0, cursorPosition);
    const match = beforeCursor.match(/workflow\.([^}\s]*)$/);
    
    if (match) {
      const matchStart = cursorPosition - match[0].length;
      // Automatically wrap in ${} when inserting
      const wrappedVariable = `\${${selectedVariable.path}}`;
      const newValue = 
        currentValue.substring(0, matchStart) + 
        wrappedVariable +
        currentValue.substring(cursorPosition);
      
      // Update the model and textarea
      const selectedNode = this.getSelectedNode();
      if (selectedNode?.data?.agentConfig) {
        selectedNode.data.agentConfig.instructions = newValue;
        this.nodeUpdate.emit(selectedNode);
      }
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        const newCursorPos = matchStart + wrappedVariable.length;
        textareaElement.setSelectionRange(newCursorPos, newCursorPos);
        textareaElement.focus();
      });
    }
    
    this.hideAutocomplete();
  }

  // Select autocomplete variable by clicking
  selectAutocompleteVariable(index: number, textareaElement: HTMLTextAreaElement): void {
    this.activeAutocompleteIndex = index;
    this.insertAutocompleteVariable(textareaElement);
  }

  // Hide autocomplete dropdown
  hideAutocomplete(): void {
    this.showAutocomplete = false;
    this.autocompleteVariables = [];
    this.activeAutocompleteIndex = 0;
  }
}