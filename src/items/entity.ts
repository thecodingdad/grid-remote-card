/**
 * EntityItem — an HA entity button that shows the entity's icon
 * (via `state-badge`), respects `show_state_background`, and defaults
 * to `more-info` on tap when no custom action is configured.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { GridRemoteCardEditor } from '../editor';
import type { Item } from '../types';
import { INACTIVE_STATES, VARIANT_CSS_CLASS } from '../constants';
import { resolveColor } from '../helpers';
import { t } from '../i18n';
import { ItemBase } from './base';
import {
  btnTextStyles,
  entityImgStyles,
  remoteBtnStyles,
  rippleStyles,
  variantRadiusStyles,
} from './shared-styles';

@customElement('grc-entity-item')
export class EntityItem extends ItemBase {
  static override readonly label = 'Entity button';
  static override readonly editorIcon = 'mdi:lightning-bolt-outline';
  static override readonly defaultSize = { cols: 1, rows: 1 };

  static override styles = [
    remoteBtnStyles,
    variantRadiusStyles,
    rippleStyles,
    btnTextStyles,
    entityImgStyles,
    css`
      :host { display: block; width: 100%; height: 100%; }
    `,
  ];

  /** Entity buttons inject the entity_id into the action config so HA
   *  knows the target, and default to more-info on tap when no action
   *  is configured. */
  override handleItemAction(
    actionType: string,
    _anchorEl: HTMLElement,
    _subButton: string | null,
  ): boolean {
    let actionConfig = (this.item as any)[`${actionType}_action`];
    // Default: more-info on tap if no action configured
    if (!actionConfig && this.item.entity_id && actionType === 'tap') {
      actionConfig = { action: 'more-info' };
    }
    if (!actionConfig || actionConfig.action === 'none') return true; // swallow
    // Inject entity so HA knows the target
    const config = this.item.entity_id
      ? { entity: this.item.entity_id, [`${actionType}_action`]: actionConfig }
      : { [`${actionType}_action`]: actionConfig };
    this.card._fireHassAction(config, actionType);
    return true; // handled
  }

  protected override render(): TemplateResult {
    const item = this.item;
    const entityId = item.entity_id;
    const stateObj = entityId && this.hass ? this.hass.states[entityId] : null;
    const friendlyName = stateObj?.attributes?.friendly_name || entityId || '';
    const isActive = stateObj && !INACTIVE_STATES.has(stateObj.state);
    let bgColor = resolveColor(this.resolveTemplated(item.background_color));
    if (isActive) {
      const activeBg = resolveColor(this.resolveTemplated((item as any).active_background_color));
      if (activeBg) bgColor = activeBg;
    }
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    const variantClass = VARIANT_CSS_CLASS[item.variant || 'pill'] || '';

    let content: TemplateResult;
    if (item.text) {
      const textColor = resolveColor(this.resolveTemplated(item.text_color));
      content = html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${item.text}</span>`;
    } else if (stateObj) {
      const activeIcon = resolveColor(this.resolveTemplated((item as any).active_icon_color));
      const baseIconColor = resolveColor(this.resolveTemplated(item.icon_color));
      const effectiveIconColor = (isActive && activeIcon) ? activeIcon : baseIconColor;
      content = html`<state-badge
        .hass=${this.hass}
        .stateObj=${stateObj}
        .overrideIcon=${item.icon || ''}
        .stateColor=${!effectiveIconColor}
        .color=${effectiveIconColor || undefined}
        style="--mdc-icon-size:25px;width:auto;height:auto;"
      ></state-badge>`;
    } else if (item.icon) {
      content = html`<ha-icon .icon="${item.icon}"></ha-icon>`;
    } else {
      content = html`<span class="btn-text">${friendlyName}</span>`;
    }

    return html`
      <button class="remote-btn ${variantClass}" style="${style}"
              @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, null)}
              @pointerup=${(e: PointerEvent) => this._onPointerUp(e, null)}
              @pointermove=${(e: PointerEvent) => this._onPointerMove(e)}
              @pointerleave=${(e: PointerEvent) => this._onPointerCancel(e)}
              @pointercancel=${(e: PointerEvent) => this._onPointerCancel(e)}
              @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="ripple-container"></span>
        ${content}
      </button>
    `;
  }
}

// -- Editor ------------------------------------------------------------------

export function renderEntityEditor(
  editor: GridRemoteCardEditor,
  item: Item,
  index: number,
): TemplateResult {
  const basisData = {
    variant: item.variant || 'pill',
    entity_id: item.entity_id ?? '',
    active_background_color: (item as any).active_background_color ?? '',
    active_icon_color: (item as any).active_icon_color ?? '',
    icon: item.icon ?? '',
    text: item.text ?? '',
    icon_color: item.icon_color ?? '',
    text_color: item.text_color ?? '',
    background_color: item.background_color ?? '',
  };
  const basisSchema = [
    editor._variantField(),
    { name: 'entity_id', selector: { entity: {} } },
    { name: 'icon', selector: { icon: {} } },
    { name: 'text', selector: { text: {} } },
    { name: 'icon_color', selector: { ui_color: {} } },
    { name: 'active_icon_color', selector: { ui_color: {} } },
    { name: 'text_color', selector: { ui_color: {} } },
    { name: 'background_color', selector: { ui_color: {} } },
    { name: 'active_background_color', selector: { ui_color: {} } },
  ];

  const actionsData = {
    tap_action: item.tap_action ?? {},
    hold_action: item.hold_action ?? {},
    hold_repeat: item.hold_repeat ?? false,
    hold_repeat_interval: item.hold_repeat_interval ?? '',
  };
  const actionsSchema = editor._actionFields({ hasEntity: true });

  return html`
    ${editor._renderCollapsible(`item-${index}-basis`, t(editor.hass, 'Basis'), true,
      editor._renderItemForm(basisData, basisSchema, index))}
    ${editor._renderCollapsible(`item-${index}-actions`, t(editor.hass, 'Actions'), false,
      editor._renderItemForm(actionsData, actionsSchema, index))}
  `;
}
