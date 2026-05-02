/**
 * DpadItem — 8-way directional controller with a center OK button.
 * Uses a 2x2 rotated grid for the four directional cells and an
 * absolutely-positioned center button overlay.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item, ItemSize } from '../types';
import type { DpadDirection } from '../types';

const DPAD_DEFAULTS: Record<DpadDirection, { icon: string }> = {
  up:    { icon: 'mdi:chevron-up' },
  down:  { icon: 'mdi:chevron-down' },
  left:  { icon: 'mdi:chevron-left' },
  right: { icon: 'mdi:chevron-right' },
  ok:    { icon: 'mdi:circle-outline' },
};

const DPAD_DIRS: DpadDirection[] = ['up', 'down', 'left', 'right', 'ok'];

const DPAD_LABELS: Record<DpadDirection, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'OK',
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

const SCHEMA_BUTTON_BASIS = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'background_color', selector: { ui_color: {} } },
];

const _uiActionSchema = (name: string) => [{ name, selector: { ui_action: {} } }];

@customElement('grc-dpad-item')
export class DpadItem extends ItemBase {
  static override readonly label = 'D-Pad';
  static override readonly wrapperClass = 'grid-item dpad-wrapper';
  static override readonly hasSubButtons = true;
  static override readonly showTextInGrid = false;
  static override readonly editorIcon = 'mdi:gamepad-variant-outline';
  static override readonly defaultSize = { cols: 3, rows: 3 };

  /** DPAD is always square — col_span determines both dimensions. */
  static override getSize(item: Item): ItemSize {
    const s = item.col_span || 3;
    return { cols: s, rows: s };
  }

  static override normalizeSpan(_item: Item, colSpan: number, _rowSpan: number) {
    return { col_span: colSpan, row_span: colSpan };
  }

  static override spanSchema(item: Item) {
    const size = this.getSize(item);
    return {
      data: { col_span: size.cols },
      schema: [{ name: 'col_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } }],
    };
  }

  static override persistSpan(_item: Item, val: Record<string, number>) {
    const colSpan = val.col_span || 3;
    return { col_span: colSpan !== 3 ? colSpan : undefined, row_span: colSpan !== 3 ? colSpan : undefined };
  }

  static override resolveEditorIcon() { return 'mdi:gamepad-variant-outline'; }

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    css`
      :host { display: block; width: 100%; }

      .dpad-ring {
        position: relative;
        margin: 0 auto;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: var(--grc-btn-shadow, none);
      }

      .dpad-grid {
        position: absolute;
        inset: 0;
        transform: rotate(45deg);
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        border-radius: 50%;
        overflow: hidden;
      }

      .remote-btn.dpad-cell {
        width: auto;
        height: auto;
        margin: 0;
        border-radius: 0;
      }
      /* DPad cells rotate 45° with parent grid, so default 3D overlay
         (anchored at 30% 25%) lands off-axis. Swap to the dpad-specific
         overlay anchored at 15% 15% so after the 45° CW rotation the
         highlight lands directly above each cell centre. Flat mode:
         var unset → inherits the base (none) so cells stay flat. */
      .remote-btn.dpad-cell {
        --grc-btn-bg-overlay: var(--grc-dpad-cell-overlay, none);
        --grc-btn-bg-overlay-active: var(--grc-dpad-cell-overlay-active, none);
      }
      /* Separator lines between dpad cells drawn as two linear gradients
         on an overlay. Because .dpad-grid is rotated 45deg, a horizontal
         and a vertical line together form the visual X across the ring.
         A radial mask fades the lines out before they reach the center
         button, avoiding the ugly border-meets-center artifact. */
      .dpad-grid::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(to right,
            transparent calc(50% - 0.5px),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent) calc(50% - 0.5px),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent) calc(50% + 0.5px),
            transparent calc(50% + 0.5px)),
          linear-gradient(to bottom,
            transparent calc(50% - 0.5px),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent) calc(50% - 0.5px),
            color-mix(in srgb, var(--primary-text-color) 8%, transparent) calc(50% + 0.5px),
            transparent calc(50% + 0.5px));
        -webkit-mask: radial-gradient(circle at center, transparent calc(var(--grc-dpad-center-size) / 2), black calc(var(--grc-dpad-center-size) / 2));
                mask: radial-gradient(circle at center, transparent calc(var(--grc-dpad-center-size) / 2), black calc(var(--grc-dpad-center-size) / 2));
      }

      .remote-btn.dpad-cell ha-icon {
        transform: rotate(-45deg);
      }
      .remote-btn.dpad-cell .btn-text {
        transform: rotate(-45deg);
        z-index: 1;
      }

      .remote-btn.center-btn {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: var(--grc-dpad-center-size);
        height: var(--grc-dpad-center-size);
        border-radius: 50%;
        z-index: 3;
        background: var(--grc-btn-bg, var(--grc-card-bg, var(--card-background-color, var(--ha-card-background, #1c1c1c))));
        border: 2px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
      }
    `,
  ];

  protected override render(): TemplateResult {
    const size = DpadItem.getSize(this.item);
    const s = size.cols;
    const ringSize = `calc(${s} * var(--grid-cell-width) + ${s - 1} * var(--grid-gap))`;
    // Scale the center OK button proportionally to the ring so it grows
    // with `col_span`. Ratio chosen to reproduce the 64 px default at
    // the standard 3×3 dpad (3*50 + 2*10 = 170; 170 * 0.376 ≈ 64).
    const centerSize = `calc((${s} * var(--grid-cell-width) + ${s - 1} * var(--grid-gap)) * 0.376)`;
    return html`
      <div class="dpad-ring" style="width:${ringSize};height:${ringSize};--grc-dpad-center-size:${centerSize};">
        <div class="dpad-grid">
          ${this._renderDpadBtn('up', 'dpad-cell dpad-up')}
          ${this._renderDpadBtn('right', 'dpad-cell dpad-right')}
          ${this._renderDpadBtn('left', 'dpad-cell dpad-left')}
          ${this._renderDpadBtn('down', 'dpad-cell dpad-down')}
        </div>
        ${this._renderDpadBtn('ok', 'center-btn')}
      </div>
    `;
  }

  private _renderDpadBtn(dir: string, extraClass: string): TemplateResult {
    const btnCfg = this.item.buttons?.[dir] ?? {};
    const defaults = DPAD_DEFAULTS[dir as keyof typeof DPAD_DEFAULTS];
    const icon = btnCfg.icon ?? (btnCfg.text ? null : defaults.icon);
    const text = btnCfg.text ?? null;
    const iconColor = resolveColor(this.resolveTemplated(btnCfg.icon_color));
    const textColor = resolveColor(this.resolveTemplated(btnCfg.text_color));
    // Per-button bg override only — empty value falls back to the
    // shared `--grc-item-bg` CSS var which the card sets per page.
    const bgColor = resolveColor(this.resolveTemplated(btnCfg.background_color));
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    return html`
      <button class="remote-btn ${extraClass}" style="${style}"
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, dir)}
              @pointerup=${(e: PointerEvent) => this._onPointerUp(e, dir)}
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

// -- Editor ------------------------------------------------------------------

export function renderDpadEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  return html`
    ${DPAD_DIRS.map((dir) => {
      const isSubOpen = editor._openSubButton === `${index}-${dir}`;
      const btnCfg = item.buttons?.[dir] || {};
      const defaults = DPAD_DEFAULTS[dir];
      const icon = btnCfg.icon || defaults.icon;
      return html`
        <div class="button-item" style="margin-left:8px;">
          <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
               @click=${() => { editor._openSubButton = isSubOpen ? null : `${index}-${dir}`; }}>
            <ha-icon class="button-item-icon" .icon="${icon}"></ha-icon>
            <span class="button-item-label">${t(editor.hass, DPAD_LABELS[dir])}</span>
            <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
          </div>
          ${isSubOpen ? html`
            <div class="button-editor-slot">
              ${renderDpadBtnSubEditor(editor, item, index, dir)}
            </div>
          ` : ''}
        </div>
      `;
    })}
  `;
}

function renderDpadBtnSubEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
  dir: string,
): TemplateResult {
  const btnCfg = item.buttons?.[dir] ?? {};
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
    ${editor._renderCollapsible(`item-${index}-${dir}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderSubBtnForm(basisData, SCHEMA_BUTTON_BASIS, index, dir))}
    ${editor._renderCollapsible(`item-${index}-${dir}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderSubBtnForm(actionsData, actionsSchema, index, dir))}
  `;
}
