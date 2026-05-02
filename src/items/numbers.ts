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

const NUMPAD_POS: Record<NumpadKey, [number, number]> = {
  '1': [1, 1], '2': [1, 2], '3': [1, 3],
  '4': [2, 1], '5': [2, 2], '6': [2, 3],
  '7': [3, 1], '8': [3, 2], '9': [3, 3],
  dash: [4, 1], '0': [4, 2], enter: [4, 3],
};

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

const SCHEMA_NUMPAD_BTN_BASIS = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'background_color', selector: { ui_color: {} } },
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
    return html`
      <div class="numpad-grid">
        ${NUMPAD_KEYS.map((key) => {
          const btnCfg = (item.buttons?.[key] as any) || {};
          if (btnCfg.hidden) return '';
          const [row, col] = NUMPAD_POS[key];
          const style: string[] = [`grid-row:${row}`, `grid-column:${col}`];
          const bg = resolveColor(btnCfg.background_color || '');
          if (bg) style.push(`--grc-btn-bg:${bg}`);
          const iconColor = resolveColor(btnCfg.icon_color || '');
          const textColor = resolveColor(btnCfg.text_color || '');
          const icon = btnCfg.icon;
          const labelOverride = btnCfg.text;
          const defaultLabel = key === 'enter'
            ? html`<ha-icon icon="mdi:keyboard-return" style="--mdc-icon-size:20px;"></ha-icon>`
            : NUMPAD_DISPLAY[key];
          let content: TemplateResult | string;
          if (icon) {
            content = html`<ha-icon icon="${icon}" style="--mdc-icon-size:22px;${iconColor ? `color:${iconColor};` : ''}"></ha-icon>`;
          } else if (labelOverride) {
            content = html`<span style="--numpad-chars:${Math.max(1, labelOverride.length)};${textColor ? `color:${textColor};` : ''}">${labelOverride}</span>`;
          } else {
            content = defaultLabel;
          }
          return html`
            <button class="numpad-btn ${key === 'enter' ? 'numpad-enter' : ''} ${key === 'dash' ? 'numpad-dash' : ''}"
                    style="${style.join(';')}"
                    @click=${() => handleNumpadTap(card, itemIndex, key)}>
              ${content}
            </button>
          `;
        })}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const item = this.item;
    const icon = item.icon ?? (item.text ? null : NumbersItem.defaultIcon);
    const text = item.text ?? (item.icon ? null : '');
    const iconColor = resolveColor(item.icon_color || '');
    const textColor = resolveColor(item.text_color || '');
    const bgColor = resolveColor(item.background_color || '');
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
  const actionsSchema = editor._actionFields({ hasEntity: false });

  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
    ${editor._renderCollapsible(`item-${index}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderItemForm(actionsData, actionsSchema, index))}
    ${editor._renderCollapsible(`item-${index}-numpad-buttons`, t(editor.hass, 'Button settings'), false, html`
      ${NUMPAD_KEYS.map((key) =>
        renderNumpadKeyRow(editor, item, index, key))}
    `)}
  `;
}

function renderNumpadKeyRow(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
  key: NumpadKey,
): TemplateResult {
  const btnCfg = (item.buttons?.[key] as any) ?? {};
  const isHidden = !!btnCfg.hidden;
  const isSubOpen = editor._openSubButton === `${index}-${key}`;
  return html`
    <div class="button-item ${isHidden ? 'hidden-source' : ''}" style="margin-left:8px;">
      <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}">
        <span class="button-item-label" style="cursor:pointer;flex:1;"
              @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${key}`; }}>
          ${NUMPAD_LABELS[key]}
        </span>
        <button class="icon-btn" title="${t(editor.hass, isHidden ? 'Show' : 'Hide')}"
                @click=${() => toggleNumpadKeyHidden(editor, index, key)}>
          <ha-icon icon="${isHidden ? 'mdi:eye-off' : 'mdi:eye'}" style="--mdc-icon-size:18px;"></ha-icon>
        </button>
        <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}"
                 icon="mdi:chevron-right"
                 style="cursor:pointer;"
                 @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${key}`; }}></ha-icon>
      </div>
      ${isSubOpen ? html`
        <div class="button-editor-slot">
          ${renderNumpadKeyEditor(editor, item, index, key)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderNumpadKeyEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
  key: NumpadKey,
): TemplateResult {
  const btnCfg = (item.buttons?.[key] as any) ?? {};
  const basisData = {
    icon: btnCfg.icon ?? '',
    text: btnCfg.text ?? '',
    icon_color: btnCfg.icon_color ?? '',
    text_color: btnCfg.text_color ?? '',
    background_color: btnCfg.background_color ?? '',
  };
  const actionsData = {
    tap_action: btnCfg.tap_action ?? {},
    hold_action: btnCfg.hold_action ?? {},
    hold_repeat: btnCfg.hold_repeat ?? false,
    hold_repeat_interval: btnCfg.hold_repeat_interval ?? '',
  };
  const actionsSchema = editor._actionFields({ hasEntity: false });
  return html`
    ${editor._renderCollapsible(`item-${index}-${key}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderSubBtnForm(basisData, SCHEMA_NUMPAD_BTN_BASIS, index, key))}
    ${editor._renderCollapsible(`item-${index}-${key}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderSubBtnForm(actionsData, actionsSchema, index, key))}
  `;
}

function toggleNumpadKeyHidden(editor: GridRemoteCardEditor, index: number, key: NumpadKey): void {
  const items = [...editor._items];
  const item: Item = { ...items[index] };
  const buttons: Record<string, any> = { ...(item.buttons || {}) };
  const btnCfg: any = { ...(buttons[key] || {}) };
  if (btnCfg.hidden) delete btnCfg.hidden;
  else btnCfg.hidden = true;
  if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
  else delete buttons[key];
  if (Object.keys(buttons).length > 0) item.buttons = buttons;
  else delete item.buttons;
  items[index] = item;
  editor._config = { ...editor._config, items };
  editor._fireConfigChanged();
}
