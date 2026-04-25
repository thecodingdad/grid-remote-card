/**
 * LabelItem — a passive text label for annotating the remote grid.
 * No actions, no button chrome. Renders centered text like text
 * printed on a physical remote.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';

@customElement('grc-label-item')
export class LabelItem extends ItemBase {
  static override readonly label = 'Label';
  static override readonly editorIcon = 'mdi:format-text';
  static override readonly defaultSize = { cols: 1, rows: 1 };

  static override styles = [
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .label {
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: var(--grc-item-text, var(--primary-text-color));
        text-align: center;
        user-select: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        opacity: 0.55;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const textColor = resolveColor(this.item.text_color || this.card._config.text_color || '');
    return html`
      <span class="label" style="${textColor ? `color:${textColor}` : ''}">
        ${this.item.text || ''}
      </span>
    `;
  }
}

// -- Editor ------------------------------------------------------------------

export function renderLabelEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const data = {
    text: item.text ?? '',
    text_color: item.text_color ?? '',
  };
  const schema = [
    { name: 'text', selector: { text: {} } },
    { name: 'text_color', selector: { ui_color: {} } },
  ];
  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(data, schema, index))}
  `;
}
