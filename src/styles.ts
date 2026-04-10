/**
 * Card and editor styles — kept in a dedicated module to separate visual
 * CSS from TS logic. Consumed by `GridRemoteCard` as `static styles =
 * cardStyles` and by `GridRemoteCardEditor` as `static styles = editorStyles`.
 */

import { css } from 'lit';


export const cardStyles = css`
  :host {
    --grid-cell-width: 50px;
    --grid-cell-height: 50px;
    --grid-gap: 10px;
    --remote-padding: 15px;
    --grc-item-bg:        color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    --grc-item-bg-hover:  color-mix(in srgb, var(--primary-text-color) 14%, transparent);
    --grc-item-bg-active: color-mix(in srgb, var(--primary-text-color) 20%, transparent);
    --grc-item-icon:      var(--primary-text-color);
    --grc-item-press-filter: brightness(0.85);
    --grc-dpad-center-size: 64px;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }

  ha-card {
    display: flex;
    flex-direction: column;
    padding: var(--remote-padding);
    overflow: visible;
    box-sizing: border-box;
  }

  .remote-grid {
    display: grid;
    gap: var(--grid-gap);
    justify-items: center;
    align-items: center;
    position: relative;
    flex: 1;
  }

  .grid-item {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    min-width: var(--grid-cell-width);
    min-height: var(--grid-cell-height);
  }

  .dpad-wrapper,
  .color-buttons-wrapper,
  .slider-wrapper,
  .media-wrapper { width: 100%; height: 100%; }

  .slider-wrapper { min-width: 0; overflow: visible; }

  /* Popup overlays (source + numpad) — rendered in card's shadow DOM */
  .popup-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 10;
    background: transparent;
  }
  .popup-menu {
    position: absolute;
    z-index: 11;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border-radius: var(--ha-card-border-radius, 12px);
    border-width: var(--ha-card-border-width, 1px);
    border-style: solid;
    border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    box-shadow: 0 4px 16px rgba(0,0,0,0.22);
    padding: 8px 0;
    min-width: 140px;
    max-height: calc(100% - var(--grc-popup-top, 0px) - 8px);
    overflow-x: hidden;
    overflow-y: auto;
    animation: grc-popup-in 0.15s ease-out;
    box-sizing: border-box;
  }
  @keyframes grc-popup-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .popup-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    cursor: pointer;
    transition: background 0.12s;
    border: none;
    background: none;
    width: 100%;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .popup-item:hover, .popup-item:focus-visible {
    background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
  }
  .popup-item:active { opacity: 0.7; }
  .popup-item.active {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  }
  .popup-item.active .popup-item-label {
    color: var(--primary-color);
    font-weight: 600;
  }
  .popup-item ha-icon {
    --mdc-icon-size: 22px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
  .popup-item.active ha-icon { color: var(--primary-color); }
  .popup-item-icon-wrap {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
  }
  .popup-item-img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    border-radius: 2px;
  }
  .popup-item-label {
    font-size: 14px;
    color: var(--primary-text-color);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .source-empty {
    padding: 16px;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 13px;
  }

  /* Numpad popup layout (inside shared .popup-menu) */
  .numpad-popup {
    padding: 8px;
  }
  .numpad-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .numpad-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 40px;
    border-radius: 8px;
    background: var(--grc-item-bg);
    color: var(--grc-item-icon);
    font-size: 18px;
    font-weight: 500;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    position: relative;
    overflow: hidden;
  }
  .numpad-btn:hover {
    background: var(--grc-item-bg-hover);
  }
  .numpad-btn:active {
    background: var(--grc-item-bg-active);
  }
  .numpad-dash, .numpad-enter {
    font-size: 14px;
  }

  /* Multi-page */
  .page-container {
    overflow: hidden;
    position: relative;
    touch-action: pan-y;
    flex: 1;
  }
  .page-track {
    display: flex;
    transition: transform 0.3s ease;
    height: 100%;
  }
  .page-track > .remote-grid {
    flex: 0 0 100%;
    min-width: 0;
  }
  .page-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 8px 0 2px;
  }
  .page-dot {
    all: unset;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary-text-color) 25%, transparent);
    cursor: pointer;
    transition: background 0.2s;
  }
  .page-dot.active {
    background: var(--primary-color);
  }
  .page-dot:hover {
    background: color-mix(in srgb, var(--primary-color) 60%, transparent);
  }
  .page-dot.conditional {
    border: 1.5px solid var(--primary-color);
  }
`;

