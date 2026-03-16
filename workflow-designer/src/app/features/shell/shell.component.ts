import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavigationComponent } from '@polarity/components/navigation';
import { HeaderComponent, HeaderUtilityButtonComponent } from '@polarity/components/header';
import { IconComponent } from '@polarity/components/icon';
import type {
  NavigationTopLevelItem,
  NavigationSwitcherConfig,
} from '@polarity/components/navigation';
import type { GeneralIcon } from '@polarity/components/icon';
import { ThemeService } from '../../core/services/theme.service';
import { WorkflowStore } from '../../core/services/workflow.store';
import { NodePaletteService } from '../../core/services/node-palette.service';
import { ShortcutsModalService } from '../designer/shortcuts-overlay.component';
import {
  NODE_TEMPLATES,
  type NodeCategory,
  type NodeType,
} from '../../core/models/node.models';

// ── Context type ────────────────────────────────────────────────────────────

type NavContext = 'designer' | 'forms' | 'library';

// ── Section definitions ─────────────────────────────────────────────────────

interface Section {
  key: NavContext;
  label: string;
  link: string;
  icon: 'nav-workflows' | 'nav-design' | 'nav-folders';
}

const SECTIONS: Section[] = [
  { key: 'designer', label: 'Workflow Designer', link: '/designer', icon: 'nav-workflows' },
  { key: 'forms',    label: 'Form Builder',     link: '/forms',    icon: 'nav-design' },
  { key: 'library',  label: 'Workflow Library',  link: '/library',  icon: 'nav-folders' },
];

// ── Node palette data ───────────────────────────────────────────────────────

interface PaletteNode {
  type: NodeType;
  label: string;
  icon: GeneralIcon;
  color: string;
}

interface PaletteCategory {
  name: NodeCategory;
  nodes: PaletteNode[];
}

const NODE_CATEGORIES: NodeCategory[] = ['Control Flow', 'AI', 'Integration'];

const PALETTE_CATEGORIES: PaletteCategory[] = NODE_CATEGORIES.map((cat) => ({
  name: cat,
  nodes: NODE_TEMPLATES
    .filter((t) => t.category === cat)
    .map((t) => ({ type: t.type, label: t.label, icon: t.icon as GeneralIcon, color: t.color })),
}));

