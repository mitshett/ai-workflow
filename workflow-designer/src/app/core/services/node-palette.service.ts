import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import type { NodeType } from '../models/node.models';

/**
 * Bridges the app shell navigation and the DesignerComponent.
 * The shell calls requestAdd(type) when a node item is clicked in the nav;
 * the DesignerComponent subscribes to addNode$ and creates the canvas node.
 */
@Injectable({ providedIn: 'root' })
export class NodePaletteService {
  private readonly addRequest$ = new Subject<NodeType>();

  /** Emits when a node should be added to the canvas. */
  readonly addNode$ = this.addRequest$.asObservable();

  /** Request adding a node of the given type to the canvas. */
  requestAdd(type: NodeType): void {
    this.addRequest$.next(type);
  }
}
