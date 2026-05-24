/**
 * SwipepadItem — a free-form gesture pad. Supports 8 compass swipe
 * directions (n / ne / e / se / s / sw / w / nw) plus a center action
 * for taps without movement. Each direction has its own SubButtonConfig
 * (icon / text / colors / tap_action / hold_action / hold_repeat).
 *
 * Unlike ButtonItem we don't reuse the ItemBase pointer state machine
 * — that one cancels the hold timer once movement exceeds 15 px, which
 * is exactly the gesture we want to recognise here. The swipepad runs
 * its own pointerdown/move/up loop on the container element.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import {
  HOLD_DELAY_MS,
  SWIPEPAD_DIRS,
  SWIPEPAD_SWIPE_THRESHOLD,
  type SwipepadDir,
} from '../constants';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';

const DIR_LABELS: Record<SwipepadDir, string> = {
  n: 'Up',
  ne: 'Up-right',
  e: 'Right',
  se: 'Down-right',
  s: 'Down',
  sw: 'Down-left',
  w: 'Left',
  nw: 'Up-left',
  center: 'Center',
};

const DIR_DEFAULT_ICON: Record<SwipepadDir, string> = {
  n: 'mdi:chevron-up',
  ne: 'mdi:arrow-top-right',
  e: 'mdi:chevron-right',
  se: 'mdi:arrow-bottom-right',
  s: 'mdi:chevron-down',
  sw: 'mdi:arrow-bottom-left',
  w: 'mdi:chevron-left',
  nw: 'mdi:arrow-top-left',
  center: 'mdi:circle-outline',
};

const CARDINAL: SwipepadDir[] = ['n', 'e', 's', 'w'];

const SCHEMA_SWIPEPAD_BTN_BASIS = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
];

/** Convert (dx,dy) on a pointer drag into one of the 8 compass keys.
 *  Returns null when the magnitude is below the swipe threshold. */
function dirFromDelta(dx: number, dy: number): SwipepadDir | null {
  if (Math.hypot(dx, dy) < SWIPEPAD_SWIPE_THRESHOLD) return null;
  // atan2 returns -π..π with 0 = east, π/2 = south (screen Y grows downward).
  // Shift by π/8 so each sector spans 45° centred on the cardinal directions.
  const a = Math.atan2(dy, dx);
  const sector = Math.floor(((a + Math.PI + Math.PI / 8) / (Math.PI / 4))) % 8;
  // After the shift: 0=W, 1=NW, 2=N, 3=NE, 4=E, 5=SE, 6=S, 7=SW
  return (['w', 'nw', 'n', 'ne', 'e', 'se', 's', 'sw'] as SwipepadDir[])[sector];
}

@customElement('grc-swipepad-item')
export class SwipepadItem extends ItemBase {
  static override readonly label = 'Swipepad';
  static override readonly wrapperClass = 'grid-item swipepad-wrapper';
  static override readonly hasSubButtons = true;
  static override readonly showTextInGrid = false;
  static override readonly editorIcon = 'mdi:gesture-swipe';
  static override readonly defaultSize = { cols: 3, rows: 2 };

  static override resolveEditorIcon() { return 'mdi:gesture-swipe'; }

  @state() private _activeDir: SwipepadDir | null = null;
  @state() private _holdActive = false;
  @state() private _touched = false;

  private _startX = 0;
  private _startY = 0;
  private _pointerId: number | null = null;
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;
  private _repeatTimer: ReturnType<typeof setInterval> | null = null;
  private _isHoldFired = false;

  // Separate per-icon click machinery (independent of swipe state). Used
  // when a direction has `icon_click` enabled and the user taps/holds
  // the icon directly. `e.stopPropagation()` keeps these events out of
  // the swipepad-bg handler so the gesture stays scoped to the icon —
  // until the user drags > threshold, at which point we promote the
  // gesture to a normal swipe (see `_iconPromotedToSwipe`).
  private _iconPressedDir: SwipepadDir | null = null;
  private _iconHoldFired = false;
  private _iconHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private _iconRepeatTimer: ReturnType<typeof setInterval> | null = null;
  private _iconStartX = 0;
  private _iconStartY = 0;
  private _iconPromotedToSwipe = false;

