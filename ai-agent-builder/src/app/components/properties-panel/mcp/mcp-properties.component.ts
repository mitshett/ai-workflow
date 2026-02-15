import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Polarity Components
import { ButtonComponent } from '@polarity/components/button';
import { IconComponent } from '@polarity/components/icon';
import { InputTextComponent } from '@polarity/components/input-text';
import { SelectComponent, SelectItem, SelectValue } from '@polarity/components/select';
// import { SwitchComponent } from '@polarity/components/switch'; // Not available, will use checkbox for now

// Services
import { WorkflowExecutionService, MCPToolSchema } from '../../../services/workflow-execution.service';

// Models
import { WorkflowNode, MCPConfig } from '../../../models/workflow.models';
import { BaseNodePropertiesComponent } from '../shared/base-node-properties.component';
import { AliasSectionComponent } from '../shared/alias-section.component';

@Component({
  selector: 'app-mcp-properties',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    SelectComponent,
    AliasSectionComponent
  ],
  templateUrl: './mcp-properties.component.html',
  styleUrl: './mcp-properties.component.scss'
})
export class MCPPropertiesComponent extends BaseNodePropertiesComponent {
  
  // ===============================
  // INJECTED SERVICES
  // ===============================
  
  constructor(private workflowService: WorkflowExecutionService) {
    super();
  }

  // ===============================
  // CACHED VALUES FOR MCP
  // ===============================
  
  cachedMCPToolArguments: Array<{key: string, value: string}> = [];
  cachedMCPHeaders: Array<{key: string, value: string}> = [];
  cachedMCPContextData: Array<{key: string, value: string}> = [];

  // ===============================
  // TOOL DISCOVERY STATE
  // ===============================
  
  discoveredTools: MCPToolSchema[] = [];
  isDiscoveringTools = false;
  discoveryError: string | null = null;
  discoverySuccess = false;

  // Tool dropdown options (built from discovered tools)
  toolOptions: SelectItem[] = [];

  // Output format dropdown options
  readonly outputFormatOptions: SelectItem[] = [
    { value: 'json', label: 'JSON' },
    { value: 'text', label: 'Text' },
    { value: 'auto', label: 'Auto' }
  ];

  // ===============================
  // MANAGEMENT MODAL STATE
  // ===============================
  
  showHeadersManager = false;
  showArgumentsManager = false;
  showContextDataManager = false;
  
  // Temporary arrays for bulk editing (before save)
  tempHeaders: Array<{key: string, value: string}> = [];
  tempArguments: Array<{key: string, value: string}> = [];
  tempContextData: Array<{key: string, value: string}> = [];

  // ===============================
  // POLARITY SELECT OPTIONS
  // ===============================

  readonly serverTypeOptions: SelectItem[] = [
    { value: 'http', label: 'HTTP' },
    { value: 'streamable-http', label: 'Streamable HTTP' },
    { value: 'stdio', label: 'Stdio' }
  ];

