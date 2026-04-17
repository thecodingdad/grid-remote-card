/**
 * GridRemoteCard — top-level card.
 *
 * Handles grid layout, multi-page navigation, swipe gestures, preset
 * loading and popup overlay rendering. Each item type is implemented
 * as its own custom element under `./items/` and rendered via a type
 * → tag lookup in `_renderItem()`.
 */

import { LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import type { GridRemoteCardConfig, HomeAssistant, Item, PageCondition } from './types';
import { DEFAULT_ITEMS } from './presets';
import { checkConditionsMet, collectConditionEntities } from './helpers';
import { resolveColor } from './helpers';
import { cardStyles } from './styles';
import { ITEMS } from './items';
import {
  OPEN_SOURCE_POPUP_EVENT,
  openSourcePopup,
  renderSourcePopup,
  type OpenSourcePopupDetail,
} from './items/source';
import {
  OPEN_NUMPAD_POPUP_EVENT,
  openNumpadPopup,
  renderNumpadPopup,
  type OpenNumpadPopupDetail,
} from './items/numbers';

interface SwipeState {
  startX: number;
  startY: number;
  dx: number;
  swiping: boolean;
}

export class GridRemoteCard extends LitElement {
  static get properties() {
    return {
      hass:                { attribute: false },
      _config:             { state: true },
      _sourcePopupOpen:    { state: true },
      _numpadPopupOpen:    { state: true },
      _sourcePopupItemIdx: { state: true },
      _numpadPopupItemIdx: { state: true },
      _currentPage:        { state: true },
    };
  }

  static styles = cardStyles;

  // Reactive properties
  hass!: HomeAssistant;
  _config!: GridRemoteCardConfig;
  _sourcePopupOpen = false;
  _numpadPopupOpen = false;
  _sourcePopupItemIdx: number | null = null;
  _popupAnchorEl: HTMLElement | null = null;
  _numpadPopupItemIdx: number | null = null;
  _currentPage = 0;

  // Internal (non-reactive) state
  private _swipeState: SwipeState | null = null;
  private _isEditorPreview = false;
  private _editorDetected = false;
  private _popupOutsideListenerActive = false;
  private _gridCols = 0;

  static getConfigElement() {
    return document.createElement('grid-remote-card-editor');
  }

  static getStubConfig(): GridRemoteCardConfig {
    return {
      type: 'custom:grid-remote-card',
      columns: 3,
      rows: 9,
      items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
    };
  }

  constructor() {
    super();
    this._config = {} as GridRemoteCardConfig;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(OPEN_SOURCE_POPUP_EVENT, this._onOpenSourcePopup as EventListener);
    this.addEventListener(OPEN_NUMPAD_POPUP_EVENT, this._onOpenNumpadPopup as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener(OPEN_SOURCE_POPUP_EVENT, this._onOpenSourcePopup as EventListener);
    this.removeEventListener(OPEN_NUMPAD_POPUP_EVENT, this._onOpenNumpadPopup as EventListener);
    if (this._popupOutsideListenerActive) {
      this._popupOutsideListenerActive = false;
      window.removeEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }

  private _onOpenSourcePopup = (e: CustomEvent<OpenSourcePopupDetail>): void => {
    // Toggle: if the same popup is already open, close it instead of re-opening
    if (this._sourcePopupOpen && this._sourcePopupItemIdx === e.detail.itemIndex) {
      this._sourcePopupOpen = false;
      this._popupAnchorEl = null;
      this._removePopupOutsideListener();
      return;
    }
    openSourcePopup(this, e.detail.itemIndex, e.detail.anchorEl);
  };

  private _onOpenNumpadPopup = (e: CustomEvent<OpenNumpadPopupDetail>): void => {
    if (this._numpadPopupOpen && this._numpadPopupItemIdx === e.detail.itemIndex) {
      this._numpadPopupOpen = false;
      this._popupAnchorEl = null;
      this._removePopupOutsideListener();
      return;
    }
    openNumpadPopup(this, e.detail.itemIndex, e.detail.anchorEl);
  };

  /** Config items with fallback to empty array */
  get _items(): Item[] { return this._config?.items || []; }

  get _pageCount(): number { return Math.max(this._config?.page_count || 1, 1); }

  _getState(entityId: string | undefined | null) {
    return entityId && this.hass ? this.hass.states[entityId] : null;
  }

  setConfig(config: GridRemoteCardConfig) {
    if (!config) throw new Error('Grid Remote Card: Configuration missing');
    if (config.items != null && !Array.isArray(config.items))
      throw new Error('Grid Remote Card: "items" must be an array');
    if (config.columns != null && (typeof config.columns !== 'number' || config.columns < 1))
      throw new Error('Grid Remote Card: "columns" must be a positive number');
    if (config.rows != null && (typeof config.rows !== 'number' || config.rows < 1))
      throw new Error('Grid Remote Card: "rows" must be a positive number');
    if (config.scale != null && (typeof config.scale !== 'number' || config.scale < 10))
      throw new Error('Grid Remote Card: "scale" must be a number >= 10');
    const { _editor_page, ...cleanConfig } = config;
    this._config = cleanConfig as GridRemoteCardConfig;
    if (_editor_page != null) {
      this._currentPage = _editor_page;
      this._isEditorPreview = true;
    }
    const maxPage = Math.max((config.page_count || 1) - 1, 0);
    if (this._currentPage > maxPage) this._currentPage = maxPage;
  }

  getCardSize(): number {
    return this._config.rows || 9;
  }

  getGridOptions() {
    const rows = this._config?.rows || 1;
    const cols = this._config?.columns || 1;
    const scale = (this._config?.scale || 100) / 100;

    const style = getComputedStyle(this);
    const cellW = parseInt(style.getPropertyValue('--grid-cell-width')) || 50;
    const cellH = parseInt(style.getPropertyValue('--grid-cell-height')) || 50;
    const gap = parseInt(style.getPropertyValue('--grid-gap')) || 10;
    const padding = parseInt(style.getPropertyValue('--remote-padding')) || 15;
    const border = parseInt(style.getPropertyValue('--ha-card-border-width')) || 1;
    const multiPage = this._pageCount > 1;
    const dotsHeight = multiPage ? 28 : 0;

    const cardWidth = (cols * cellW + (cols - 1) * gap + 2 * padding + 2 * border) * scale;
    const remoteHeight = (rows * cellH + (rows - 1) * gap + 2 * padding + dotsHeight) * scale;

    // Section grid: 12 columns per section, gap and max-width from CSS vars
    const SEC_COLS = 12;
    const colGap = parseInt(style.getPropertyValue('--column-gap')) || 8;
    const colMaxWidth = parseInt(style.getPropertyValue('--column-max-width')) || 500;
    const secColWidth = (colMaxWidth - (SEC_COLS - 1) * colGap) / SEC_COLS;
    const neededCols = Math.ceil((cardWidth + colGap) / (secColWidth + colGap));

    const rowHeight = parseInt(style.getPropertyValue('--row-height')) || 56;
    const rowGap = parseInt(style.getPropertyValue('--row-gap')) || 8;
    const neededRows = Math.ceil((remoteHeight + rowGap) / (rowHeight + rowGap));

    this._gridCols = Math.max(this._gridCols || 0, neededCols);

    return {
      rows: 1,
      columns: 1,
      min_rows: neededRows,
      min_columns: neededCols,
    };
  }

  get _trackedEntities(): Set<string> {
    const ids = new Set<string>();
    for (const item of this._items) {
      if (item.entity_id) ids.add(item.entity_id);
      if (item.source_entity) ids.add(item.source_entity);
    }
    const conds = this._config?.page_conditions;
    if (conds) {
      for (const c of conds) {
        if (Array.isArray(c)) {
          for (const sub of c) collectConditionEntities(sub, ids);
        }
      }
    }
    return ids;
  }

  shouldUpdate(changedProps: PropertyValues): boolean {
    if (!changedProps.has('hass') || changedProps.size > 1) return true;
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (!oldHass) return true;
    const tracked = this._trackedEntities;
    if (tracked.size === 0 && !this._sourcePopupOpen) return false;
    for (const eid of tracked) {
      if (oldHass.states[eid] !== this.hass.states[eid]) return true;
    }
    return false;
  }

  _evaluatePageConditions(): number {
    const conds = this._config?.page_conditions;
    if (!conds || !this.hass) return -1;
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i] as PageCondition[] | undefined;
      if (!Array.isArray(c) || c.length === 0) continue;
      if (checkConditionsMet(c, this.hass)) return i;
    }
    return -1;
  }

  // -- Render -----------------------------------------------------------------

  render(): TemplateResult {
    if (!this._config) return html``;
    const cols = this._config.columns || 3;
    const scale = (this._config.scale || 100) / 100;
    const stretch = this._config.sizing === 'stretch';
    const sizeStyle = stretch ? 'width:100%;height:100%;' : '';
    const zoomStyle = scale !== 1 ? `zoom:${scale};` : '';
    const rows = this._config.rows || 9;
    const gridStyle = `grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);`;
    const multiPage = this._pageCount > 1;
    const multiPageWidth = multiPage && !stretch
      ? `width:calc(${cols} * var(--grid-cell-width) + ${cols - 1} * var(--grid-gap) + 2 * var(--remote-padding) + 2 * var(--ha-card-border-width, 1px));`
      : '';
    const cardBg = resolveColor(this._config.card_background_color || '');
    const cardBgStyle = cardBg ? `background:${cardBg};` : '';
    const cardStyle = `${sizeStyle}${zoomStyle}${multiPageWidth}${cardBgStyle}`;

    if (!multiPage) {
      return html`
        <ha-card style="${cardStyle}">
          <div class="remote-grid" style="${gridStyle}">
            ${this._items.map((item, i) => this._renderItem(item, i))}
            ${renderSourcePopup(this)}
            ${renderNumpadPopup(this)}
          </div>
        </ha-card>
      `;
    }

    const swipeDx = this._swipeState?.dx || 0;
    const swiping = this._swipeState?.swiping || false;
    const trackTransform = swiping
      ? `transform:translateX(calc(${-this._currentPage * 100}% + ${swipeDx}px));transition:none;`
      : `transform:translateX(${-this._currentPage * 100}%);`;

    const pages: TemplateResult[] = [];
    for (let p = 0; p < this._pageCount; p++) {
      const items = this._items.map((item, i): [Item, number] => [item, i]).filter(([item]) => (item.page || 0) === p);
      pages.push(html`
        <div class="remote-grid" style="${gridStyle}">
          ${items.map(([item, i]) => this._renderItem(item, i))}
          ${p === this._currentPage ? html`${renderSourcePopup(this)}${renderNumpadPopup(this)}` : ''}
        </div>
      `);
    }

    return html`
      <ha-card style="${cardStyle}">
        <div class="page-container"
             @touchstart=${this._onSwipeStart}
             @touchmove=${this._onSwipeMove}
             @touchend=${this._onSwipeEnd}>
          <div class="page-track" style="${trackTransform}">
            ${pages}
          </div>
        </div>
        ${this._renderPageDots()}
      </ha-card>
    `;
  }

  _renderPageDots(): TemplateResult {
    const dots: TemplateResult[] = [];
    const conds = this._config?.page_conditions;
    for (let i = 0; i < this._pageCount; i++) {
      const hasCond = (conds?.[i]?.length ?? 0) > 0;
      dots.push(html`
        <button class="page-dot ${i === this._currentPage ? 'active' : ''} ${hasCond ? 'conditional' : ''}"
                @click=${() => { this._currentPage = i; }}></button>
      `);
    }
    return html`<div class="page-dots">${dots}</div>`;
  }

  /** Render an item by looking up its tag name and wrapper class from
   *  the ITEMS registry. Uses `unsafeStatic` for the dynamic tag name
   *  (this is the official Lit pattern for computed tag names). */
  private _renderItem(item: Item, index: number): TemplateResult {
    if (!item?.type) return html``;
    const meta = ITEMS[item.type];
    if (!meta) return html``;
    const size = meta.cls.getSize(item);
    const gs = `grid-row:${item.row + 1}/span ${size.rows};grid-column:${item.col + 1}/span ${size.cols};`;
    const tag = unsafeStatic(meta.tagName);
    return html`<div class="${meta.cls.wrapperClass}" style="${gs}"><${tag} .hass=${this.hass} .item=${item} .index=${index} .card=${this}></${tag}></div>`;
  }

  // -- Swipe gestures ---------------------------------------------------------

  private _onSwipeStart = (e: TouchEvent) => {
    if (this._pageCount <= 1) return;
    if (e.touches.length !== 1) return;
    const target = e.target as Element | null;
    if (target?.closest?.('.slider-wrapper') || e.composedPath().some((el: any) => el.classList?.contains('slider-wrapper'))) return;
    this._swipeState = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, swiping: false };
  };

  private _onSwipeMove = (e: TouchEvent) => {
    if (!this._swipeState) return;
    const dx = e.touches[0].clientX - this._swipeState.startX;
    const dy = e.touches[0].clientY - this._swipeState.startY;
    if (!this._swipeState.swiping && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
      this._swipeState.swiping = true;
    }
    if (this._swipeState.swiping) {
      e.preventDefault();
      const atStart = this._currentPage === 0 && dx > 0;
      const atEnd = this._currentPage === this._pageCount - 1 && dx < 0;
      this._swipeState = { ...this._swipeState, dx: (atStart || atEnd) ? dx * 0.3 : dx };
      this.requestUpdate();
    }
  };

  private _onSwipeEnd = () => {
    if (!this._swipeState) return;
    const { dx, swiping } = this._swipeState;
    this._swipeState = null;
    if (!swiping) return;
    if (dx < -50 && this._currentPage < this._pageCount - 1) {
      this._currentPage++;
    } else if (dx > 50 && this._currentPage > 0) {
      this._currentPage--;
    }
    this.requestUpdate();
  };

  updated(changedProps: PropertyValues): void {
    if (!this._editorDetected) {
      this._editorDetected = true;
      const root = this.getRootNode() as any;
      if (root?.host?.tagName === 'HUI-CARD-PREVIEW') {
        this._isEditorPreview = true;
        this._currentPage = 0;
      }
    }
    // Close open popups when the current page changes (swipe, dot click, conditions)
    if (changedProps.has('_currentPage')) {
      if (this._sourcePopupOpen) this._sourcePopupOpen = false;
      if (this._numpadPopupOpen) this._numpadPopupOpen = false;
      this._popupAnchorEl = null;
      this._removePopupOutsideListener();
    }
    if (changedProps.has('hass') && this.hass && !this._isEditorPreview) {
      const conds = this._config?.page_conditions;
      const hasAnyCondition = conds?.some((c: any) => Array.isArray(c) && c.length > 0);
      if (hasAnyCondition) {
        const targetPage = this._evaluatePageConditions();
        const effectivePage = targetPage >= 0 && targetPage < this._pageCount ? targetPage : 0;
        if (effectivePage !== this._currentPage) {
          this._currentPage = effectivePage;
        }
      }
    }
  }

  // -- Action dispatch (called from ItemBase._fireAction) --------------------

  /** Generic action dispatcher. Item custom elements call this via
   *  their base class when `handleItemAction()` returned false. */
  _dispatchItemAction(item: Item, _itemIndex: number, subButton: string | null, actionType: string): void {
    if (!item) return;
    const meta = ITEMS[item.type];

    let actionConfig: any;
    if (subButton && meta?.cls.hasSubButtons) {
      actionConfig = (item.buttons?.[subButton] as any)?.[`${actionType}_action`];
    } else {
      actionConfig = (item as any)[`${actionType}_action`];
    }

    if (!actionConfig || actionConfig.action === 'none') return;
    this._fireHassAction({ [`${actionType}_action`]: actionConfig }, actionType);
  }

  async _fireHassAction(config: Record<string, any>, actionType: string): Promise<void> {
    const cfg = { ...config };
    const action = cfg[`${actionType}_action`];
    if (action && typeof action === 'object') {
      const next = { ...action };
      try {
        if (next.data) next.data = await this._renderTemplates(next.data);
        if (next.target) next.target = await this._renderTemplates(next.target);
      } catch (e: any) {
        const msg = e?.body?.message || e?.message || String(e);
        console.error('grc: template render failed, action aborted —', msg);
        this._showError(`Template render failed: ${msg}`);
        return;
      }
      cfg[`${actionType}_action`] = next;
    }
    const event = new Event('hass-action', { bubbles: true, composed: true }) as Event & { detail?: any };
    event.detail = { config: cfg, action: actionType };
    this.dispatchEvent(event);
  }

  private _showError(message: string): void {
    this.dispatchEvent(new CustomEvent('hass-notification', {
      bubbles: true, composed: true,
      detail: { message },
    }));
  }

  private async _renderTemplates(obj: any): Promise<any> {
    if (obj == null || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    await Promise.all(Object.entries(obj).map(async ([k, v]) => {
      if (typeof v === 'string' && /\{\{|\{%|\{#/.test(v)) {
        out[k] = await this.hass.callApi('POST', 'template', { template: v });
      } else if (typeof v === 'object' && v !== null) {
        out[k] = await this._renderTemplates(v);
      } else {
        out[k] = v;
      }
    }));
    return out;
  }

  // -- Popup outside-click listener ------------------------------------------

  private _onWindowPointerDown = (e: PointerEvent): void => {
    const path = e.composedPath();
    // Skip if pointerdown is on the popup-menu itself (its internal items handle own clicks)
    if (path.some((el: any) => el.classList?.contains?.('popup-menu'))) return;
    // Skip if pointerdown is on the anchor that opened the popup — the
    // anchor's own tap toggles the popup closed, avoiding the close→reopen bounce.
    if (this._popupAnchorEl && path.includes(this._popupAnchorEl)) return;
    if (this._sourcePopupOpen) this._sourcePopupOpen = false;
    if (this._numpadPopupOpen) this._numpadPopupOpen = false;
    this._popupAnchorEl = null;
    this._removePopupOutsideListener();
  };

  _addPopupOutsideListener(): void {
    if (!this._popupOutsideListenerActive) {
      this._popupOutsideListenerActive = true;
      window.addEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }

  _removePopupOutsideListener(): void {
    if (this._popupOutsideListenerActive && !this._sourcePopupOpen && !this._numpadPopupOpen) {
      this._popupOutsideListenerActive = false;
      window.removeEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }
}