  static override styles = [
    css`
      :host { display: block; width: 100%; height: 100%; }
      .swipepad-bg {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 12px;
        background-color: var(--grc-btn-bg, var(--grc-item-bg));
        background-image: var(--grc-btn-bg-overlay, none);
        box-shadow: var(--grc-btn-shadow, none);
        touch-action: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        overflow: hidden;
      }
      .tp-dir {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--grc-item-icon, var(--primary-text-color));
        pointer-events: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        opacity: 1;
        transition: transform 0.15s ease, opacity 0.18s ease;
      }
      .tp-dir.hidden { opacity: 0; pointer-events: none; }
      .tp-dir.click {
        pointer-events: auto;
        cursor: pointer;
      }
      /* Hover only on devices with a real hover capability — avoids the
         "sticky :hover" effect on touch screens that keeps the last
         tapped icon visually highlighted. */
      @media (hover: hover) {
        .tp-dir.click:hover {
          background-color: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
        }
      }
      .tp-dir.diagonal { width: 22px; height: 22px; }
      .tp-dir ha-icon { --mdc-icon-size: 22px; }
      .tp-dir.diagonal ha-icon { --mdc-icon-size: 16px; }
      .tp-dir .btn-text {
        font-size: 13px;
        font-weight: 500;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      }
      .tp-dir.diagonal .btn-text { font-size: 10px; }

      /* Cardinal positions: centred along each edge.
         Centre-of-icon = 6 px (offset) + 16 px (half height) = 22 px from
         the edge. Diagonals (22×22) align their centres to the same 22 px
         line on both axes so they sit visually flush with the cardinals.
         Offset for diagonals: 22 - 11 = 11 px from each touching edge. */
      .tp-n { top: 6px; left: 50%; transform: translateX(-50%); }
      .tp-s { bottom: 6px; left: 50%; transform: translateX(-50%); }
      .tp-w { left: 6px; top: 50%; transform: translateY(-50%); }
      .tp-e { right: 6px; top: 50%; transform: translateY(-50%); }
      .tp-nw { top: 11px; left: 11px; }
      .tp-ne { top: 11px; right: 11px; }
      .tp-sw { bottom: 11px; left: 11px; }
      .tp-se { bottom: 11px; right: 11px; }
      /* Center: middle of the pad. */
      .tp-center {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
      }

      /* Active feedback: the icon for the currently detected direction
         grows ~30%. Combined with the per-position translate so the
         icon stays anchored at its edge / corner. */
      .tp-n.active  { transform: translateX(-50%) scale(1.35); }
      .tp-s.active  { transform: translateX(-50%) scale(1.35); }
      .tp-w.active  { transform: translateY(-50%) scale(1.35); }
      .tp-e.active  { transform: translateY(-50%) scale(1.35); }
      .tp-nw.active, .tp-ne.active, .tp-sw.active, .tp-se.active { transform: scale(1.35); }
      .tp-center.active { transform: translate(-50%, -50%) scale(1.35); }
    `,
  ];

  protected override render(): TemplateResult {
    const cfg = this.card._config;
    const bgColor = resolveColor(this.item.background_color || '');
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    return html`
      <div class="swipepad-bg"
           style="${style}"
           @pointerdown=${this._onTpDown}
           @pointermove=${this._onTpMove}
           @pointerup=${this._onTpUp}
           @pointercancel=${this._onTpCancel}
           @pointerleave=${this._onTpCancel}
           @contextmenu=${(e: Event) => e.preventDefault()}>
        ${SWIPEPAD_DIRS.map((dir) => this._renderDir(dir, cfg))}
      </div>
    `;
  }

