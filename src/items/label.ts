/**
 * LabelItem — non-interactive text label, used to caption the remote
 * (e.g. brand / room / device name). Looks like text printed on the
 * remote surface: no background, no border, no hover/press feedback.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';

interface FontEntry {
  value: string;    // CSS font-family stack persisted to config
  label: string;    // shown in the editor dropdown
}

// 10 widely-available system fonts. Values hold only the chosen family
// name; render-time appends the card's default font as a single shared
// fallback so any unavailable face renders identically to "no font set".
const FONT_FAMILIES_BASE: FontEntry[] = [
  { value: 'Arial',            label: 'Arial' },
  { value: 'Helvetica',        label: 'Helvetica' },
  { value: 'Verdana',          label: 'Verdana' },
  { value: 'Tahoma',           label: 'Tahoma' },
  { value: '"Trebuchet MS"',   label: 'Trebuchet MS' },
  { value: 'Impact',           label: 'Impact' },
  { value: '"Times New Roman"',label: 'Times New Roman' },
  { value: 'Georgia',          label: 'Georgia' },
  { value: '"Courier New"',    label: 'Courier New' },
  { value: '"Comic Sans MS"',  label: 'Comic Sans MS' },
];

const LABEL_FALLBACK_FONT = 'var(--mdc-typography-font-family, Roboto, sans-serif)';

@customElement('grc-label-item')
export class LabelItem extends ItemBase {
  static override readonly label = 'Label';
  static override readonly editorIcon = 'mdi:format-text';
  static override readonly defaultSize = { cols: 2, rows: 1 };

  static override styles = [
    css`
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
      }
      /* Absolute-positioned so multi-line content can't push the grid
         track taller than the cell — it scrolls/clips inside the host
         instead of inflating the row height. */
      .label-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
        font-size: 14px;
        font-weight: 500;
        color: var(--grc-label-color, var(--grc-item-text, var(--primary-text-color)));
        text-shadow: var(--grc-label-shadow, none);
        text-align: center;
        white-space: nowrap;
        text-overflow: ellipsis;
        letter-spacing: 0.05em;
        line-height: 1.15;
        padding: 0 4px;
        box-sizing: border-box;
      }
    `,
  ];

  protected override render(): TemplateResult {
    const item = this.item;
    const cfg = this.card._config;
    const textColor = resolveColor(item.text_color || cfg.text_color || '');
    const fontFamily = (item as any).font_family || '';
    const fontSize = (item as any).font_size;
    const multiLine = !!(item as any).multi_line;
    const styleParts: string[] = [];
    if (textColor) styleParts.push(`color:${textColor}`);
    if (fontFamily) styleParts.push(`font-family:${fontFamily}, ${LABEL_FALLBACK_FONT}`);
    if (fontSize) styleParts.push(`font-size:${fontSize}px`);
    if (multiLine) styleParts.push('white-space:normal', 'text-overflow:clip');
    return html`<span class="label-text" style="${styleParts.join(';')}">${item.text ?? ''}</span>`;
  }
}

// -- Editor ------------------------------------------------------------------

export function renderLabelEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const fontOptions = FONT_FAMILIES_BASE.map(o => ({ value: o.value, label: o.label }));

  const basisData = {
    text: item.text ?? '',
    text_color: item.text_color ?? '',
    font_family: (item as any).font_family ?? '',
    font_size: (item as any).font_size ?? 14,
    multi_line: !!(item as any).multi_line,
  };
  const basisSchema = [
    { name: 'text', selector: { text: {} }, helper: '' },
    { name: 'text_color', selector: { ui_color: {} } },
    {
      name: 'font_family',
      selector: { select: { mode: 'dropdown', custom_value: true, options: fontOptions } },
      helper: 'Pick a system font or type a custom font-family stack',
    },
    {
      name: 'font_size',
      selector: { number: { min: 6, max: 25, step: 1, mode: 'slider', unit_of_measurement: 'px' } },
    },
    { name: 'multi_line', selector: { boolean: {} } },
  ];
  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
  `;
}