// ── Shell Component ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    NavigationComponent,
    HeaderComponent,
    HeaderUtilityButtonComponent,
    IconComponent,
  ],
  template: `
    <header pol-header [name]="'AI Workflow'">
      <button
        pol-header-utility
        [icon]="'question'"
        [ariaLabel]="'Keyboard shortcuts'"
        (click)="shortcutsModal.toggle()"
      ></button>
      <button
        pol-header-utility
        [icon]="isDark() ? 'sun' : 'moon'"
        [ariaLabel]="isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
        (click)="onToggleTheme()"
      ></button>
    </header>

    <div class="shell-body">
      <div class="sidebar">
        <pol-navigation
          #nav
          aria-label="Main navigation"
          [items]="navItems"
          [variant]="'collapsible'"
          [switcherConfig]="switcherConfig()"
          [(collapsed)]="navCollapsed"
        >
          <div polNavigationSwitcherContent>
            <nav class="switcher-app-list">
              @for (section of sections; track section.key) {
                <a
                  class="switcher-app-item"
                  [class.switcher-app-item--active]="activeContext() === section.key"
                  (click)="onDrawerSectionClick(section, $event)"
                >
                  <span class="switcher-app-item__label">{{ section.label }}</span>
                  @if (activeContext() === section.key) {
                    <span class="switcher-app-item__check" aria-hidden="true">&#10003;</span>
                  }
                </a>
              }
            </nav>
          </div>
        </pol-navigation>

        @if (activeContext() === 'designer') {
          <aside class="node-palette">
            @for (category of paletteCategories; track category.name) {
              <div class="palette-category__label">{{ category.name }}</div>
              @for (node of category.nodes; track node.type) {
                <button class="palette-node" [style.--node-color]="node.color" (click)="onAddNode(node.type)">
                  <pol-icon [iconName]="node.icon" size="small" />
                  <span>{{ node.label }}</span>
                </button>
              }
            }
          </aside>
        }
      </div>

      <main class="shell-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .shell-body {
      display: flex;
      flex-direction: row;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      height: 100%;
      overflow: hidden;
      border-right: 1px solid var(--base-border-default);
      background: var(--base-bg-default);
    }

    /* Override pol-navigation's hardcoded height: calc(100vh - 56px)
       so it sizes to content and lets the node palette fill remaining space.
       Safe because pol-navigation uses ViewEncapsulation.None. */
    .sidebar .pol-navigation {
      height: auto;
      flex-shrink: 0;
    }

    .shell-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Switcher drawer content ─────────────────────────────────────────── */

    .switcher-app-list {
      display: flex;
      flex-direction: column;
      padding: 8px 0;
    }

    .switcher-app-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      gap: 8px;
      text-decoration: none;
      color: var(--base-text-default);
      border-radius: 6px;
      margin: 0 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 150ms ease;

      &:hover {
        background: var(--base-bg-hover);
      }

      &--active {
        background: var(--base-bg-selected);
        color: var(--base-text-emphasis);
      }
    }

    /* ── Node palette panel ──────────────────────────────────────────────── */

    .node-palette {
      flex: 1;
      overflow-y: auto;
      padding: 12px 0 16px;
    }

    .palette-category__label {
      padding: 20px 16px 6px 24px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--base-text-subtle);

      &:first-child {
        padding-top: 4px;
      }
    }

    .palette-node {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px 10px 24px;
      background: transparent;
      border: none;
      color: var(--base-text-default);
      font-size: 14px;
      cursor: pointer;
      text-align: left;

      &:hover {
        background: var(--base-bg-hover);
      }
    }

    .palette-node ::ng-deep pol-icon > svg > path {
      fill: var(--node-color);
    }
  `],
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly store = inject(WorkflowStore);
  private readonly nodePaletteService = inject(NodePaletteService);
  protected readonly shortcutsModal = inject(ShortcutsModalService);

  @ViewChild('nav') private navRef?: NavigationComponent;

  protected readonly isDark = signal(false);
  protected readonly navCollapsed = signal(false);
  protected readonly sections = SECTIONS;
  protected readonly paletteCategories = PALETTE_CATEGORIES;

  /** No nav items — the node palette is rendered as custom HTML instead. */
  protected readonly navItems: NavigationTopLevelItem[] = [];

  /**
   * Signal-based state machine for the navigation context.
   * Defaults to 'designer' — Workflow Designer with node palette sidebar.
   */
  protected readonly activeContext = signal<NavContext>('designer');

  // ── Computed signals ──────────────────────────────────────────────────────

  protected readonly switcherConfig = computed<NavigationSwitcherConfig>(() => {
    const ctx = this.activeContext();
    switch (ctx) {
      case 'designer':
        return { icon: 'nav-workflows', label: 'Home', name: 'Workflow Designer', drawerLabel: 'Applications' };
      case 'forms':
        return { icon: 'nav-design', label: 'Home', name: 'Form Builder', drawerLabel: 'Applications' };
      case 'library':
        return { icon: 'nav-folders', label: 'Home', name: 'Workflow Library', drawerLabel: 'Applications' };
    }
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    const storedTheme = this.store.theme();
    this.isDark.set(storedTheme === 'magnetic-dark');

    // Sync activeContext with the current URL on initial load
    const url = this.router.url;
    const match = SECTIONS.find((s) => url.startsWith(s.link));
    if (match) {
      this.activeContext.set(match.key);
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  /**
   * Drawer section click — sets the context and navigates to that section's route.
   */
  protected onDrawerSectionClick(section: Section, event: Event): void {
    event.preventDefault();
    this.activeContext.set(section.key);
    this.router.navigateByUrl(section.link);
    this.navRef?.close();
  }

  protected onToggleTheme(): void {
    this.themeService.toggle();
    this.isDark.set(this.store.theme() === 'magnetic-dark');
  }

  /**
   * Add a node to the canvas via NodePaletteService.
   * Called directly from palette button clicks — no DOM scraping needed.
   */
  protected onAddNode(type: NodeType): void {
    this.nodePaletteService.requestAdd(type);
  }
}