  readonly llmProviderOptions: SelectItem[] = [
    { value: 'azure_openai', label: 'Azure OpenAI' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' }
  ];

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

  // ===============================
  // AUTOCOMPLETE STATE FOR USER PROMPT
  // ===============================
  
  showAutocomplete = false;
  autocompleteVariables: { path: string; type: string; description?: string }[] = [];
  autocompletePosition = { top: 0, left: 0 };
  activeAutocompleteIndex = 0;

  // ===============================
  // OVERRIDE NGONCHANGES TO INCLUDE MCP CACHING
  // ===============================

  override ngOnChanges(changes: any): void {
    super.ngOnChanges(changes);
    
    // Update MCP-specific cached values
    if (changes['selectedNodeId'] || changes['canvasNodes']) {
      this.updateCachedMCPToolArguments();
      this.updateCachedMCPHeaders();
      this.updateCachedMCPContextData();
      this.restoreCachedTools();
    }
  }

  // ===============================
  // NODE DATA INITIALIZATION
  // ===============================

  // Initialize MCP data structure if it doesn't exist
  protected initializeNodeData(node: WorkflowNode): void {
    if (node.type !== 'mcp') return;
    
    if (!node.data) {
      node.data = {};
    }
    if (!node.data.mcpConfig) {
      node.data.mcpConfig = {
        name: node.label,
        description: '',
        server: {
          type: 'streamable-http',
          url: 'http://host.docker.internal:8182/mcp/',
          headers: {
            'Accept': 'application/json, text/event-stream'
          },
          timeout: 30
        },
        smart_mcp_enabled: false,
        
        // Regular MCP defaults
        toolName: '',
        toolArguments: {},
        tool_arguments: {},
        output_format: 'json',
        
        // Smart MCP defaults
        llm_config: {
          provider: 'azure_openai',
          model: 'gpt-35-turbo',
          temperature: 0.1,
          max_tokens: 800
        },
        user_prompt: '',
        context_data: {},
        
        timeout: 60
      };
    }
    
    // Ensure smart_mcp_enabled exists with default value
    if (typeof node.data.mcpConfig.smart_mcp_enabled === 'undefined') {
      node.data.mcpConfig.smart_mcp_enabled = false;
    }
    
    // Ensure server headers object exists
    if (!node.data.mcpConfig.server.headers) {
      node.data.mcpConfig.server.headers = {};
    }
    
    // Ensure LLM config exists
    if (!node.data.mcpConfig.llm_config) {
      node.data.mcpConfig.llm_config = {
        provider: 'azure_openai',
        model: 'gpt-35-turbo',
        temperature: 0.1,
        max_tokens: 800
      };
    }
    
    // Ensure context_data exists
    if (!node.data.mcpConfig.context_data) {
      node.data.mcpConfig.context_data = {};
    }
    
    // Set appropriate timeout based on Smart MCP mode
    if (node.data.mcpConfig.smart_mcp_enabled) {
      node.data.mcpConfig.timeout = 120;
    } else {
      node.data.mcpConfig.timeout = 60;
    }
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

  private updateCachedMCPHeaders(): void {
    if (!this.cachedSelectedNode?.data?.mcpConfig?.server?.headers) {
      this.cachedMCPHeaders = [];
      return;
    }
    
    const headers = this.cachedSelectedNode.data.mcpConfig.server.headers;
    this.cachedMCPHeaders = Object.entries(headers).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }

  private updateCachedMCPContextData(): void {
    if (!this.cachedSelectedNode?.data?.mcpConfig?.context_data) {
      this.cachedMCPContextData = [];
      return;
    }
    
    const contextData = this.cachedSelectedNode.data.mcpConfig.context_data;
    this.cachedMCPContextData = Object.entries(contextData).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }

  // Restore tool dropdown from previously cached availableTools on the node
  private restoreCachedTools(): void {
    const node = this.cachedSelectedNode;
    if (!node?.data?.mcpConfig?.availableTools?.length) {
      this.discoveredTools = [];
      this.toolOptions = [];
      this.discoverySuccess = false;
      this.discoveryError = null;
      return;
    }

    const cachedTools = node.data.mcpConfig.availableTools;
    this.discoveredTools = cachedTools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: { type: 'object', properties: t.arguments }
    }));
    this.toolOptions = cachedTools.map(t => ({
      value: t.name,
      label: t.name + (t.description ? ` - ${t.description.substring(0, 40)}` : '')
    }));
    this.discoverySuccess = true;
    this.discoveryError = null;
  }

  // ===============================
  // MCP CONFIGURATION METHODS
  // ===============================

  // MCP name change handler - sync with canvas node label  
  onMCPNameChange(newName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
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

  // Get MCP headers as array for template iteration
  getMCPHeadersArray(): Array<{key: string, value: string}> {
    return this.cachedMCPHeaders;
  }

  // Handle MCP argument key change
  onMCPArgumentKeyChange(event: Event, oldKey: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newKey = (event.target as HTMLInputElement).value;
    if (newKey === oldKey) return;

    this.initializeNodeData(selectedNode);
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
    
    this.initializeNodeData(selectedNode);
    selectedNode.data!.mcpConfig!.toolArguments![key] = newValue;
    
    console.log('MCP argument value changed:', { key, newValue });
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Open Arguments Manager
  openArgumentsManager(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Copy current arguments to temp array for editing
    this.tempArguments = this.getMCPToolArgumentsArray().map(arg => ({
      key: arg.key,
      value: arg.value
    }));
    
    // If no arguments exist, add one empty row to start with
    if (this.tempArguments.length === 0) {
      this.tempArguments.push({ key: '', value: '' });
    }
    
    this.showArgumentsManager = true;
  }

  // Save Arguments from Manager
  saveArguments(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Convert temp array back to object, filtering out empty keys
    const toolArguments: { [key: string]: string } = {};
    this.tempArguments.forEach(arg => {
      if (arg.key.trim()) {
        toolArguments[arg.key.trim()] = arg.value;
      }
    });
    
    selectedNode.data!.mcpConfig!.toolArguments = toolArguments;
    selectedNode.data!.mcpConfig!.tool_arguments = toolArguments;
    console.log('Saved MCP arguments:', toolArguments);
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
    
    // Close manager
    this.showArgumentsManager = false;
  }

  // Cancel Arguments Manager
  cancelArguments(): void {
    this.showArgumentsManager = false;
    this.tempArguments = [];
  }

  // Add Argument Row in Manager
  addArgumentRow(): void {
    this.tempArguments.push({ key: '', value: '' });
  }

  // Remove Argument Row in Manager
  removeArgumentRow(index: number): void {
    this.tempArguments.splice(index, 1);
    
    // Ensure at least one empty row exists
    if (this.tempArguments.length === 0) {
      this.tempArguments.push({ key: '', value: '' });
    }
  }

  // Remove MCP tool argument
  removeMCPToolArgument(key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    delete selectedNode.data!.mcpConfig!.toolArguments![key];
    
    console.log('Removed MCP tool argument:', key);
    
    // Update cached MCP tool arguments
    this.updateCachedMCPToolArguments();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Handle MCP header key change
  onMCPHeaderKeyChange(event: Event, oldKey: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newKey = (event.target as HTMLInputElement).value;
    if (newKey === oldKey) return;

    this.initializeNodeData(selectedNode);
    const headers = selectedNode.data!.mcpConfig!.server.headers!;
    
    // Update the key
    const value = headers[oldKey];
    delete headers[oldKey];
    headers[newKey] = value;
    
    console.log('MCP header key changed:', { oldKey, newKey });
    
    // Update cached MCP headers
    this.updateCachedMCPHeaders();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Handle MCP header value change
  onMCPHeaderValueChange(event: Event, key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    const newValue = (event.target as HTMLInputElement).value;
    
    this.initializeNodeData(selectedNode);
    selectedNode.data!.mcpConfig!.server.headers![key] = newValue;
    
    console.log('MCP header value changed:', { key, newValue });
    
    // Update cached MCP headers
    this.updateCachedMCPHeaders();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Open Headers Manager
  openHeadersManager(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Copy current headers to temp array for editing
    this.tempHeaders = this.getMCPHeadersArray().map(header => ({
      key: header.key,
      value: header.value
    }));
    
    // If no headers exist, add one empty row to start with
    if (this.tempHeaders.length === 0) {
      this.tempHeaders.push({ key: '', value: '' });
    }
    
    this.showHeadersManager = true;
  }

  // Save Headers from Manager
  saveHeaders(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Convert temp array back to object, filtering out empty keys
    const headers: { [key: string]: string } = {};
    this.tempHeaders.forEach(header => {
      if (header.key.trim()) {
        headers[header.key.trim()] = header.value;
      }
    });
    
    selectedNode.data!.mcpConfig!.server.headers = headers;
    console.log('Saved MCP headers:', headers);
    
    // Update cached MCP headers
    this.updateCachedMCPHeaders();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
    
    // Close manager
    this.showHeadersManager = false;
  }

  // Cancel Headers Manager
  cancelHeaders(): void {
    this.showHeadersManager = false;
    this.tempHeaders = [];
  }

  // Add Header Row in Manager
  addHeaderRow(): void {
    this.tempHeaders.push({ key: '', value: '' });
  }

  // Remove Header Row in Manager
  removeHeaderRow(index: number): void {
    this.tempHeaders.splice(index, 1);
    
    // Ensure at least one empty row exists
    if (this.tempHeaders.length === 0) {
      this.tempHeaders.push({ key: '', value: '' });
    }
  }

  // Remove MCP header
  removeMCPHeader(key: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    delete selectedNode.data!.mcpConfig!.server.headers![key];
    
    console.log('Removed MCP header:', key);
    
    // Update cached MCP headers
    this.updateCachedMCPHeaders();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // ===============================
  // SMART MCP METHODS
  // ===============================

  // Smart MCP toggle handler
  onSmartMCPToggle(enabled: boolean): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    selectedNode.data!.mcpConfig!.smart_mcp_enabled = enabled;
    
    // Update timeout based on Smart MCP mode
    selectedNode.data!.mcpConfig!.timeout = enabled ? 120 : 60;
    
    console.log('Smart MCP toggled:', { enabled, timeout: selectedNode.data!.mcpConfig!.timeout });
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
  }

  // Get MCP context data as array for template iteration
  getMCPContextDataArray(): Array<{key: string, value: string}> {
    return this.cachedMCPContextData;
  }

  // Handle input in user prompt textarea
  onUserPromptInput(event: Event, textareaElement: HTMLTextAreaElement): void {
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
    // Force refresh variable cache to ensure we have the latest variables
    this.refreshVariableCache();
    
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
    const left = rect.left - 300;
    const top = rect.top;
    const finalLeft = Math.max(20, left);
    const finalTop = Math.max(80, top);
    this.autocompletePosition = { top: finalTop, left: finalLeft };
  }

  // Handle keyboard navigation in autocomplete
  onUserPromptKeydown(event: KeyboardEvent, textareaElement: HTMLTextAreaElement): void {
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
    
    const beforeCursor = currentValue.substring(0, cursorPosition);
    const match = beforeCursor.match(/workflow\.([^}\s]*)$/);
    
    if (match) {
      const matchStart = cursorPosition - match[0].length;
      const wrappedVariable = `\${${selectedVariable.path}}`;
      const newValue = 
        currentValue.substring(0, matchStart) + 
        wrappedVariable +
        currentValue.substring(cursorPosition);
      
      const selectedNode = this.getSelectedNode();
      if (selectedNode?.data?.mcpConfig) {
        selectedNode.data.mcpConfig.user_prompt = newValue;
        this.nodeUpdate.emit(selectedNode);
      }
      
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

  // ===============================
  // CONTEXT DATA MANAGEMENT METHODS
  // ===============================

  // Open Context Data Manager
  openContextDataManager(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Copy current context data to temp array for editing
    this.tempContextData = this.getMCPContextDataArray().map(data => ({
      key: data.key,
      value: data.value
    }));
    
    // If no context data exists, add one empty row to start with
    if (this.tempContextData.length === 0) {
      this.tempContextData.push({ key: '', value: '' });
    }
    
    this.showContextDataManager = true;
  }

  // Save Context Data from Manager
  saveContextData(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    
    // Convert temp array back to object, filtering out empty keys
    const contextData: { [key: string]: string } = {};
    this.tempContextData.forEach(data => {
      if (data.key.trim()) {
        contextData[data.key.trim()] = data.value;
      }
    });
    
    selectedNode.data!.mcpConfig!.context_data = contextData;
    console.log('Saved MCP context data:', contextData);
    
    // Update cached MCP context data
    this.updateCachedMCPContextData();
    
    // Emit node update
    this.nodeUpdate.emit(selectedNode);
    
    // Close manager
    this.showContextDataManager = false;
  }

  // Cancel Context Data Manager
  cancelContextData(): void {
    this.showContextDataManager = false;
    this.tempContextData = [];
  }

  // Add Context Data Row in Manager
  addContextDataRow(): void {
    this.tempContextData.push({ key: '', value: '' });
  }

  // Remove Context Data Row in Manager
  removeContextDataRow(index: number): void {
    this.tempContextData.splice(index, 1);
    
    // Ensure at least one empty row exists
    if (this.tempContextData.length === 0) {
      this.tempContextData.push({ key: '', value: '' });
    }
  }

  // Fetch tools from MCP server
  fetchTools(): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    const mcpConfig = selectedNode.data!.mcpConfig!;
    const serverUrl = mcpConfig.server.url;

    if (!serverUrl) {
      this.discoveryError = 'Please enter a server URL first';
      return;
    }

    // Reset state
    this.isDiscoveringTools = true;
    this.discoveryError = null;
    this.discoverySuccess = false;

    console.log('Fetching tools from MCP server:', serverUrl);

    this.workflowService.discoverTools({
      server_url: serverUrl,
      server_type: mcpConfig.server.type || 'streamable-http',
      headers: mcpConfig.server.headers || {},
      timeout: mcpConfig.server.timeout || 30
    }).subscribe({
      next: (response) => {
        this.isDiscoveringTools = false;
        
        if (response.success && response.tools.length > 0) {
          this.discoveredTools = response.tools;
          this.discoverySuccess = true;
          
          // Build tool dropdown options
          this.toolOptions = response.tools.map(tool => ({
            value: tool.name,
            label: tool.name + (tool.description ? ` - ${tool.description.substring(0, 40)}` : '')
          }));

          // Cache tools on the node for later use
          mcpConfig.availableTools = response.tools.map(tool => ({
            name: tool.name,
            description: tool.description || '',
            arguments: tool.input_schema?.properties || {},
            enabled: true
          }));

          // If current toolName matches a discovered tool, auto-select it
          if (mcpConfig.toolName && this.discoveredTools.find(t => t.name === mcpConfig.toolName)) {
            // Tool already selected and valid, keep it
          } else if (this.discoveredTools.length === 1) {
            // Auto-select if only one tool
            this.selectTool(this.discoveredTools[0].name);
          }

          console.log(`Discovered ${response.tools.length} tools from ${serverUrl}`);
          this.nodeUpdate.emit(selectedNode);
        } else {
          this.discoveryError = response.error || 'No tools found on this server';
          this.discoveredTools = [];
          this.toolOptions = [];
        }
      },
      error: (error) => {
        this.isDiscoveringTools = false;
        this.discoveryError = typeof error === 'string' ? error : 'Failed to connect to MCP server';
        this.discoveredTools = [];
        this.toolOptions = [];
        console.error('Tool discovery failed:', error);
      }
    });
  }

  // Handle tool selection from dropdown
  onToolSelected(value?: SelectValue): void {
    if (!value) return;
    const toolName = typeof value === 'string' ? value : String(value);
    this.selectTool(toolName);
  }

  // Select a tool and auto-populate arguments from its inputSchema
  private selectTool(toolName: string): void {
    const selectedNode = this.getSelectedNode();
    if (!selectedNode || selectedNode.type !== 'mcp') return;

    this.initializeNodeData(selectedNode);
    const mcpConfig = selectedNode.data!.mcpConfig!;
    
    // Set tool name
    mcpConfig.toolName = toolName;

    // Find the tool's schema
    const tool = this.discoveredTools.find(t => t.name === toolName);
    if (!tool || !tool.input_schema) {
      this.nodeUpdate.emit(selectedNode);
      this.updateCachedMCPToolArguments();
      return;
    }

    // Auto-populate arguments from inputSchema
    const properties = tool.input_schema.properties || {};
    const required = tool.input_schema.required || [];
    const newArguments: { [key: string]: string } = {};

    for (const [key, schema] of Object.entries(properties)) {
      // Set empty string as default — user fills in real values
      // Use existing value if the argument was already configured
      const existingValue = mcpConfig.toolArguments?.[key] || mcpConfig.tool_arguments?.[key];
      newArguments[key] = existingValue !== undefined ? String(existingValue) : '';
    }

    mcpConfig.toolArguments = newArguments;
    mcpConfig.tool_arguments = newArguments;

    // Set output format to json by default
    if (!mcpConfig.output_format) {
      mcpConfig.output_format = 'json';
    }

    console.log('Tool selected:', toolName, 'Arguments auto-populated:', Object.keys(newArguments));

    // Update cached values and emit
    this.updateCachedMCPToolArguments();
    this.nodeUpdate.emit(selectedNode);
  }

  // Get the selected tool's schema for displaying argument hints
  getToolArgumentSchema(argName: string): { type?: string; description?: string; required: boolean } | null {
    const selectedNode = this.getSelectedNode();
    const toolName = selectedNode?.data?.mcpConfig?.toolName;
    if (!toolName) return null;

    const tool = this.discoveredTools.find(t => t.name === toolName);
    if (!tool?.input_schema?.properties?.[argName]) return null;

    const schema = tool.input_schema.properties[argName];
    const required = tool.input_schema.required || [];
    return {
      type: schema.type,
      description: schema.description,
      required: required.includes(argName)
    };
  }
}