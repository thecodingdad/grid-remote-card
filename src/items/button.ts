/**
 * ButtonItem — the generic action button. Used for the majority of
 * remote keys. Renders a `<button class="remote-btn">` with icon or text
 * content and handles all tap/hold semantics through the shared
 * ItemBase pointer machinery.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { VARIANT_CSS_CLASS } from '../constants';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';
import {
  btnTextStyles,
  remoteBtnStyles,
  rippleStyles,
  variantRadiusStyles,
} from './shared-styles';

@customElement('grc-button-item')
export class ButtonItem extends ItemBase {
  static override readonly label = 'Button';
  static override readonly editorIcon = 'mdi:circle-outline';
  static override readonly defaultSize = { cols: 1, rows: 1 };
  static override readonly defaultIcon = 'mdi:radiobox-blank';

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
      .btn-image {
        max-width: 70%;
        max-height: 70%;
        object-fit: contain;
        pointer-events: none;
        position: relative;
        z-index: 1;
      }
      .btn-image.fill {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        object-fit: cover;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const item = this.item;
    const text = item.text ?? null;
    const imageUrl = item.image || '';
    const showImage = !text && !!imageUrl;
    const icon = item.icon ?? (text || showImage ? null : ButtonItem.defaultIcon);
    const showIcon = !text && !showImage && !!icon;
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
        ${text != null
          ? html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text || ''}</span>`
          : showImage
            ? html`<img class="btn-image ${item.image_fill ? 'fill' : ''}" src="${imageUrl}" alt="">`
            : showIcon
              ? html`<ha-icon .icon="${icon!}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
              : ''}
      </button>
    `;
  }
}

// -- Editor ------------------------------------------------------------------

/** Button editor — one ha-form per collapsible, variant at top of Basis. */
export function renderButtonEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const basisData = {
    variant: item.variant || 'pill',
    icon: item.icon ?? '',
    image: item.image ?? '',
    image_fill: !!item.image_fill,
    text: item.text ?? '',
    icon_color: item.icon_color ?? '',
    text_color: item.text_color ?? '',
    background_color: item.background_color ?? '',
  };
  const basisSchema = [
    editor._variantField(),
    { name: 'icon',  selector: { icon: {} } },
    { name: 'image', selector: { text: {} } },
    ...(item.image ? [{ name: 'image_fill', selector: { boolean: {} } }] : []),
    { name: 'text',  selector: { text: {} } },
    { name: 'icon_color', selector: { ui_color: {} } },
    { name: 'text_color', selector: { ui_color: {} } },
    { name: 'background_color', selector: { ui_color: {} } },
  ];

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
  `;
}