  private _renderDir(dir: SwipepadDir, _cfg: any): TemplateResult | '' {
    const cfgBtn = (this.item.buttons?.[dir] as any) || {};
    const hasIcon = !!cfgBtn.icon;
    const hasText = !!cfgBtn.text;
    // Render only when explicitly configured, except the four cardinals
    // and the four diagonals — they always show their default arrow so
    // the swipepad communicates its swipe directions visually.
    if (!hasIcon && !hasText && dir === 'center') return '';
    const isCardinal = CARDINAL.includes(dir);
    const isCenter = dir === 'center';

    // Visibility groups: each group can be hidden until the user touches
    // the swipepad. While the pointer is down everything is shown.
    const touched = this._touched;
    const item = this.item as any;
    const hideCardinal = !!item.hide_cardinal_icons;       // default false → always visible
    const hideDiagonal = item.hide_diagonal_icons !== false; // default true  → hidden until touched
    let hidden = false;
    if (!touched) {
      if (isCardinal && hideCardinal) hidden = true;
      else if (!isCardinal && !isCenter && hideDiagonal) hidden = true;
    }

    const isActive = this._activeDir === dir || (isCenter && this._activeDir === null && this._holdActive);
    // Per-direction click option. Cardinals default to clickable so the
    // icons act as buttons out of the box; diagonals + center default
    // to off (swipe-only).
    const defaultClick = isCardinal;
    const iconClick = cfgBtn.icon_click ?? defaultClick;
    const clickable = iconClick && !hidden;
    const classes = [
      'tp-dir', `tp-${dir}`,
      isCardinal || isCenter ? '' : 'diagonal',
      isActive ? 'active' : '',
      hidden ? 'hidden' : '',
      clickable ? 'click' : '',
    ].filter(Boolean).join(' ');
    const iconColor = resolveColor(this.resolveTemplated(cfgBtn.icon_color));
    const textColor = resolveColor(this.resolveTemplated(cfgBtn.text_color));
    const inner = hasText
      ? html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${cfgBtn.text}</span>`
      : html`<ha-icon .icon=${cfgBtn.icon || DIR_DEFAULT_ICON[dir]}
                       style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`;
    if (clickable) {
      return html`<span class="${classes}"
        @pointerdown=${(e: PointerEvent) => this._onIconDown(e, dir)}
        @pointermove=${(e: PointerEvent) => this._onIconMove(e)}
        @pointerup=${(e: PointerEvent) => this._onIconUp(e, dir)}
        @pointercancel=${(e: PointerEvent) => this._onIconCancel(e)}>${inner}</span>`;
    }
    return html`<span class="${classes}">${inner}</span>`;
  }

  // -- Icon click handlers (used when buttons[dir].icon_click is true) ------

  private _onIconDown = (e: PointerEvent, dir: SwipepadDir) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    this._iconPressedDir = dir;
    this._iconHoldFired = false;
    this._iconPromotedToSwipe = false;
    this._iconStartX = e.clientX;
    this._iconStartY = e.clientY;
    this._iconHoldTimer = setTimeout(() => this._onIconHoldElapsed(dir), HOLD_DELAY_MS);
  };

  /** Pointer moved while the user is pressing an icon. If the drag
   *  passes the swipe threshold, abort the icon press and promote the
   *  gesture to a normal swipepad swipe — re-using the icon's original
   *  start coordinates so the angle stays correct. */
  private _onIconMove = (e: PointerEvent) => {
    e.stopPropagation();
    if (this._iconPromotedToSwipe) {
      // Already a swipe; forward to swipepad move handler so the
      // direction tracker stays live as the user drags.
      this._onTpMove(e);
      return;
    }
    if (this._iconPressedDir == null) return;
    const dx = e.clientX - this._iconStartX;
    const dy = e.clientY - this._iconStartY;
    if (Math.hypot(dx, dy) < SWIPEPAD_SWIPE_THRESHOLD) return;

    // Promote: cancel any pending icon tap/hold, start swipepad swipe
    // bookkeeping from the icon's original press point.
    this._clearIconTimers();
    this._iconPressedDir = null;
    this._iconPromotedToSwipe = true;
    this._pointerId = e.pointerId;
    this._startX = this._iconStartX;
    this._startY = this._iconStartY;
    this._activeDir = null;
    this._isHoldFired = false;
    this._holdActive = false;
    this._touched = true;
    this._holdTimer = setTimeout(() => this._onHoldElapsed(), HOLD_DELAY_MS);
    this._onTpMove(e);
  };

  private _onIconUp = (e: PointerEvent, dir: SwipepadDir) => {
    e.stopPropagation();
    if (this._iconPromotedToSwipe) {
      // Promoted gesture: let the swipepad finish the swipe.
      this._iconPromotedToSwipe = false;
      this._onTpUp(e);
      return;
    }
    if (this._iconPressedDir !== dir) return;
    const wasHold = this._iconHoldFired;
    this._clearIconTimers();
    this._iconPressedDir = null;
    if (!wasHold) this._fire('tap', dir);
  };

  private _onIconCancel = (e: PointerEvent) => {
    e.stopPropagation();
    if (this._iconPromotedToSwipe) {
      this._iconPromotedToSwipe = false;
      this._onTpCancel(e);
      return;
    }
    this._clearIconTimers();
    this._iconPressedDir = null;
  };

  private _onIconHoldElapsed(dir: SwipepadDir): void {
    this._iconHoldTimer = null;
    if (this._iconPressedDir !== dir) return;
    this._iconHoldFired = true;
    if (this._shouldRepeatOnHold(dir)) {
      this._fire('tap', dir);
      const interval = this._getHoldRepeatInterval(dir);
      this._iconRepeatTimer = setInterval(() => this._fire('tap', dir), interval);
    } else {
      this._fire('hold', dir);
    }
  }

  private _clearIconTimers(): void {
    if (this._iconHoldTimer) { clearTimeout(this._iconHoldTimer); this._iconHoldTimer = null; }
    if (this._iconRepeatTimer) { clearInterval(this._iconRepeatTimer); this._iconRepeatTimer = null; }
  }

  // -- Pointer handlers (custom — bypass ItemBase per-button machine) -------

  private _onTpDown = (e: PointerEvent) => {
    if (this._pointerId != null) return; // ignore secondary touches
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    this._pointerId = e.pointerId;
    this._startX = e.clientX;
    this._startY = e.clientY;
    this._activeDir = null;
    this._isHoldFired = false;
    this._holdActive = false;
    this._touched = true;
    this._holdTimer = setTimeout(() => this._onHoldElapsed(), HOLD_DELAY_MS);
  };

  private _onTpMove = (e: PointerEvent) => {
    if (e.pointerId !== this._pointerId) return;
    const dir = dirFromDelta(e.clientX - this._startX, e.clientY - this._startY);
    if (dir !== this._activeDir) this._activeDir = dir;
  };

  private _onTpUp = (e: PointerEvent) => {
    if (e.pointerId !== this._pointerId) return;
    const wasHold = this._isHoldFired;
    this._endPointer();
    if (!wasHold) {
      const sub = this._activeDir ?? 'center';
      this._fire('tap', sub);
    }
    this._activeDir = null;
    this._holdActive = false;
    this._touched = false;
  };

  private _onTpCancel = (e: PointerEvent) => {
    if (e.pointerId !== this._pointerId) return;
    this._endPointer();
    this._activeDir = null;
    this._holdActive = false;
    this._touched = false;
  };

  /** Hold timer fired — the pointer has been down for HOLD_DELAY_MS. */
  private _onHoldElapsed(): void {
    this._holdTimer = null;
    if (this._pointerId == null) return;
    const dir = this._activeDir ?? 'center';
    // Skip when this direction has neither a hold action nor hold-repeat.
    // Without this, "hold then swipe" gestures on a center with no hold
    // config would dead-end: the hold flag prevented the eventual swipe
    // tap from firing. Now the gesture stays alive until the user
    // actually moves or releases.
    const cfg: any = this.item.buttons?.[dir] || {};
    const holdAction = cfg.hold_action;
    const hasHoldAction = !!(holdAction && holdAction.action && holdAction.action !== 'none');
    const wantsRepeat = !!cfg.hold_repeat && !hasHoldAction;
    if (!hasHoldAction && !wantsRepeat) return;

    this._isHoldFired = true;
    this._holdActive = true;
    if (wantsRepeat) {
      // Fire once immediately, then start the repeat interval which
      // re-reads `_activeDir` each tick so the user can drag around
      // the pad to change direction live.
      this._fire('tap', dir);
      const interval = this._getHoldRepeatInterval(dir);
      this._repeatTimer = setInterval(() => {
        const d = this._activeDir ?? 'center';
        this._fire('tap', d);
      }, interval);
    } else {
      this._fire('hold', dir);
    }
  }

  private _endPointer(): void {
    if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null; }
    if (this._repeatTimer) { clearInterval(this._repeatTimer); this._repeatTimer = null; }
    this._pointerId = null;
  }

  /** Dispatch an action through the card with the swipepad direction as
   *  the sub-button key. Mirrors ItemBase._fireAction's haptic logic. */
  private _fire(actionType: string, subButton: string): void {
    const fired = this.card._dispatchItemAction(this.item, this.index, subButton, actionType);
    if (fired) {
      const hapticKey = `haptic_${actionType}` as keyof typeof this.card._config;
      if (this.card._config[hapticKey]) {
        try { navigator.vibrate?.(50); } catch (_) { /* noop */ }
      }
    }
  }
}

// -- Editor ------------------------------------------------------------------

export function renderSwipepadEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const optionsData = {
    background_color: item.background_color ?? '',
    hide_cardinal_icons: (item as any).hide_cardinal_icons ?? false,
    hide_diagonal_icons: (item as any).hide_diagonal_icons !== false,
  };
  const optionsSchema = [
    { name: 'background_color', selector: { ui_color: {} } },
    { name: 'hide_cardinal_icons', selector: { boolean: {} } },
    { name: 'hide_diagonal_icons', selector: { boolean: {} } },
  ];
  return html`
    ${editor._renderCollapsible(`item-${index}-options`, t(editor.hass, 'Options'), false,
      editor._renderItemForm(optionsData, optionsSchema, index))}
    ${SWIPEPAD_DIRS.map((dir) => {
      const isSubOpen = editor._openSubButton === `${index}-${dir}`;
      const btnCfg = (item.buttons?.[dir] as any) || {};
      const icon = btnCfg.icon || DIR_DEFAULT_ICON[dir];
      return html`
        <div class="button-item" style="margin-left:8px;">
          <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
               @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${dir}`; }}>
            <ha-icon class="button-item-icon" .icon="${icon}"></ha-icon>
            <span class="button-item-label">${t(editor.hass, DIR_LABELS[dir])}</span>
            <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
          </div>
          ${isSubOpen ? html`
            <div class="button-editor-slot">
              ${renderSwipepadBtnSubEditor(editor, item, index, dir)}
            </div>
          ` : ''}
        </div>
      `;
    })}
  `;
}

function renderSwipepadBtnSubEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
  dir: string,
): TemplateResult {
  const btnCfg = (item.buttons?.[dir] as any) ?? {};
  // Cardinal directions default to icon-click enabled; diagonals default
  // to off. Center has no meaningful icon_click toggle (the whole pad
  // already triggers the center action on tap), so the option is omitted
  // there entirely.
  const isCenter = dir === 'center';
  const defaultIconClick = (['n', 'e', 's', 'w'] as string[]).includes(dir);
  const basisData = {
    icon: btnCfg.icon ?? '',
    text: btnCfg.text ?? '',
    icon_color: btnCfg.icon_color ?? '',
    text_color: btnCfg.text_color ?? '',
  };
  const actionsData: Record<string, any> = {
    tap_action: btnCfg.tap_action ?? {},
    hold_action: btnCfg.hold_action ?? {},
    hold_repeat: btnCfg.hold_repeat ?? false,
    hold_repeat_interval: btnCfg.hold_repeat_interval ?? '',
  };
  if (!isCenter) actionsData.icon_click = btnCfg.icon_click ?? defaultIconClick;
  // Rename the generic tap/hold action labels to swipe-flavoured ones so
  // the UI reflects the gesture that actually triggers them. Skip for the
  // center direction — there's no swipe involved, so "Tap action" /
  // "Hold action" stay accurate.
  const baseActionsSchema = editor._actionFields({ hasEntity: false }).map((entry: any) => {
    if (isCenter) return entry;
    if (entry.name === 'tap_action') return { ...entry, label: 'Swipe action' };
    if (entry.name === 'hold_action') return { ...entry, label: 'Swipe & Hold action' };
    return entry;
  });
  const actionsSchema = isCenter
    ? baseActionsSchema
    : [...baseActionsSchema, { name: 'icon_click', selector: { boolean: {} } }];
  return html`
    ${editor._renderCollapsible(`item-${index}-${dir}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderSubBtnForm(basisData, SCHEMA_SWIPEPAD_BTN_BASIS, index, dir))}
    ${editor._renderCollapsible(`item-${index}-${dir}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderSubBtnForm(actionsData, actionsSchema, index, dir))}
  `;
}
