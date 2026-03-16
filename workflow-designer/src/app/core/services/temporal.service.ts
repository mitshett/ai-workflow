import { Injectable, inject } from '@angular/core';
import { HttpClient, type HttpErrorResponse } from '@angular/common/http';
import { type Observable, catchError, throwError } from 'rxjs';
import type {
  WorkflowExecuteRequest,
  ExecuteResponse,
  StatusResponse,
  ApprovalResponse,
  ChatMessage,
  WorkflowChatContext,
  ChatResponse,
} from '../models/execution.models';

export interface HealthResponse {
  status: string;
  service: string;
  temporal_connected: boolean;
  timestamp: string;
}

export interface McpToolInfo {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface McpToolsResponse {
  tools: McpToolInfo[];
  server_url: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class TemporalService {
  private readonly http = inject(HttpClient);
  private readonly BASE = 'http://localhost:8090';

  /**
   * Start a workflow execution.
   * Returns an Observable that emits the execute response on success.
   */
  execute(payload: WorkflowExecuteRequest): Observable<ExecuteResponse> {
    return this.http
      .post<ExecuteResponse>(`${this.BASE}/api/v1/workflows/execute`, payload)
      .pipe(catchError(this.handleError));
  }

  /**
   * Poll the status of a running workflow.
   */
  getStatus(runId: string): Observable<StatusResponse> {
    return this.http
      .get<StatusResponse>(`${this.BASE}/api/v1/workflows/${runId}/status`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Approve a paused approval node.
   */
  approve(runId: string, nodeId: string): Observable<ApprovalResponse> {
    return this.http
      .post<ApprovalResponse>(
        `${this.BASE}/api/v1/workflows/${runId}/approve/${nodeId}`,
        {},
      )
      .pipe(catchError(this.handleError));
  }

  /**
   * Health check — confirms Temporal connectivity.
   */
  health(): Observable<HealthResponse> {
    return this.http
      .get<HealthResponse>(`${this.BASE}/api/v1/health`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Fetch the list of tools exposed by an MCP server.
   * Resolves well-known aliases (cisco, jira) on the backend.
   */
  getMcpTools(serverUrl: string): Observable<McpToolsResponse> {
    const params = { server_url: serverUrl };
    return this.http
      .get<McpToolsResponse>(`${this.BASE}/api/v1/mcp/tools`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Ask a question about a completed workflow run.
   * Sends the full conversation history + workflow context to the backend.
   */
  chat(messages: ChatMessage[], context: WorkflowChatContext): Observable<ChatResponse> {
    return this.http
      .post<ChatResponse>(`${this.BASE}/api/v1/chat`, { messages, context })
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const message =
      err.error?.detail ?? err.error?.message ?? err.message ?? 'Unknown error';
    return throwError(
      () => new Error(`[TemporalService] ${err.status}: ${message}`),
    );
  }
}
