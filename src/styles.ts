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
    --grc-page-gap: calc(2 * var(--remote-padding));
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
    position: relative;
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
    border-color: var(--grc-remote-border, var(--ha-card-border-color, var(--divider-color, #e0e0e0)));
    box-shadow: 0 4px 16px rgba(0,0,0,0.22);
    padding: 8px;
    min-width: 140px;
    max-height: 80vh;
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
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.12s, filter 0.15s, transform 0.08s;
    border: none;
    background-color: var(--grc-item-bg);
    background-image: var(--grc-btn-bg-overlay, none);
    width: 100%;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .popup-item:hover, .popup-item:focus-visible {
    background-color: color-mix(in srgb, var(--primary-text-color) 10%, var(--grc-item-bg));
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
    color: var(--grc-popup-icon-color, var(--secondary-text-color));
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
    color: var(--grc-popup-text-color, var(--primary-text-color));
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
  .source-popup-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .source-popup-list .popup-item {
    border-radius: 9999px;
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
    background-color: var(--grc-item-bg);
    background-image: var(--grc-btn-bg-overlay, none);
    color: var(--grc-item-icon);
    font-size: 18px;
    font-weight: 500;
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
    transition: filter 0.15s, transform 0.08s;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    position: relative;
    overflow: hidden;
  }
  .numpad-btn:hover {
    background-color: color-mix(in srgb, var(--primary-text-color) 10%, var(--grc-item-bg));
  }
  .numpad-btn:active {
    background-color: color-mix(in srgb, var(--primary-text-color) 18%, var(--grc-item-bg));
  }
  .numpad-dash, .numpad-enter {
    font-size: 14px;
  }

  /* Multi-page */
  .page-container {
    overflow: hidden;
    clip-path: inset(0 calc(var(--grc-page-gap, 0px) / -2) -20px calc(var(--grc-page-gap, 0px) / -2));
    position: relative;
    touch-action: pan-y;
    flex: 1;
    margin: calc(-1 * var(--remote-padding));
    padding: var(--remote-padding);
  }
  .page-track {
    display: flex;
    transition: transform 0.3s ease;
    height: 100%;
    gap: var(--grc-page-gap, 0px);
  }
  .page-track > .remote-grid {
    flex: 0 0 100%;
    min-width: 0;
  }
  .page-dots {
    position: relative;
    z-index: 2;
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

  /* 3D style — enabled when card has .style-3d class. Properties cascade
     into item shadow DOMs via custom properties (gradient, shadows, filters). */
  ha-card.style-3d {
    /* Use rgba overlays layered on top of the item's background-color
       (set via --grc-btn-bg). A gradient whose colour stops referenced
       var(--grc-btn-bg) would not pick up per-button overrides because
       custom-property var() substitution is resolved at declaration
       scope, not at use site. Painting an additive overlay on top of
       the background-color side-steps this. */
    /* Convex plastic-button look:
       - Linear top-to-bottom overlay for ambient light (bright rim top,
         soft shadow pool bottom).
       - Radial hotspot near top-centre for the "specular" highlight.
       - Outer shadow uses a slightly-blurred solid ring (socket gap to
         the remote housing) plus a short drop shadow for contact shadow.
       - Inset top/bottom bevel gives the button its curvature.
       Edges blurred just enough to look molded (not laser-cut). */
    --grc-btn-bg-overlay:
      linear-gradient(to bottom,
        rgba(255, 255, 255, 0.2) 0%,
        rgba(255, 255, 255, 0.05) 25%,
        rgba(255, 255, 255, 0) 60%,
        rgba(0, 0, 0, 0.1) 85%,
        rgba(0, 0, 0, 0.2) 100%),
      radial-gradient(ellipse 80% 25% at 50% 10%,
        rgba(255, 255, 255, 0.1) 0%,
        transparent 70%);
    --grc-btn-bg-overlay-active: linear-gradient(to bottom,
      rgba(0, 0, 0, 0.25) 0%,
      rgba(0, 0, 0, 0.12) 100%);
    --grc-btn-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      inset 0 -1px 2px rgba(0, 0, 0, 0.25),
      0 0 1.5px 1.5px rgba(0, 0, 0, 0.75),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 3px 4px rgba(0, 0, 0, 0.42);
    --grc-btn-shadow-active:
      inset 0 3px 5px rgba(0, 0, 0, 0.4),
      inset 0 1px 1px rgba(0, 0, 0, 0.25),
      0 0 1.5px 1.5px rgba(0, 0, 0, 0.75),
      0 1px 2px rgba(0, 0, 0, 0.3);
    --grc-btn-hover-filter: brightness(1.08);
    --grc-btn-active-transform: translateY(1px);
    /* DPad cells rotate 45°; diagonal linear gradient keeps the light
       direction consistent across cells after rotation. */
    --grc-dpad-cell-overlay: linear-gradient(165deg,
      rgba(255, 255, 255, 0.14) 0%,
      rgba(255, 255, 255, 0.03) 35%,
      transparent 65%,
      rgba(0, 0, 0, 0.12) 100%);
    --grc-dpad-cell-overlay-active: linear-gradient(165deg,
      rgba(0, 0, 0, 0.18) 0%,
      rgba(0, 0, 0, 0.28) 100%);
    /* Slider track and fill share the same button look and socket ring
       so they read as part of the same physical surface. */
    --grc-slider-track-overlay: linear-gradient(to bottom,
      rgba(255, 255, 255, 0.16) 0%,
      rgba(255, 255, 255, 0.04) 30%,
      rgba(255, 255, 255, 0) 60%,
      rgba(0, 0, 0, 0.12) 85%,
      rgba(0, 0, 0, 0.2) 100%);
    --grc-slider-track-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      inset 0 -1px 2px rgba(0, 0, 0, 0.25),
      0 0 1.5px 1.5px rgba(0, 0, 0, 0.75),
      0 1px 0 rgba(255, 255, 255, 0.04),
      0 3px 4px rgba(0, 0, 0, 0.42);
    --grc-slider-fill-overlay: linear-gradient(to bottom,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.06) 30%,
      rgba(255, 255, 255, 0) 60%,
      rgba(0, 0, 0, 0.12) 85%,
      rgba(0, 0, 0, 0.22) 100%);
    --grc-slider-fill-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      inset 0 -1px 2px rgba(0, 0, 0, 0.22);
  }
  ha-card.style-3d {
    background: linear-gradient(145deg,
      color-mix(in srgb, var(--grc-card-bg, var(--card-background-color, var(--ha-card-background, #222))) 100%, white 3%),
      color-mix(in srgb, var(--grc-card-bg, var(--card-background-color, var(--ha-card-background, #222))) 100%, black 6%));
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 10px 24px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  ha-card.style-3d .numpad-btn,
  ha-card.style-3d .popup-item {
    box-shadow: var(--grc-btn-shadow);
  }
  ha-card.style-3d .numpad-btn:hover,
  ha-card.style-3d .popup-item:hover {
    filter: brightness(1.1);
  }
  ha-card.style-3d .numpad-btn:active,
  ha-card.style-3d .popup-item:active {
    background-image: var(--grc-btn-bg-overlay-active, var(--grc-btn-bg-overlay, none));
    box-shadow: var(--grc-btn-shadow-active);
    transform: translateY(1px);
  }
`;

export const editorStyles = css`
  :host { display: block; }

  .grid-size-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .grid-size-row .grid-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--primary-text-color);
    min-width: 48px;
  }
  .grid-size-row .axis-label {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .axis-stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    overflow: hidden;
    height: 38px;
  }
  .axis-stepper button {
    all: unset;
    cursor: pointer;
    width: 34px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--primary-text-color);
  }
  .axis-stepper button[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  .axis-stepper button:not([disabled]):hover {
    background: var(--secondary-background-color, rgba(0,0,0,.05));
  }
  .axis-stepper .num {
    min-width: 40px;
    text-align: center;
    font-size: 15px;
    border-left: 1px solid var(--divider-color);
    border-right: 1px solid var(--divider-color);
    height: 38px;
    line-height: 38px;
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
    min-height: 150px;
    align-items: center;
  }
  .grid-editor {
    display: grid;
    gap: 4px;
    position: relative;
    touch-action: none;
    height: fit-content;
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
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
    z-index: 1;
    color: var(--primary-text-color);
  }
  .grid-editor-item.selected {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
  }
  .grid-editor-item.multi-selected {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 20%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 40%, transparent);
  }
  .grid-editor-item.dragging {
    opacity: 0.7;
    cursor: grabbing;
    z-index: 10;
  }
  .grid-editor-item.dragging-source {
    opacity: 0.3;
  }
  .drag-ghost-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
  }
  .drag-ghost {
    opacity: 0.85;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    transition: none;
  }
  .marquee {
    position: absolute;
    border: 1px dashed var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
    pointer-events: none;
    z-index: 5;
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

  .canvas-icon-stack {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .canvas-icon-stack .template-btn,
  .canvas-icon-stack .conditions-btn {
    opacity: 1;
    transform: scale(1);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .canvas-icon-stack.drag-mode .template-btn,
  .canvas-icon-stack.drag-mode .conditions-btn {
    opacity: 0;
    transform: scale(0.6);
    pointer-events: none;
  }
  .canvas-icon-btn {
    all: unset;
    cursor: pointer;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color);
    color: var(--primary-text-color);
    position: relative;
    transform-origin: top right;
    transition: opacity 0.15s, transform 0.15s, border-color 0.15s, background 0.15s;
  }
  .canvas-icon-btn:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.05));
  }
  .canvas-icon-btn.clear-all-btn {
    color: var(--error-color, #f44336);
    border-color: color-mix(in srgb, var(--error-color, #f44336) 30%, transparent);
  }
  .canvas-icon-btn.clear-all-btn:hover { opacity: 1; }
  .canvas-icon-btn.clear-all-btn.drop-target-active {
    opacity: 1;
    transform: scale(1.6);
    border-color: var(--error-color, #f44336);
  }
  .canvas-icon-btn.clear-all-btn.drop-target-active ha-icon { --mdc-icon-size: 22px; }
  .canvas-icon-btn.clear-all-btn.hover {
    background: color-mix(in srgb, var(--error-color, #f44336) 25%, transparent);
    transform: scale(1.8);
  }
  .canvas-icon-btn.conditions-btn.has-dot::after {
    content: '';
    position: absolute;
    right: -3px;
    top: -3px;
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
    border: 1.5px solid var(--card-background-color, #fff);
  }
  .template-menu {
    position: absolute;
    top: 0;
    right: 40px;
    min-width: 200px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 4px;
    z-index: 10;
  }
  .template-menu .tpl-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    color: var(--primary-text-color);
    font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
  }
  .template-menu .tpl-item:hover {
    background: var(--secondary-background-color, rgba(0,0,0,.05));
  }
  .preset-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 320px;
  }
  .preset-confirm-text {
    font-size: 16px;
    color: var(--primary-text-color);
    line-height: 1.5;
    padding: 8px 4px;
  }
  .preset-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  ha-button.destructive {
    --primary-color: var(--error-color, #f44336);
    --mdc-theme-primary: var(--error-color, #f44336);
  }
  .add-item-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .add-item-label {
    display: block;
    font-size: 12px;
    color: var(--secondary-text-color);
    margin-top: 12px;
    margin-bottom: 4px;
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
  .page-tab.drop-target {
    outline: 2px dashed var(--primary-color);
    outline-offset: 2px;
    background: color-mix(in srgb, var(--primary-color) 30%, transparent);
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
`;
