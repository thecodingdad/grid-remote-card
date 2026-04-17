/**
 * Abstract base class for all item custom elements.
 *
 * Each concrete item type (button, slider, dpad, …) extends ItemBase
 * and is registered as a custom element via `@customElement('grc-<type>-item')`.
 * The base class holds the pointer-event state machine (tap, hold,
 * repeat), ripple creation, and the action dispatch pipeline.
 *
 * Sub-classes override `render()` and optionally `handleItemAction()`
 * for special tap behaviour (source/numbers/media/entity overrides).
 */

import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import type { GridRemoteCard } from '../card';
import type { GridRemoteCardConfig, HomeAssistant, Item, ItemSize } from '../types';
import { DEFAULT_REPEAT_INTERVAL_MS, HOLD_DELAY_MS } from '../constants';

interface PointerState {
  holdTimer: ReturnType<typeof setTimeout> | null;
  repeatTimer: ReturnType<typeof setInterval> | null;
  isHold: boolean;
  cancelled: boolean;
  startX: number;
  startY: number;
}

export abstract class ItemBase extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) item!: Item;
  @property({ type: Number }) index!: number;
  @property({ attribute: false }) card!: GridRemoteCard;

  /** Static metadata — subclasses override via `static readonly`. */
  static readonly label: string = '';
  static readonly editorIcon: string = '';
  static readonly defaultSize: ItemSize = { cols: 1, rows: 1 };
  static readonly defaultIcon: string | undefined = undefined;
  /** CSS class for the `.grid-item` wrapper in the card grid. */
  static readonly wrapperClass: string = 'grid-item';
  /** Whether this item type uses sub-buttons (dpad, color_buttons, numbers). */
  static readonly hasSubButtons: boolean = false;
  /** Whether the grid editor tile shows the item's text label (false for
   *  composite items like dpad and color_buttons that always show icons). */
  static readonly showTextInGrid: boolean = true;

  /** Apply an entity ID from a preset to this item. Default: no-op.
   *  Override in media (sets entity_id) and source (sets source_entity). */
  static applyPresetEntity(_item: Item, _entityId: string): void {}


  /** Compute the effective grid span of an item. Default: apply the
   *  item's col_span/row_span overrides on top of the class's defaultSize.
   *  Subclasses (dpad, slider, color-buttons) override for special cases. */
  static getSize(item: Item): ItemSize {
    const size = this.defaultSize;
    return {
      cols: item.col_span ?? size.cols,
      rows: item.row_span ?? size.rows,
    };
  }

  /** Normalize a span update from the editor. Default: pass through.
   *  Override for items with constraints (dpad square, slider vertical). */
  static normalizeSpan(
    _item: Item,
    colSpan: number,
    rowSpan: number,
  ): { col_span?: number; row_span?: number } {
    return { col_span: colSpan, row_span: rowSpan };
  }

  /** Returns the span schema fields and current data for the Size
   *  collapsible in the editor. Default: both col_span + row_span.
   *  Override for items with constraints (dpad: only col_span, slider:
   *  orientation-dependent, color_buttons: only col_span). */
  static spanSchema(item: Item): { data: Record<string, number>; schema: any[] } {
    const size = this.getSize(item);
    return {
      data: { col_span: size.cols, row_span: size.rows },
      schema: [{ name: '', type: 'grid', schema: [
        { name: 'col_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } },
        { name: 'row_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } },
      ]}],
    };
  }

  /** Resolve the icon to show in the grid editor tile. Default: use
   *  the item's custom icon, fall back to entity icon, then editorIcon.
   *  Subclasses can override for fixed icons (dpad, color_buttons). */
  static resolveEditorIcon(item: Item, hass?: HomeAssistant): string {
    if (item.icon) return item.icon;
    if (item.entity_id && hass) {
      const stateObj = hass.states[item.entity_id];
      if (stateObj?.attributes?.icon) return stateObj.attributes.icon;
    }
    return this.editorIcon || 'mdi:help';
  }

  /** Compute the span values to persist after an editor span change.
   *  Takes the raw val from ha-form and returns {col_span, row_span}
   *  with defaults deleted. Default: standard col/row with base comparison.
   *  Override for dpad (square) and slider (vertical asymmetry). */
  static persistSpan(item: Item, val: Record<string, number>): { col_span?: number; row_span?: number } {
    const base = this.defaultSize;
    const colSpan = val.col_span ?? base.cols;
    const rowSpan = val.row_span ?? base.rows;
    return {
      col_span: colSpan !== base.cols ? colSpan : undefined,
      row_span: rowSpan !== base.rows ? rowSpan : undefined,
    };
  }

  /** Called by the base pointer machinery before falling back to the
   *  generic action dispatch. Subclasses override for type-specific tap
   *  behaviour (source→popup, numbers→popup, media→source-popup,
   *  entity→more-info). Return true = handled, skip generic dispatch. */
  handleItemAction(
    _actionType: string,
    _anchorEl: HTMLElement,
    _subButton: string | null,
  ): boolean {
    return false;
  }

  // -- Pointer event state machine -----------------------------------------

  /** One pointer state per DOM element in this item's shadow tree. For
   *  single-button items this holds a single entry; dpad, color-buttons
   *  and numbers have one entry per sub-button. */
  private _ptrStates = new WeakMap<Element, PointerState>();

  private _getPointerState(el: Element): PointerState {
    let s = this._ptrStates.get(el);
    if (!s) {
      s = {
        holdTimer: null,
        repeatTimer: null,
        isHold: false,
        cancelled: false,
        startX: 0,
        startY: 0,
      };
      this._ptrStates.set(el, s);
    }
    return s;
  }

  protected _onPointerDown = (e: PointerEvent, subButton: string | null = null): void => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    const s = this._getPointerState(el);
    s.isHold = false;
    s.cancelled = false;
    s.startX = e.clientX;
    s.startY = e.clientY;
    this._createRipple(el, e);
    s.holdTimer = setTimeout(() => {
      s.isHold = true;
      if (this._shouldRepeatOnHold(subButton)) {
        this._fireAction('tap', subButton, el);
        const interval = this._getHoldRepeatInterval(subButton);
        s.repeatTimer = setInterval(() => this._fireAction('tap', subButton, el), interval);
      } else {
        this._fireAction('hold', subButton, el);
      }
    }, HOLD_DELAY_MS);
  };

  protected _onPointerMove = (e: PointerEvent): void => {
    const el = e.currentTarget as HTMLElement;
    const s = this._ptrStates.get(el);
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
      if (s.holdTimer) clearTimeout(s.holdTimer);
      s.holdTimer = null;
      if (s.repeatTimer) clearInterval(s.repeatTimer);
      s.repeatTimer = null;
      s.cancelled = true;
    }
  };

  protected _onPointerUp = (e: PointerEvent, subButton: string | null = null): void => {
    const el = e.currentTarget as HTMLElement;
    const s = this._ptrStates.get(el);
    if (!s) return;
    if (s.holdTimer) clearTimeout(s.holdTimer);
    s.holdTimer = null;
    if (s.repeatTimer) clearInterval(s.repeatTimer);
    s.repeatTimer = null;
    if (s.isHold || s.cancelled) return;
    this._fireAction('tap', subButton, el);
  };

  protected _onPointerCancel = (e: PointerEvent): void => {
    const el = e.currentTarget as HTMLElement;
    const s = this._ptrStates.get(el);
    if (!s) return;
    if (s.holdTimer) clearTimeout(s.holdTimer);
    s.holdTimer = null;
    if (s.repeatTimer) clearInterval(s.repeatTimer);
    s.repeatTimer = null;
  };

  private _shouldRepeatOnHold(subButton: string | null): boolean {
    if (!this.item) return false;
    if (subButton) {
      const btnCfg = this.item.buttons?.[subButton];
      if (!btnCfg?.hold_repeat) return false;
      const holdAction = btnCfg.hold_action as any;
      return !holdAction || !holdAction.action || holdAction.action === 'none';
    }
    if (!this.item.hold_repeat) return false;
    const holdAction = this.item.hold_action as any;
    return !holdAction || !holdAction.action || holdAction.action === 'none';
  }

  private _getHoldRepeatInterval(subButton: string | null): number {
    const subCfg = subButton ? this.item.buttons?.[subButton] : null;
    return (
      subCfg?.hold_repeat_interval
      ?? this.item.hold_repeat_interval
      ?? this.card._config.hold_repeat_interval
      ?? DEFAULT_REPEAT_INTERVAL_MS
    );
  }

  // -- Ripple --------------------------------------------------------------

  protected _createRipple(el: HTMLElement, event: PointerEvent): void {
    const container = el.querySelector('.ripple-container');
    if (!container) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    container.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // -- Action dispatch -----------------------------------------------------

  /** Shared action firing. Calls `handleItemAction()` for item-specific
   *  overrides first, then delegates to the card's generic dispatcher. */
  protected _fireAction(actionType: string, subButton: string | null, anchorEl: HTMLElement): void {
    // Try item-specific handler first (only for main button). It returns true
    // when it handled the action (e.g. source-popup open, entity more-info).
    let fired = false;
    if (!subButton && this.handleItemAction(actionType, anchorEl, subButton)) {
      fired = true;
    } else {
      fired = this.card._dispatchItemAction(this.item, this.index, subButton, actionType);
    }
    // Haptic only when an action actually fired
    if (fired) {
      const hapticKey = `haptic_${actionType}` as keyof GridRemoteCardConfig;
      if (this.card._config[hapticKey]) {
        try { navigator.vibrate?.(50); } catch (_) { /* noop */ }
      }
    }
  }
}