export const editorStyles = css`
  :host { display: block; }

  .slider-input-row {
    margin-bottom: 8px;
  }
  .slider-input-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--primary-text-color);
    margin-bottom: 2px;
  }
  .slider-input-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .slider-input-controls ha-slider {
    flex: 1;
  }
  .slider-input-controls ha-textfield {
    flex: 0 0 auto;
  }
  .slider-input-helper {
    font-size: 11px;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .visual-selector-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color, #727272);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    margin: 14px 0 6px;
  }
  .visual-selector-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .visual-option {
    flex: 1;
    min-width: 70px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 8px 8px;
    border: 2px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 12px;
    cursor: pointer;
    background: transparent;
    transition: border-color 0.15s, background 0.15s;
    position: relative;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .visual-option input[type="radio"] {
    position: absolute;
    top: 8px;
    left: 8px;
    margin: 0;
    accent-color: var(--primary-color, #03a9f4);
    pointer-events: none;
  }
  .visual-option.selected {
    border-color: var(--primary-color, #03a9f4);
    background: color-mix(in srgb, var(--primary-color, #03a9f4) 8%, transparent);
  }
  .visual-preview {
    color: var(--secondary-text-color, #727272);
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .visual-option.selected .visual-preview {
    color: var(--primary-color, #03a9f4);
  }
  .visual-option-label {
    font-size: 12px;
    color: var(--primary-text-color, #212121);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
    margin-bottom: 16px;
  }
  .tab {
    flex: 1;
    padding: 10px 4px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    font-family: var(--mdc-typography-button-font-family, Roboto, sans-serif);
    font-size: var(--mdc-typography-button-font-size, 13px);
    font-weight: var(--mdc-typography-button-font-weight, 500);
    color: var(--secondary-text-color, #727272);
    transition: color 150ms, border-color 150ms;
    text-transform: var(--mdc-typography-button-text-transform, uppercase);
    letter-spacing: var(--mdc-typography-button-letter-spacing, 0.0892857143em);
    -webkit-tap-highlight-color: transparent;
  }
  .tab.active {
    color: var(--primary-color, #03a9f4);
    border-bottom-color: var(--primary-color, #03a9f4);
  }
  .tab-panel        { display: none; }
  .tab-panel.active { display: block; }

  /* Expansion panels */
  ha-expansion-panel {
    margin-bottom: 8px;
  }
  ha-expansion-panel[expanded] {
    --expansion-panel-content-padding: 8px;
  }

  /* Button items */
  .button-item {
    border: 1px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 8px;
    margin-bottom: 4px;
    overflow: hidden;
  }
  .button-item-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .button-item-header:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.04));
  }
  .button-item-header.editor-open {
    border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
  }
  .button-item-icon {
    --mdc-icon-size: 18px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
  .button-item-label {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--primary-text-color);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }
  .button-item-chevron {
    --mdc-icon-size: 18px;
    color: var(--secondary-text-color);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .button-item-chevron.open { transform: rotate(90deg); }
  .button-editor-slot { padding: 8px 12px 12px; }
  .action-field { margin-top: 8px; }

  /* Grid editor */
  .grid-editor-container {
    border: 1px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    display: flex;
    justify-content: center;
    position: relative;
  }
  .grid-editor {
    display: grid;
    gap: 4px;
    position: relative;
    touch-action: none;
  }
  .grid-bg-cell {
    border: 1px dashed color-mix(in srgb, var(--primary-text-color) 15%, transparent);
    border-radius: 4px;
    min-height: 0;
  }
  .grid-bg-cell.highlight.valid {
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    border-color: var(--primary-color);
    border-style: solid;
  }
  .grid-bg-cell.highlight.invalid {
    background: color-mix(in srgb, var(--error-color, #f44336) 20%, transparent);
    border-color: var(--error-color, #f44336);
    border-style: solid;
  }
  .grid-bg-cell.highlight.swap {
    background: color-mix(in srgb, var(--warning-color, #ff9800) 20%, transparent);
    border-color: var(--warning-color, #ff9800);
    border-style: dashed;
  }
  .grid-editor-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    border: 2px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 1;
    color: var(--primary-text-color);
  }
  .grid-editor-item.selected {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
  }
  .grid-editor-item.dragging {
    opacity: 0.7;
    cursor: grabbing;
    z-index: 10;
  }
  .grid-editor-item.type-dpad { border-radius: 50%; }
  .grid-editor-item.type-color_buttons { border-radius: 6px; }
  .grid-editor-item ha-icon {
    --mdc-icon-size: 20px;
    pointer-events: none;
  }
  .grid-item-text {
    font-size: 9px;
    font-weight: 600;
    pointer-events: none;
    text-align: center;
    line-height: 1.2;
    padding: 2px;
  }
  .grid-item-delete {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--error-color, #f44336);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 2;
    padding: 0;
  }
  .grid-editor-item:hover .grid-item-delete { opacity: 1; }

  .drag-trash-zone {
    display: none;
    align-items: center;
    justify-content: center;
    height: 40px;
    margin-top: 6px;
    border: 2px dashed var(--error-color, #f44336);
    border-radius: 8px;
    color: var(--error-color, #f44336);
    opacity: 0.6;
    transition: opacity 0.15s, background 0.15s;
  }
  .drag-trash-zone.visible { display: flex; }
  .drag-trash-zone.hover {
    opacity: 1;
    background: color-mix(in srgb, var(--error-color, #f44336) 15%, transparent);
  }
  .clear-all-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 4px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid color-mix(in srgb, var(--error-color, #f44336) 30%, transparent);
    border-radius: 6px;
    color: var(--error-color, #f44336);
    cursor: pointer;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .clear-all-btn:hover { opacity: 1; }
  .preset-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    flex-wrap: wrap;
  }
  .preset-label {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .preset-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--divider-color);
    border-radius: 16px;
    background: none;
    color: var(--primary-text-color);
    cursor: pointer;
    font-size: 12px;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }
  .preset-btn:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.04));
  }
  .preset-form {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    padding: 10px 12px;
    gap: 10px;
  }
  .preset-form-label {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }
  .preset-apply-btn, .preset-cancel-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    white-space: nowrap;
  }
  .preset-apply-btn {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }
  .preset-apply-btn[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  .preset-cancel-btn {
    background: none;
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color);
  }
  .add-item-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .add-item-label {
    font-size: 12px;
    color: var(--secondary-text-color);
    margin-right: 4px;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }
  .add-type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 10px;
    background: none;
    border: 1px dashed var(--divider-color, rgba(0,0,0,.2));
    border-radius: 8px;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    touch-action: none;
  }
  .add-type-btn:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.04));
  }
  .add-type-btn-label {
    pointer-events: none;
  }

  /* Button editor below grid */
  .button-editor-below {
    border: 1px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 8px;
    margin-top: 12px;
    padding: 12px;
    overflow: hidden;
  }
  .button-editor-below-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--primary-text-color);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }
  .button-editor-below-header ha-icon {
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }
  .button-editor-below-header span { flex: 1; }
  .yaml-toggle-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--secondary-text-color); border-radius: 4px; display: flex; align-items: center;
  }
  .yaml-toggle-btn:hover { color: var(--primary-color); }
  .yaml-toggle-btn.active { color: var(--primary-color); }
  .item-yaml-editor { margin-top: 8px; }
  .item-yaml-editor ha-code-editor { display: block; }

  /* Source config */
  .source-entity-hint {
    font-size: 12px;
    color: var(--secondary-text-color);
    margin: 8px 0 4px;
    line-height: 1.4;
  }
  .source-list { position: relative; }
  .source-item-editor {
    border: 1px solid var(--divider-color, rgba(0,0,0,.12));
    border-radius: 8px;
    margin-bottom: 4px;
    overflow: hidden;
    transition: transform 0.15s ease, opacity 0.15s ease;
  }
  .source-item-editor.hidden-source { opacity: 0.45; }
  .source-item-editor.hidden-source .source-item-label { text-decoration: line-through; }
  .source-item-editor.dragging {
    opacity: 0.7;
    background: color-mix(in srgb, var(--primary-color) 8%, var(--card-background-color, #fff));
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 1;
    position: relative;
  }
  .drag-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    flex-shrink: 0;
    color: var(--secondary-text-color);
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  .drag-handle:active { cursor: grabbing; }
  .source-item-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 6px 4px;
  }
  .source-item-header.editor-open {
    border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12));
  }
  .source-item-label {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--primary-text-color);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .source-item-editor-slot { padding: 8px 12px 12px; }
  .source-item-auto-badge {
    font-size: 10px;
    color: var(--secondary-text-color);
    background: var(--secondary-background-color, rgba(0,0,0,.06));
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--secondary-text-color, #727272);
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.06));
    color: var(--primary-text-color);
  }
  .icon-btn.delete-btn { color: var(--error-color, #f44336); }
  .icon-btn.delete-btn:hover { color: var(--error-color, #f44336); }
  .add-btn {
    width: 100%;
    margin-top: 4px;
    padding: 10px;
    background: none;
    border: 1px dashed var(--divider-color, rgba(0,0,0,.2));
    border-radius: 8px;
    color: var(--primary-color, #03a9f4);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--mdc-typography-button-font-family, Roboto, sans-serif);
    font-weight: 500;
    letter-spacing: var(--mdc-typography-button-letter-spacing, 0.0892857143em);
  }
  .add-btn:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.04));
  }

  /* Page tabs */
  .page-tabs-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .page-tab {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    padding: 4px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    color: var(--primary-text-color);
    position: relative;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .page-tab.active {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }
  .page-tab:hover:not(.active) {
    background: color-mix(in srgb, var(--primary-text-color) 14%, transparent);
  }
  .page-tab-add {
    font-size: 16px;
    font-weight: 700;
    padding: 2px 10px;
  }
  .page-tab-delete {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    opacity: 0.6;
    cursor: pointer;
  }
  .page-tab-delete:hover { opacity: 1; }
  .page-condition-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--secondary-text-color);
    background: none;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    padding: 4px 10px;
    cursor: pointer;
    margin-bottom: 8px;
    transition: background 0.2s, border-color 0.2s;
    font-family: inherit;
  }
  .page-condition-btn:hover {
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
  }
  .page-condition-btn.active {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;
