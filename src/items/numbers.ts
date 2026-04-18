/**
 * NumbersItem — a button that opens a numeric keypad popup. Each
 * numpad key is a sub-button with its own tap_action configuration.
 * Popup content is provided via `static renderPopup()`; the card owns
 * the single popup slot and renders it in its shadow DOM.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCard } from '../card';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { VARIANT_CSS_CLASS } from '../constants';
import type { NumpadKey } from '../types';

const NUMPAD_KEYS: NumpadKey[] = ['1','2','3','4','5','6','7','8','9','dash','0','enter'];

const NUMPAD_LABELS: Record<NumpadKey, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
  dash: '-/--', enter: 'Enter',
};

const NUMPAD_DISPLAY: Record<string, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
  dash: '-/--',
};
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase, OPEN_POPUP_EVENT, type OpenPopupDetail } from './base';
import {
  btnTextStyles,
  remoteBtnStyles,
  rippleStyles,
  variantRadiusStyles,
} from './shared-styles';

const NUMPAD_OPTIONS_FIELDS = [
  { name: 'hide_dash', selector: { boolean: {} } },
  { name: 'hide_enter', selector: { boolean: {} } },
];

@customElement('grc-numbers-item')
export class NumbersItem extends ItemBase {
  static override readonly label = 'Number pad';
  static override readonly hasSubButtons = true;
  static override readonly editorIcon = 'mdi:dialpad';
  static override readonly defaultSize = { cols: 1, rows: 1 };
  static override readonly defaultIcon = 'mdi:dialpad';

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
    `,
  ];

  /** Open the numpad popup on tap when no custom tap_action is set. */
  override handleItemAction(
    actionType: string,
    anchorEl: HTMLElement,
    _subButton: string | null,
  ): boolean {
    if (actionType !== 'tap') return false;
    const ta = this.item.tap_action as any;
    if (ta && ta.action && ta.action !== 'none') return false;
    this.dispatchEvent(new CustomEvent<OpenPopupDetail>(OPEN_POPUP_EVENT, {
      detail: { itemIndex: this.index, anchorEl },
      bubbles: true,
      composed: true,
    }));
    return true;
  }

  static override renderPopup(card: GridRemoteCard, itemIndex: number): TemplateResult | '' {
    const item = card._items[itemIndex];
    if (!item) return '';
    const hideDash = item.hide_dash ?? false;
    const hideEnter = item.hide_enter ?? false;
    return html`
      <div class="numpad-grid">
        ${NUMPAD_KEYS.map((key) => {
          const hidden = (key === 'dash' && hideDash) || (key === 'enter' && hideEnter);
          if (hidden) return '';
          const col = key === 'dash' ? '1' : key === '0' ? '2' : key === 'enter' ? '3' : '';
          const style = col ? `grid-column:${col}` : '';
          return html`
            <button class="numpad-btn ${key === 'enter' ? 'numpad-enter' : ''} ${key === 'dash' ? 'numpad-dash' : ''}"
                    style="${style}"
                    @click=${() => handleNumpadTap(card, itemIndex, key)}>
              ${key === 'enter'
                ? html`<ha-icon icon="mdi:keyboard-return" style="--mdc-icon-size:20px;"></ha-icon>`
                : NUMPAD_DISPLAY[key]}
            </button>
          `;
        })}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const item = this.item;
    const cfg = this.card._config;
    const icon = item.icon ?? (item.text ? null : NumbersItem.defaultIcon);
    const text = item.text ?? (item.icon ? null : '');
    const iconColor = resolveColor(item.icon_color || cfg.icon_color || '');
    const textColor = resolveColor(item.text_color || cfg.text_color || '');
    const bgColor = resolveColor(item.background_color || cfg.button_background_color || '');
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    const variantClass = VARIANT_CSS_CLASS[item.variant || 'pill'] || '';

    return html`
      <button class="remote-btn ${variantClass}" style="${style}"
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, null)}
              @pointerup=${(e: PointerEvent) => this._onPointerUp(e, null)}
              @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
              @pointerleave=${(e: PointerEvent) => this._onPointerCancel(e)}
              @pointercancel=${(e: PointerEvent) => this._onPointerCancel(e)}
              @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text || ''}</span>`}
      </button>
    `;
  }
}

// -- Popup runtime (rendered into card's shadow DOM) -------------------------

function handleNumpadTap(card: GridRemoteCard, itemIndex: number, key: string): void {
  const item = card._items[itemIndex];
  if (!item) return;
  const actionConfig = (item.buttons?.[key] as any)?.tap_action;
  if (!actionConfig || actionConfig.action === 'none') return;
  if (card._config.haptic_tap) {
    try { navigator.vibrate?.(50); } catch (_) { /* noop */ }
  }
  card._fireHassAction({ tap_action: actionConfig }, 'tap');
}

// -- Editor ------------------------------------------------------------------

export function renderNumbersEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const basisData = {
    variant: item.variant || 'pill',
    icon: item.icon ?? '',
    text: item.text ?? '',
    icon_color: item.icon_color ?? '',
    text_color: item.text_color ?? '',
    background_color: item.background_color ?? '',
  };
  const basisSchema = [editor._variantField(), ...editor._basisFields()];

  const actionsData = {
    tap_action: item.tap_action ?? {},
    hold_action: item.hold_action ?? {},
    hold_repeat: item.hold_repeat ?? false,
    hold_repeat_interval: item.hold_repeat_interval ?? '',
  };
  const actionsSchema = editor._actionFields();

  const optionsData = {
    hide_dash: item.hide_dash ?? false,
    hide_enter: item.hide_enter ?? false,
  };

  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
    ${editor._renderCollapsible(`item-${index}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderItemForm(actionsData, actionsSchema, index))}
    ${editor._renderCollapsible(`item-${index}-numpad-options`, t(editor.hass, 'Options'), false,
      editor._renderItemForm(optionsData, NUMPAD_OPTIONS_FIELDS, index))}
    ${editor._renderCollapsible(`item-${index}-numpad-actions`, t(editor.hass, 'Button actions'), false, html`
      ${NUMPAD_KEYS.map((key) => {
        const hidden = (key === 'dash' && (item.hide_dash ?? false)) || (key === 'enter' && (item.hide_enter ?? false));
        if (hidden) return '';
        const isSubOpen = editor._openSubButton === `${index}-${key}`;
        const keyData = {
          tap_action: (item.buttons?.[key] as any)?.tap_action ?? {},
        };
        const keySchema = [{ name: 'tap_action', selector: { ui_action: {} } }];
        return html`
          <div class="button-item" style="margin-left:8px;">
            <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
                 @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${key}`; }}>
              <span class="button-item-label">${NUMPAD_LABELS[key]}</span>
              <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
            </div>
            ${isSubOpen ? html`
              <div class="button-editor-slot">
                ${editor._renderSubBtnForm(keyData, keySchema, index, key)}
              </div>
            ` : ''}
          </div>
        `;
      })}
    `)}
  `;
}
