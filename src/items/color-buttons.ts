/**
 * ColorButtonsItem — a row of four colored TV-remote buttons
 * (red, green, yellow, blue). Each sub-button has its own
 * config and action pipeline.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item, ItemSize } from '../types';
import type { ColorButtonKey } from '../types';

const COLOR_BUTTON_KEYS: ColorButtonKey[] = ['red', 'green', 'yellow', 'blue'];

const COLOR_BUTTON_DEFAULTS: Record<ColorButtonKey, { color: string }> = {
  red: { color: '#f44336' }, green: { color: '#4caf50' },
  yellow: { color: '#ffeb3b' }, blue: { color: '#6d9eeb' },
};

const COLOR_BUTTON_LABELS: Record<ColorButtonKey, string> = {
  red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue',
};
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';
import {
  btnTextStyles,
  remoteBtnStyles,
  rippleStyles,
  variantRadiusStyles,
} from './shared-styles';

const SCHEMA_COLOR_BTN_BASIS = [
  { name: 'color', selector: { ui_color: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
];

const _uiActionSchema = (name: string) => [{ name, selector: { ui_action: {} } }];

@customElement('grc-color-buttons-item')
export class ColorButtonsItem extends ItemBase {
  static override readonly label = 'Color buttons';
  static override readonly wrapperClass = 'grid-item color-buttons-wrapper';
  static override readonly hasSubButtons = true;
  static override readonly showTextInGrid = false;
  static override readonly editorIcon = 'mdi:palette';
  static override readonly defaultSize = { cols: 3, rows: 1 };

  /** Color buttons are always a single row; col_span overrides cols. */
  static override getSize(item: Item): ItemSize {
    return { cols: item.col_span || 3, rows: 1 };
  }

  static override normalizeSpan(_item: Item, colSpan: number, _rowSpan: number) {
    return { col_span: colSpan, row_span: 1 };
  }

  static override spanSchema(item: Item) {
    const size = this.getSize(item);
    return {
      data: { col_span: Math.max(size.cols, 3) },
      schema: [{ name: 'col_span', selector: { number: { min: 3, max: 7, step: 1, mode: 'box' } } }],
    };
  }

  static override persistSpan(_item: Item, val: Record<string, number>) {
    const colSpan = val.col_span || 3;
    return { col_span: colSpan !== 3 ? colSpan : undefined };
  }

  static override resolveEditorIcon() { return 'mdi:palette'; }

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
      .color-buttons-row {
        display: flex;
        /* % gap in flexbox resolves against container width, so gap
           grows with col_span. */
        gap: 5%;
        justify-content: space-evenly;
        align-items: center;
        width: 100%;
        height: 100%;
      }
      .color-btn {
        flex: 1 1 0 !important;
        min-width: 35px !important;
        max-width: 100px !important;
        height: 20px !important;
        border-radius: 6px !important;
        margin: 0 !important;
        /* Suppress the 3D overlay so the saturated palette colour stays
           pure. Hover/active vars mix with white as in the original
           flat-mode behaviour. */
        --grc-btn-bg-overlay: none;
        --grc-btn-bg-overlay-active: none;
        --grc-btn-hover-bg: color-mix(in srgb, var(--grc-btn-bg) 80%, white);
        --grc-btn-hover-filter: none;
        --grc-btn-active-bg: var(--grc-btn-bg);
      }
    `,
  ];

  protected override render(): TemplateResult {
    return html`
      <div class="color-buttons-row">
        ${COLOR_BUTTON_KEYS.map((key) => this._renderColorBtn(key))}
      </div>
    `;
  }

  private _renderColorBtn(key: string): TemplateResult {
    const btnCfg = this.item.buttons?.[key] ?? {};
    const defaults = COLOR_BUTTON_DEFAULTS[key as keyof typeof COLOR_BUTTON_DEFAULTS];
    const color = resolveColor(btnCfg.color || defaults.color);
    const icon = btnCfg.icon || '';
    const text = btnCfg.text || '';
    const iconColor = resolveColor(btnCfg.icon_color || '');
    const textColor = resolveColor(btnCfg.text_color || '');
    return html`
      <button class="remote-btn color-btn" style="--grc-btn-bg:${color}"
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, key)}
              @pointerup=${(e: PointerEvent) => this._onPointerUp(e, key)}
              @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
              @pointerleave=${(e: PointerEvent) => this._onPointerCancel(e)}
              @pointercancel=${(e: PointerEvent) => this._onPointerCancel(e)}
              @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : text
            ? html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text}</span>`
            : ''}
      </button>
    `;
  }
}

// -- Editor ------------------------------------------------------------------

export function renderColorButtonsEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  return html`
    ${COLOR_BUTTON_KEYS.map((key) => {
      const isSubOpen = editor._openSubButton === `${index}-${key}`;
      const btnCfg = item.buttons?.[key] || {};
      const defaults = COLOR_BUTTON_DEFAULTS[key as keyof typeof COLOR_BUTTON_DEFAULTS];
      const color = btnCfg.color || defaults.color;
      return html`
        <div class="button-item" style="margin-left:8px;">
          <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
               @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${key}`; }}>
            <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${color};flex-shrink:0;"></span>
            <span class="button-item-label">${t(editor.hass, COLOR_BUTTON_LABELS[key as keyof typeof COLOR_BUTTON_LABELS])}</span>
            <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
          </div>
          ${isSubOpen ? html`
            <div class="button-editor-slot">
              ${renderColorBtnSubEditor(editor, item, index, key)}
            </div>
          ` : ''}
        </div>
      `;
    })}
  `;
}

function renderColorBtnSubEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
  key: string,
): TemplateResult {
  const btnCfg = item.buttons?.[key] ?? {};
  const defaults = COLOR_BUTTON_DEFAULTS[key as keyof typeof COLOR_BUTTON_DEFAULTS];
  const basisData = {
    color: btnCfg.color ?? defaults.color,
    icon: btnCfg.icon ?? '',
    text: btnCfg.text ?? '',
    icon_color: btnCfg.icon_color ?? '',
    text_color: btnCfg.text_color ?? '',
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
      editor._renderSubBtnForm(basisData, SCHEMA_COLOR_BTN_BASIS, index, key))}
    ${editor._renderCollapsible(`item-${index}-${key}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderSubBtnForm(actionsData, actionsSchema, index, key))}
  `;
}
