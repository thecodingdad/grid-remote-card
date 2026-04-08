/**
 * Grid Remote Card for Home Assistant
 * =============================================
 * v1.0.0
 *
 * A fully customizable TV remote control card with configurable grid layout,
 * drag-and-drop button placement, multiple button types, source popup,
 * and full visual editor.
 */

const VERSION = '1.0.0';

const { t } = await import(`./i18n/index.js?v=${VERSION}`);

// -- LitElement from HA bundle ------------------------------------------------

const LitElement = Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
const { html, css } = LitElement.prototype;

// -- Helpers ------------------------------------------------------------------

/** Resolve HA ui_color names (e.g. "deep-purple") to CSS color values */
function resolveColor(value) {
  if (!value) return '';
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.startsWith('var(')) return value;
  return `var(--${value}-color, ${value})`;
}

/** States considered "inactive" for entity toggle background */
const INACTIVE_STATES = new Set(['off', 'unavailable', 'unknown', 'idle', 'standby', 'closed', 'not_home', 'below_horizon', 'docked', 'not_running']);

/** Auto-detect slider config based on entity domain */
function getSliderDefaults(entityId, stateObj) {
  if (!entityId || !stateObj) return null;
  const domain = entityId.split('.')[0];
  const attr = stateObj.attributes || {};
  switch (domain) {
    case 'light': return { attribute: 'brightness', service: 'light.turn_on', service_field: 'brightness', min: 0, max: 255, step: 1, icon: 'mdi:brightness-6' };
    case 'media_player': return { attribute: 'volume_level', service: 'media_player.volume_set', service_field: 'volume_level', min: 0, max: 1, step: 0.01, icon: 'mdi:volume-high' };
    case 'cover': return { attribute: 'current_position', service: 'cover.set_cover_position', service_field: 'position', min: 0, max: 100, step: 1, icon: 'mdi:window-shutter' };
    case 'fan': return { attribute: 'percentage', service: 'fan.set_percentage', service_field: 'percentage', min: 0, max: 100, step: 1, icon: 'mdi:fan' };
    case 'input_number': case 'number': return { attribute: null, service: `${domain}.set_value`, service_field: 'value', min: attr.min ?? 0, max: attr.max ?? 100, step: attr.step ?? 1, icon: 'mdi:numeric' };
    default: return { attribute: null, service: null, service_field: null, min: 0, max: 100, step: 1, icon: 'mdi:tune-variant' };
  }
}

// -- Constants ----------------------------------------------------------------

const HOLD_DELAY_MS = 500;
const DOUBLE_TAP_MS = 250;
const DEFAULT_REPEAT_INTERVAL_MS = 200;

const ITEM_SIZES = {
  dpad:          { cols: 3, rows: 3 },
  color_buttons: { cols: 3, rows: 1 },
  slider:        { cols: 3, rows: 1 },
  media:         { cols: 3, rows: 2 },
  button:        { cols: 1, rows: 1 },
  source:        { cols: 1, rows: 1 },
  numbers:       { cols: 1, rows: 1 },
  entity:        { cols: 1, rows: 1 },
};

function _getItemSize(item) {
  const base = ITEM_SIZES[item.type] || { cols: 1, rows: 1 };
  if (item.type === 'dpad') {
    const s = item.col_span || base.cols;
    return { cols: s, rows: s }; // dpad always square
  }
  if (item.type === 'slider') {
    if (item.orientation === 'vertical') return { cols: 1, rows: item.row_span || base.cols };
    return { cols: item.col_span || base.cols, rows: 1 };
  }
  if (item.type === 'color_buttons') {
    return { cols: item.col_span || base.cols, rows: 1 };
  }
  return {
    cols: item.col_span || base.cols,
    rows: item.row_span || base.rows,
  };
}

const ITEM_TYPES = Object.keys(ITEM_SIZES);

const ITEM_VARIANTS = ['round', 'rounded', 'square', 'pill', 'pill_top', 'pill_bottom', 'pill_left', 'pill_right'];
const BUTTON_VARIANTS = ITEM_VARIANTS;
const SLIDER_VARIANTS = [...ITEM_VARIANTS, 'classic'];

const VARIANT_LABELS = {
  round:       'Round',
  rounded:     'Rounded',
  square:      'Square',
  pill:        'Pill',
  pill_top:    'Pill top',
  pill_bottom: 'Pill bottom',
  pill_left:   'Pill left',
  pill_right:  'Pill right',
  classic:     'Classic',
};

const VARIANT_CSS_CLASS = {
  round:       'round',
  rounded:     'rounded',
  square:      'square',
  pill:        'pill',
  pill_top:    'pill-top',
  pill_bottom: 'pill-bottom',
  pill_left:   'pill-left',
  pill_right:  'pill-right',
};

const TYPE_LABELS = {
  dpad:          'D-Pad',
  color_buttons: 'Color buttons',
  slider:        'Slider',
  media:         'Media info',
  button:        'Button',
  source:        'Source button',
  numbers:       'Number pad',
  entity:        'Entity button',
};

const TYPE_EDITOR_ICONS = {
  dpad:          'mdi:gamepad-variant-outline',
  color_buttons: 'mdi:palette',
  slider:        'mdi:tune-variant',
  media:         'mdi:music-box-outline',
  button:        'mdi:circle-outline',
  source:        'mdi:import',
  numbers:       'mdi:dialpad',
  entity:        'mdi:lightning-bolt-outline',
};

const TYPE_DEFAULT_ICONS = {
  button: 'mdi:radiobox-blank',
  source: 'mdi:import',
  numbers: 'mdi:dialpad',
};

const DPAD_DEFAULTS = {
  up:    { icon: 'mdi:chevron-up' },
  down:  { icon: 'mdi:chevron-down' },
  left:  { icon: 'mdi:chevron-left' },
  right: { icon: 'mdi:chevron-right' },
  ok:    { icon: 'mdi:circle-outline' },
};

const DPAD_DIRS = ['up', 'down', 'left', 'right', 'ok'];

const DPAD_LABELS = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'OK',
};

const COLOR_BUTTON_KEYS = ['red', 'green', 'yellow', 'blue'];

const COLOR_BUTTON_DEFAULTS = {
  red:    { color: '#f44336' },
  green:  { color: '#4caf50' },
  yellow: { color: '#ffeb3b' },
  blue:   { color: '#6d9eeb' },
};

const COLOR_BUTTON_LABELS = {
  red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue',
};

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','dash','0','enter'];

const NUMPAD_LABELS = {
  '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','0':'0',
  dash: '-/--', enter: 'Enter',
};

const NUMPAD_DISPLAY = {
  '1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','0':'0',
  dash: '-/--',
};

const DEFAULT_ITEMS = [
  { type: 'button', row: 0, col: 0, icon: 'mdi:power' },
  { type: 'numbers', row: 0, col: 1, icon: 'mdi:dialpad' },
  { type: 'source', row: 0, col: 2, icon: 'mdi:import' },
  { type: 'dpad', row: 1, col: 0 },
  { type: 'button', row: 4, col: 0, icon: 'mdi:arrow-u-left-top' },
  { type: 'button', row: 4, col: 1, icon: 'mdi:home' },
  { type: 'button', row: 4, col: 2, icon: 'mdi:menu' },
  { type: 'button', row: 5, col: 0, icon: 'mdi:rewind', hold_repeat: true },
  { type: 'button', row: 5, col: 1, icon: 'mdi:play-pause' },
  { type: 'button', row: 5, col: 2, icon: 'mdi:fast-forward', hold_repeat: true },
  { type: 'button', variant: 'pill_top', row: 6, col: 0, icon: 'mdi:plus', hold_repeat: true },
  { type: 'button', row: 6, col: 1, text: 'GUIDE' },
  { type: 'button', variant: 'pill_top', row: 6, col: 2, icon: 'mdi:chevron-up', hold_repeat: true },
  { type: 'button', variant: 'pill_bottom', row: 7, col: 0, icon: 'mdi:minus', hold_repeat: true },
  { type: 'button', row: 7, col: 1, icon: 'mdi:volume-off' },
  { type: 'button', variant: 'pill_bottom', row: 7, col: 2, icon: 'mdi:chevron-down', hold_repeat: true },
  { type: 'color_buttons', row: 8, col: 0 },
];

const MP_FEATURE = {
  PAUSE: 1, SEEK: 2, VOLUME_SET: 4, VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16, NEXT_TRACK: 32, TURN_ON: 128, TURN_OFF: 256,
  VOLUME_STEP: 1024, SELECT_SOURCE: 2048, STOP: 4096, PLAY: 16384,
  SHUFFLE_SET: 32768, REPEAT_SET: 262144,
};

const REMOTE_PRESETS = {
  default: {
    label: 'Standard (9x3)',
    icon: 'mdi:remote',
    columns: 3,
    rows: 9,
    items: DEFAULT_ITEMS,
  },
  default_4col: {
    label: 'Standard (10x4)',
    icon: 'mdi:remote',
    columns: 4,
    rows: 10,
    items: [
      { type: 'button', row: 0, col: 0, icon: 'mdi:power' },
      { type: 'numbers', row: 8, col: 1, icon: 'mdi:dialpad', col_span: 2 },
      { type: 'source', row: 0, col: 3, icon: 'mdi:import' },
      { type: 'dpad', row: 1, col: 0, col_span: 4, row_span: 4 },
      { type: 'button', row: 5, col: 0, icon: 'mdi:arrow-u-left-top' },
      { type: 'button', row: 5, col: 1, icon: 'mdi:home' },
      { type: 'button', row: 5, col: 2, icon: 'mdi:information-outline' },
      { type: 'button', row: 5, col: 3, icon: 'mdi:menu' },
      { type: 'button', row: 6, col: 0, icon: 'mdi:rewind', hold_repeat: true },
      { type: 'button', row: 6, col: 1, icon: 'mdi:play-pause' },
      { type: 'button', row: 6, col: 2, icon: 'mdi:stop' },
      { type: 'button', row: 6, col: 3, icon: 'mdi:fast-forward', hold_repeat: true },
      { type: 'button', variant: 'pill_top', row: 7, col: 0, icon: 'mdi:plus', hold_repeat: true },
      { type: 'button', row: 7, col: 1, icon: 'mdi:volume-off' },
      { type: 'button', row: 7, col: 2, text: 'GUIDE' },
      { type: 'button', variant: 'pill_top', row: 7, col: 3, icon: 'mdi:chevron-up', hold_repeat: true },
      { type: 'button', variant: 'pill_bottom', row: 8, col: 0, icon: 'mdi:minus', hold_repeat: true },
      { type: 'button', variant: 'pill_bottom', row: 8, col: 3, icon: 'mdi:chevron-down', hold_repeat: true },
      { type: 'color_buttons', row: 9, col: 0, col_span: 4 },
    ],
  },
  media_player: {
    label: 'Media Player',
    icon: 'mdi:cast-audio',
    entity_domain: 'media_player',
    entity_label: 'Media Player',
    dynamic: true,
  },
  lg_webos: {
    label: 'LG TV (WebOS)',
    icon: 'mdi:television',
    entity_domain: 'media_player',
    entity_integration: 'webostv',
    entity_label: 'LG TV Media Player',
    columns: 3,
    rows: 11,
    items: [
      { type: 'button', row: 0, col: 0, icon: 'mdi:power',
        tap_action: { action: 'perform-action', perform_action: 'media_player.turn_off' } },
      { type: 'numbers', row: 0, col: 1, icon: 'mdi:dialpad',
        buttons: {
          '0': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '0' } } },
          '1': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '1' } } },
          '2': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '2' } } },
          '3': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '3' } } },
          '4': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '4' } } },
          '5': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '5' } } },
          '6': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '6' } } },
          '7': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '7' } } },
          '8': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '8' } } },
          '9': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: '9' } } },
          'dash': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'DASH' } } },
          'enter': { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'ENTER' } } },
        } },
      { type: 'source', row: 0, col: 2, icon: 'mdi:import' },
      { type: 'media', row: 1, col: 0 },
      { type: 'dpad', row: 3, col: 0,
        buttons: {
          up:    { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'UP' } } },
          down:  { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'DOWN' } } },
          left:  { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'LEFT' } } },
          right: { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'RIGHT' } } },
          ok:    { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'ENTER' } } },
        } },
      { type: 'button', row: 6, col: 0, icon: 'mdi:arrow-u-left-top',
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'BACK' } } },
      { type: 'button', row: 6, col: 1, icon: 'mdi:home',
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'HOME' } } },
      { type: 'button', row: 6, col: 2, icon: 'mdi:cog',
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'MENU' } } },
      { type: 'button', row: 7, col: 0, icon: 'mdi:skip-previous',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_previous_track' } },
      { type: 'button', row: 7, col: 1, icon: 'mdi:play-pause',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_play_pause' } },
      { type: 'button', row: 7, col: 2, icon: 'mdi:skip-next',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_next_track' } },
      { type: 'button', variant: 'pill_top', row: 8, col: 0, icon: 'mdi:plus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'VOLUMEUP' } } },
      { type: 'button', row: 8, col: 1, text: 'GUIDE',
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'GUIDE' } } },
      { type: 'button', variant: 'pill_top', row: 8, col: 2, icon: 'mdi:chevron-up', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'CHANNELUP' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 0, icon: 'mdi:minus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'VOLUMEDOWN' } } },
      { type: 'button', row: 9, col: 1, icon: 'mdi:volume-off',
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'MUTE' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 2, icon: 'mdi:chevron-down', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'CHANNELDOWN' } } },
      { type: 'color_buttons', row: 10, col: 0,
        buttons: {
          red:    { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'RED' } } },
          green:  { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'GREEN' } } },
          yellow: { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'YELLOW' } } },
          blue:   { tap_action: { action: 'perform-action', perform_action: 'webostv.button', data: { button: 'BLUE' } } },
        } },
    ],
  },
  samsung_tv: {
    label: 'Samsung TV',
    icon: 'mdi:television',
    entity_domain: 'remote',
    entity_integration: 'samsungtv',
    entity_label: 'Samsung TV Remote',
    columns: 3,
    rows: 11,
    items: [
      { type: 'button', row: 0, col: 0, icon: 'mdi:power',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_POWER' } } },
      { type: 'numbers', row: 0, col: 1, icon: 'mdi:dialpad',
        buttons: {
          '0': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_0' } } },
          '1': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_1' } } },
          '2': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_2' } } },
          '3': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_3' } } },
          '4': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_4' } } },
          '5': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_5' } } },
          '6': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_6' } } },
          '7': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_7' } } },
          '8': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_8' } } },
          '9': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_9' } } },
          'dash': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_DASH' } } },
          'enter': { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_ENTER' } } },
        } },
      { type: 'button', row: 0, col: 2, icon: 'mdi:import',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_SOURCE' } } },
      { type: 'media', row: 1, col: 0 },
      { type: 'dpad', row: 3, col: 0,
        buttons: {
          up:    { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_UP' } } },
          down:  { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_DOWN' } } },
          left:  { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_LEFT' } } },
          right: { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_RIGHT' } } },
          ok:    { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_ENTER' } } },
        } },
      { type: 'button', row: 6, col: 0, icon: 'mdi:arrow-u-left-top',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_RETURN' } } },
      { type: 'button', row: 6, col: 1, icon: 'mdi:home',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_HOME' } } },
      { type: 'button', row: 6, col: 2, icon: 'mdi:cog',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_MENU' } } },
      { type: 'button', row: 7, col: 0, icon: 'mdi:skip-previous',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_REWIND' } } },
      { type: 'button', row: 7, col: 1, icon: 'mdi:play-pause',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_PLAY' } } },
      { type: 'button', row: 7, col: 2, icon: 'mdi:skip-next',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_FF' } } },
      { type: 'button', variant: 'pill_top', row: 8, col: 0, icon: 'mdi:plus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_VOLUP' } } },
      { type: 'button', row: 8, col: 1, icon: 'mdi:television-guide',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_GUIDE' } } },
      { type: 'button', variant: 'pill_top', row: 8, col: 2, icon: 'mdi:chevron-up', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_CHUP' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 0, icon: 'mdi:minus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_VOLDOWN' } } },
      { type: 'button', row: 9, col: 1, icon: 'mdi:volume-off',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_MUTE' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 2, icon: 'mdi:chevron-down', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_CHDOWN' } } },
      { type: 'color_buttons', row: 10, col: 0,
        buttons: {
          red:    { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_RED' } } },
          green:  { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_GREEN' } } },
          yellow: { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_YELLOW' } } },
          blue:   { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'KEY_CYAN' } } },
        } },
    ],
  },
  apple_tv: {
    label: 'Apple TV',
    icon: 'mdi:apple',
    entity_domain: 'remote',
    entity_integration: 'apple_tv',
    entity_label: 'Apple TV Remote',
    columns: 3,
    rows: 10,
    items: [
      { type: 'button', row: 0, col: 0, icon: 'mdi:power',
        tap_action: { action: 'perform-action', perform_action: 'remote.toggle' } },
      { type: 'media', row: 1, col: 0 },
      { type: 'dpad', row: 3, col: 0,
        buttons: {
          up:    { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'up' } } },
          down:  { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'down' } } },
          left:  { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'left' } } },
          right: { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'right' } } },
          ok:    { tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'select' } } },
        } },
      { type: 'button', row: 6, col: 0, icon: 'mdi:arrow-u-left-top',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'menu' } } },
      { type: 'button', row: 6, col: 1, icon: 'mdi:home',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'home' } } },
      { type: 'button', row: 6, col: 2, icon: 'mdi:television',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'top_menu' } } },
      { type: 'button', row: 7, col: 0, icon: 'mdi:skip-previous',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'previous' } } },
      { type: 'button', row: 7, col: 1, icon: 'mdi:play-pause',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'play_pause' } } },
      { type: 'button', row: 7, col: 2, icon: 'mdi:skip-next',
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'next' } } },
      { type: 'button', variant: 'pill_top', row: 8, col: 1, icon: 'mdi:plus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'volume_up' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 1, icon: 'mdi:minus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'remote.send_command', data: { command: 'volume_down' } } },
    ],
  },
  spotify: {
    label: 'Spotify',
    icon: 'mdi:spotify',
    entity_domain: 'media_player',
    entity_integration: 'spotify',
    entity_label: 'Spotify Player',
    columns: 3,
    rows: 7,
    items: [
      { type: 'source', row: 0, col: 2, icon: 'mdi:speaker-multiple' },
      { type: 'media', row: 1, col: 0 },
      { type: 'button', row: 3, col: 0, icon: 'mdi:skip-previous',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_previous_track' } },
      { type: 'button', row: 3, col: 1, icon: 'mdi:play-pause',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_play_pause' } },
      { type: 'button', row: 3, col: 2, icon: 'mdi:skip-next',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_next_track' } },
      { type: 'button', row: 4, col: 0, icon: 'mdi:shuffle-variant',
        tap_action: { action: 'perform-action', perform_action: 'media_player.shuffle_set' } },
      { type: 'button', row: 4, col: 2, icon: 'mdi:repeat',
        tap_action: { action: 'perform-action', perform_action: 'media_player.repeat_set' } },
      { type: 'button', variant: 'pill_top', row: 5, col: 1, icon: 'mdi:plus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'media_player.volume_up' } },
      { type: 'button', variant: 'pill_bottom', row: 6, col: 1, icon: 'mdi:minus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'media_player.volume_down' } },
    ],
  },
  unfolded_circle: {
    label: 'Unfolded Circle',
    icon: 'mdi:remote-tv',
    entity_domain: 'media_player',
    entity_integration: 'unfoldedcircle',
    entity_label: 'Media Player',
    secondary_entity_domain: 'remote',
    secondary_entity_integration: 'unfoldedcircle',
    secondary_entity_label: 'Remote',
    columns: 3,
    rows: 10,
    items: [
      { type: 'button', row: 0, col: 0, icon: 'mdi:power',
        tap_action: { action: 'perform-action', perform_action: 'media_player.toggle' } },
      { type: 'source', row: 0, col: 2, icon: 'mdi:import' },
      { type: 'media', row: 1, col: 0 },
      { type: 'dpad', row: 3, col: 0, _secondary: true,
        buttons: {
          up:    { tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'DPAD_UP' } } },
          down:  { tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'DPAD_DOWN' } } },
          left:  { tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'DPAD_LEFT' } } },
          right: { tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'DPAD_RIGHT' } } },
          ok:    { tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'DPAD_MIDDLE' } } },
        } },
      { type: 'button', row: 6, col: 0, icon: 'mdi:arrow-u-left-top', _secondary: true,
        tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'BACK' } } },
      { type: 'button', row: 6, col: 1, icon: 'mdi:home', _secondary: true,
        tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'HOME' } } },
      { type: 'button', row: 7, col: 0, icon: 'mdi:skip-previous',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_previous_track' } },
      { type: 'button', row: 7, col: 1, icon: 'mdi:play-pause',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_play_pause' } },
      { type: 'button', row: 7, col: 2, icon: 'mdi:skip-next',
        tap_action: { action: 'perform-action', perform_action: 'media_player.media_next_track' } },
      { type: 'button', variant: 'pill_top', row: 8, col: 0, icon: 'mdi:plus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'media_player.volume_up' } },
      { type: 'button', row: 8, col: 1, icon: 'mdi:volume-off',
        tap_action: { action: 'perform-action', perform_action: 'media_player.volume_mute', data: { is_volume_muted: true } } },
      { type: 'button', variant: 'pill_top', row: 8, col: 2, icon: 'mdi:chevron-up', hold_repeat: true, _secondary: true,
        tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'CHANNEL_UP' } } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 0, icon: 'mdi:minus', hold_repeat: true,
        tap_action: { action: 'perform-action', perform_action: 'media_player.volume_down' } },
      { type: 'button', variant: 'pill_bottom', row: 9, col: 2, icon: 'mdi:chevron-down', hold_repeat: true, _secondary: true,
        tap_action: { action: 'perform-action', perform_action: 'unfoldedcircle.send_button_command', data: { command: 'CHANNEL_DOWN' } } },
    ],
  },
};

// -- Condition evaluator ------------------------------------------------------

function _collectConditionEntities(cond, set) {
  if (!cond) return;
  if (cond.entity) set.add(cond.entity);
  if (Array.isArray(cond.conditions)) {
    for (const sub of cond.conditions) _collectConditionEntities(sub, set);
  }
}

function _checkConditionsMet(conditions, hass) {
  if (!conditions?.length) return true;
  return conditions.every(c => _checkSingleCondition(c, hass));
}

function _checkSingleCondition(c, hass) {
  if (!c?.condition) return true;
  switch (c.condition) {
    case 'state': {
      const s = hass.states[c.entity];
      if (!s) return false;
      if ('state' in c) {
        const vals = Array.isArray(c.state) ? c.state : [String(c.state)];
        return vals.includes(s.state);
      }
      if ('state_not' in c) {
        const vals = Array.isArray(c.state_not) ? c.state_not : [String(c.state_not)];
        return !vals.includes(s.state);
      }
      return false;
    }
    case 'numeric_state': {
      const s = hass.states[c.entity];
      if (!s) return false;
      const val = parseFloat(s.state);
      if (isNaN(val)) return false;
      if ('above' in c && val <= c.above) return false;
      if ('below' in c && val >= c.below) return false;
      return true;
    }
    case 'and': return c.conditions?.every(sub => _checkSingleCondition(sub, hass)) ?? true;
    case 'or':  return c.conditions?.some(sub => _checkSingleCondition(sub, hass)) ?? false;
    case 'not': return !c.conditions?.some(sub => _checkSingleCondition(sub, hass));
    default: return true;
  }
}

// -- Card class ---------------------------------------------------------------

class GridRemoteCard extends LitElement {
  static get properties() {
    return {
      hass:                { attribute: false },
      _config:             { state: true },
      _sourcePopupOpen:    { state: true },
      _numpadPopupOpen:    { state: true },
      _sourcePopupItemIdx: { state: true },
      _numpadPopupItemIdx: { state: true },
      _currentPage:        { state: true },
    };
  }

  static getConfigElement() {
    return document.createElement('grid-remote-card-editor');
  }

  static getStubConfig() {
    return { columns: 3, rows: 9, items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)) };
  }

  constructor() {
    super();
    this._config = {};
    this._sourcePopupOpen = false;
    this._numpadPopupOpen = false;
    this._sourcePopupItemIdx = null;
    this._numpadPopupItemIdx = null;
    this._currentPage = 0;
    this._swipeState = null;
    this._ptrStates = new WeakMap();
  }

  /** @returns {Array} Config items with fallback to empty array */
  get _items() { return this._config?.items || []; }

  get _pageCount() { return Math.max(this._config?.page_count || 1, 1); }

  /** @returns {Object|null} Entity state object from hass */
  _getState(entityId) {
    return entityId && this.hass ? this.hass.states[entityId] : null;
  }


  setConfig(config) {
    if (!config) throw new Error('Grid Remote Card: Configuration missing');
    if (config.items != null && !Array.isArray(config.items))
      throw new Error('Grid Remote Card: "items" must be an array');
    if (config.columns != null && (typeof config.columns !== 'number' || config.columns < 1))
      throw new Error('Grid Remote Card: "columns" must be a positive number');
    if (config.rows != null && (typeof config.rows !== 'number' || config.rows < 1))
      throw new Error('Grid Remote Card: "rows" must be a positive number');
    if (config.scale != null && (typeof config.scale !== 'number' || config.scale < 10))
      throw new Error('Grid Remote Card: "scale" must be a number >= 10');
    // Strip transient editor property before storing config
    const { _editor_page, ...cleanConfig } = config;
    this._config = cleanConfig;
    // Sync preview page with editor page (only while editor is open)
    if (_editor_page != null) {
      this._currentPage = _editor_page;
      this._isEditorPreview = true;
    }
    // Clamp current page if page_count was reduced
    const maxPage = Math.max((config.page_count || 1) - 1, 0);
    if (this._currentPage > maxPage) this._currentPage = maxPage;
  }

  getCardSize() {
    return this._config.rows || 9;
  }

  getGridOptions() {
    const rows = this._config?.rows || 1;
    const cols = this._config?.columns || 1;
    const scale = (this._config?.scale || 100) / 100;
    const neededCols = Math.ceil(cols * 2 * scale);

    // Calculate exact remote height from CSS variables
    const style = getComputedStyle(this);
    const cellH = parseInt(style.getPropertyValue('--grid-cell-height')) || 50;
    const gap = parseInt(style.getPropertyValue('--grid-gap')) || 10;
    const padding = parseInt(style.getPropertyValue('--remote-padding')) || 15;
    const multiPage = this._pageCount > 1;
    const dotsHeight = multiPage ? 28 : 0; // 8px dot + 8px+2px padding + margin
    const remoteHeight = (rows * cellH + (rows - 1) * gap + 2 * padding + dotsHeight) * scale;

    // Read section grid row metrics
    const rowHeight = parseInt(style.getPropertyValue('--row-height')) || 56;
    const rowGap = parseInt(style.getPropertyValue('--row-gap')) || 8;
    const neededRows = Math.ceil((remoteHeight + rowGap) / (rowHeight + rowGap));

    this._gridCols = Math.max(this._gridCols || 0, neededCols);

    return {
      rows: 1,
      columns: 1,
      min_rows: neededRows,
      min_columns: neededCols,
    };
  }

  /** Collect entity IDs used by this card for shouldUpdate filtering */
  get _trackedEntities() {
    const ids = new Set();
    for (const item of this._items) {
      if (item.entity_id) ids.add(item.entity_id);
      if (item.source_entity) ids.add(item.source_entity);
    }
    const conds = this._config?.page_conditions;
    if (conds) {
      for (const c of conds) {
        if (Array.isArray(c)) {
          for (const sub of c) _collectConditionEntities(sub, ids);
        }
      }
    }
    return ids;
  }

  shouldUpdate(changedProps) {
    if (!changedProps.has('hass') || changedProps.size > 1) return true;
    // Only hass changed — check if any tracked entity actually changed
    const oldHass = changedProps.get('hass');
    if (!oldHass) return true;
    const tracked = this._trackedEntities;
    if (tracked.size === 0 && !this._sourcePopupOpen) return false;
    for (const eid of tracked) {
      if (oldHass.states[eid] !== this.hass.states[eid]) return true;
    }
    return false;
  }

  /** Evaluate page conditions and return index of first matching page, or -1 */
  _evaluatePageConditions() {
    const conds = this._config?.page_conditions;
    if (!conds || !this.hass) return -1;
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      if (!Array.isArray(c) || c.length === 0) continue;
      if (_checkConditionsMet(c, this.hass)) return i;
    }
    return -1;
  }

  // -- Render -----------------------------------------------------------------

  render() {
    if (!this._config) return html``;
    const cols = this._config.columns || 3;
    const scale = (this._config.scale || 100) / 100;
    const stretch = this._config.sizing === 'stretch';
    const sizeStyle = stretch ? 'width:100%;height:100%;' : '';
    const zoomStyle = scale !== 1 ? `zoom:${scale};` : '';
    const rows = this._config.rows || 9;
    const gridStyle = `grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);`;
    const multiPage = this._pageCount > 1;
    // For multi-page, lock ha-card width to prevent flex track from inflating it
    const multiPageWidth = multiPage && !stretch
      ? `width:calc(${cols} * var(--grid-cell-width) + ${cols - 1} * var(--grid-gap) + 2 * var(--remote-padding) + 2 * var(--ha-card-border-width, 1px));`
      : '';
    const cardBg = resolveColor(this._config.card_background_color || '');
    const cardBgStyle = cardBg ? `background:${cardBg};` : '';
    const cardStyle = `${sizeStyle}${zoomStyle}${multiPageWidth}${cardBgStyle}`;

    if (!multiPage) {
      return html`
        <ha-card style="${cardStyle}">
          <div class="remote-grid" style="${gridStyle}">
            ${this._items.map((item, i) => this._renderItem(item, i))}
            ${this._renderSourcePopup()}
            ${this._renderNumpadPopup()}
          </div>
        </ha-card>
      `;
    }

    const swipeDx = this._swipeState?.dx || 0;
    const swiping = this._swipeState?.swiping || false;
    const trackTransform = swiping
      ? `transform:translateX(calc(${-this._currentPage * 100}% + ${swipeDx}px));transition:none;`
      : `transform:translateX(${-this._currentPage * 100}%);`;

    const pages = [];
    for (let p = 0; p < this._pageCount; p++) {
      const items = this._items.map((item, i) => [item, i]).filter(([item]) => (item.page || 0) === p);
      pages.push(html`
        <div class="remote-grid" style="${gridStyle}">
          ${items.map(([item, i]) => this._renderItem(item, i))}
          ${p === this._currentPage ? html`${this._renderSourcePopup()}${this._renderNumpadPopup()}` : ''}
        </div>
      `);
    }

    return html`
      <ha-card style="${cardStyle}">
        <div class="page-container"
             @touchstart=${this._onSwipeStart}
             @touchmove=${this._onSwipeMove}
             @touchend=${this._onSwipeEnd}>
          <div class="page-track" style="${trackTransform}">
            ${pages}
          </div>
        </div>
        ${this._renderPageDots()}
      </ha-card>
    `;
  }

  _renderPageDots() {
    const dots = [];
    const conds = this._config?.page_conditions;
    for (let i = 0; i < this._pageCount; i++) {
      const hasCond = conds?.[i]?.length > 0;
      dots.push(html`
        <button class="page-dot ${i === this._currentPage ? 'active' : ''} ${hasCond ? 'conditional' : ''}"
                @click=${() => { this._currentPage = i; }}></button>
      `);
    }
    return html`<div class="page-dots">${dots}</div>`;
  }

  _onSwipeStart(e) {
    if (this._pageCount <= 1) return;
    if (e.touches.length !== 1) return;
    // Don't swipe when interacting with sliders
    if (e.target.closest?.('.slider-wrapper') || e.composedPath().some(el => el.classList?.contains('slider-wrapper'))) return;
    this._swipeState = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, swiping: false };
  }

  _onSwipeMove(e) {
    if (!this._swipeState) return;
    const dx = e.touches[0].clientX - this._swipeState.startX;
    const dy = e.touches[0].clientY - this._swipeState.startY;
    // Only activate horizontal swipe if mostly horizontal
    if (!this._swipeState.swiping && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
      this._swipeState.swiping = true;
    }
    if (this._swipeState.swiping) {
      e.preventDefault();
      // Dampen at edges
      const atStart = this._currentPage === 0 && dx > 0;
      const atEnd = this._currentPage === this._pageCount - 1 && dx < 0;
      this._swipeState = { ...this._swipeState, dx: (atStart || atEnd) ? dx * 0.3 : dx };
      this.requestUpdate();
    }
  }

  _onSwipeEnd() {
    if (!this._swipeState) return;
    const { dx, swiping } = this._swipeState;
    this._swipeState = null;
    if (!swiping) return;
    if (dx < -50 && this._currentPage < this._pageCount - 1) {
      this._currentPage++;
    } else if (dx > 50 && this._currentPage > 0) {
      this._currentPage--;
    }
    this.requestUpdate();
  }

  updated(changedProps) {
    // Detect editor preview on first render — reset to page 0 and disable auto-switch
    if (!this._editorDetected) {
      this._editorDetected = true;
      const root = this.getRootNode();
      if (root?.host?.tagName === 'HUI-CARD-PREVIEW') {
        this._isEditorPreview = true;
        this._currentPage = 0;
      }
    }
    // Auto-switch page based on conditions (fall back to page 0 if none match)
    // Skip in editor preview — the editor controls the page
    if (changedProps.has('hass') && this.hass && !this._isEditorPreview) {
      const conds = this._config?.page_conditions;
      const hasAnyCondition = conds?.some(c => Array.isArray(c) && c.length > 0);
      if (hasAnyCondition) {
        const targetPage = this._evaluatePageConditions();
        const effectivePage = targetPage >= 0 && targetPage < this._pageCount ? targetPage : 0;
        if (effectivePage !== this._currentPage) {
          this._currentPage = effectivePage;
        }
      }
    }
    // Activate marquee only on elements whose text overflows
    const els = this.shadowRoot?.querySelectorAll('[data-scroll="1"]') || [];
    for (const el of els) {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      if (overflows && !el.classList.contains('marquee')) {
        const text = el.textContent;
        el.setAttribute('data-text-orig', text);
        el.classList.add('marquee');
        const dur = Math.max(5, text.length * 0.3);
        const inner = document.createElement('span');
        inner.textContent = `${text}\u00A0\u00A0\u00A0\u00A0${text}`;
        inner.style.setProperty('--grc-marquee-duration', `${dur}s`);
        el.textContent = '';
        el.appendChild(inner);
      } else if (!overflows && el.classList.contains('marquee')) {
        el.classList.remove('marquee');
        el.textContent = el.getAttribute('data-text-orig') || el.textContent.split('\u00A0\u00A0\u00A0\u00A0')[0];
        el.removeAttribute('data-text-orig');
      }
    }
  }

  // -- Item rendering ---------------------------------------------------------

  _renderItem(item, index) {
    if (!item?.type) return html``;
    if (!ITEM_SIZES[item.type]) return html``;
    const size = _getItemSize(item);
    const gs = `grid-row:${item.row + 1}/span ${size.rows};grid-column:${item.col + 1}/span ${size.cols};`;
    if (item.type === 'dpad') {
      return html`<div class="grid-item dpad-wrapper" style="${gs}">${this._renderDpad(item, index, size)}</div>`;
    }
    if (item.type === 'color_buttons') {
      return html`<div class="grid-item color-buttons-wrapper" style="${gs}">${this._renderColorButtons(item, index)}</div>`;
    }
    if (item.type === 'slider') {
      return html`<div class="grid-item slider-wrapper" style="${gs}">${this._renderSlider(item, index)}</div>`;
    }
    if (item.type === 'media') {
      return html`<div class="grid-item media-wrapper" style="${gs}">${this._renderMedia(item, index)}</div>`;
    }
    const variantClass = VARIANT_CSS_CLASS[item.variant] || '';
    const isMultiSpan = size.cols > 1 || size.rows > 1;
    const spanClass = isMultiSpan ? 'multi-span' : '';
    return html`<div class="grid-item" style="${gs}">${this._renderBtn(item, index, `${variantClass} ${spanClass}`.trim())}</div>`;
  }

  _renderDpad(item, index, size) {
    const s = size?.cols || 3;
    const ringSize = `calc(${s} * var(--grid-cell-width) + ${s - 1} * var(--grid-gap))`;
    return html`
      <div class="dpad-ring" style="width:${ringSize};height:${ringSize};">
        <div class="dpad-grid">
          ${this._renderDpadBtn(item, index, 'up', 'dpad-cell dpad-up')}
          ${this._renderDpadBtn(item, index, 'right', 'dpad-cell dpad-right')}
          ${this._renderDpadBtn(item, index, 'left', 'dpad-cell dpad-left')}
          ${this._renderDpadBtn(item, index, 'down', 'dpad-cell dpad-down')}
        </div>
        ${this._renderDpadBtn(item, index, 'ok', 'center-btn')}
      </div>
    `;
  }

  _renderColorButtons(item, index) {
    return html`
      <div class="color-buttons-row">
        ${COLOR_BUTTON_KEYS.map(key => this._renderColorBtn(item, index, key))}
      </div>
    `;
  }

  _renderColorBtn(item, index, key) {
    const btnCfg = item.buttons?.[key] ?? {};
    const defaults = COLOR_BUTTON_DEFAULTS[key];
    const color = resolveColor(btnCfg.color || defaults.color);
    const icon = btnCfg.icon || '';
    const text = btnCfg.text || '';
    const iconColor = resolveColor(btnCfg.icon_color || '');
    const textColor = resolveColor(btnCfg.text_color || '');
    return html`
      <button class="remote-btn color-btn" style="--grc-btn-bg:${color}"
              @pointerdown="${(e) => this._onPointerDown(e, index, key)}"
              @pointerup="${(e) => this._onPointerUp(e, index, key)}"
              @pointermove="${(e) => this._onPointerMove(e)}"
              @pointerleave="${(e) => this._onPointerCancel(e)}"
              @pointercancel="${(e) => this._onPointerCancel(e)}"
              @contextmenu="${(e) => e.preventDefault()}">
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : text
            ? html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text}</span>`
            : ''}
      </button>
    `;
  }

  _renderDpadBtn(item, index, dir, extraClass) {
    const btnCfg = item.buttons?.[dir] ?? {};
    const defaults = DPAD_DEFAULTS[dir];
    const icon = btnCfg.icon ?? (btnCfg.text ? null : defaults.icon);
    const text = btnCfg.text ?? null;
    const iconColor = resolveColor(btnCfg.icon_color || this._config.icon_color || '');
    const textColor = resolveColor(btnCfg.text_color || this._config.text_color || '');
    const isDirectional = extraClass.includes('dpad-cell');
    const bgColor = resolveColor(btnCfg.background_color || (isDirectional ? this._config.button_background_color : '') || '');
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    return html`
      <button class="remote-btn ${extraClass}" style="${style}"
              @pointerdown="${(e) => this._onPointerDown(e, index, dir)}"
              @pointerup="${(e) => this._onPointerUp(e, index, dir)}"
              @pointermove="${(e) => this._onPointerMove(e)}"
              @pointerleave="${(e) => this._onPointerCancel(e)}"
              @pointercancel="${(e) => this._onPointerCancel(e)}"
              @contextmenu="${(e) => e.preventDefault()}">
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text || ''}</span>`}
      </button>
    `;
  }

  _renderBtn(item, index, extraClass) {
    if (item.type === 'entity') return this._renderEntityBtn(item, index, extraClass);
    const defaultIcon = TYPE_DEFAULT_ICONS[item.type] || '';
    const icon = item.icon ?? (item.text ? null : defaultIcon);
    const text = item.text ?? (item.icon ? null : '');
    const iconColor = resolveColor(item.icon_color || this._config.icon_color || '');
    const textColor = resolveColor(item.text_color || this._config.text_color || '');
    const bgColor = resolveColor(item.background_color || this._config.button_background_color || '');
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';
    return html`
      <button class="remote-btn ${extraClass}" style="${style}"
              @pointerdown="${(e) => this._onPointerDown(e, index, null)}"
              @pointerup="${(e) => this._onPointerUp(e, index, null)}"
              @pointermove="${(e) => this._onPointerMove(e)}"
              @pointerleave="${(e) => this._onPointerCancel(e)}"
              @pointercancel="${(e) => this._onPointerCancel(e)}"
              @contextmenu="${(e) => e.preventDefault()}">
        <span class="ripple-container"></span>
        ${icon
          ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>`
          : html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${text || ''}</span>`}
      </button>
    `;
  }

  _renderEntityBtn(item, index, extraClass) {
    const entityId = item.entity_id;
    const stateObj = this._getState(entityId);
    const friendlyName = stateObj?.attributes?.friendly_name || entityId || '';
    let bgColor = resolveColor(item.background_color || this._config.button_background_color || '');
    // State-based background tint when show_state_background is enabled and no explicit bg
    if (!bgColor && item.show_state_background && stateObj && !INACTIVE_STATES.has(stateObj.state)) {
      bgColor = 'color-mix(in srgb, var(--state-active-color, var(--primary-color)) 15%, transparent)';
    }
    const style = bgColor ? `--grc-btn-bg:${bgColor}` : '';

    let content;
    if (item.text) {
      // Custom text overrides icon/badge
      const textColor = resolveColor(item.text_color || this._config.text_color || '');
      content = html`<span class="btn-text" style="${textColor ? `color:${textColor}` : ''}">${item.text}</span>`;
    } else if (stateObj) {
      // Use state-badge for native HA icon/color rendering
      const iconColor = resolveColor(item.icon_color || '');
      content = html`<state-badge
        .hass=${this.hass}
        .stateObj=${stateObj}
        .overrideIcon=${item.icon || ''}
        .stateColor=${!iconColor}
        .color=${iconColor || undefined}
        style="--mdc-icon-size:25px;width:auto;height:auto;"
      ></state-badge>`;
    } else if (item.icon) {
      content = html`<ha-icon .icon="${item.icon}"></ha-icon>`;
    } else {
      content = html`<span class="btn-text">${friendlyName}</span>`;
    }

    return html`
      <button class="remote-btn ${extraClass}" style="${style}"
              @pointerdown="${(e) => this._onPointerDown(e, index, null)}"
              @pointerup="${(e) => this._onPointerUp(e, index, null)}"
              @pointermove="${(e) => this._onPointerMove(e)}"
              @pointerleave="${(e) => this._onPointerCancel(e)}"
              @pointercancel="${(e) => this._onPointerCancel(e)}"
              @contextmenu="${(e) => e.preventDefault()}">
        <span class="ripple-container"></span>
        ${content}
      </button>
    `;
  }

  // -- Slider rendering -------------------------------------------------------

  _renderSlider(item, index) {
    const entityId = item.entity_id;
    const stateObj = this._getState(entityId);
    const defaults = getSliderDefaults(entityId, stateObj);
    const attribute = item.attribute || defaults?.attribute;
    const min = item.min ?? defaults?.min ?? 0;
    const max = item.max ?? defaults?.max ?? 100;
    const step = item.step ?? defaults?.step ?? 1;
    const icon = item.icon || defaults?.icon || 'mdi:tune-variant';
    const iconColor = resolveColor(item.icon_color || this._config.icon_color || '');
    const disabled = !stateObj || stateObj.state === 'unavailable';
    const showIcon = item.show_icon !== false;
    const variant = SLIDER_VARIANTS.includes(item.variant) ? item.variant : 'pill';
    const vertical = item.orientation === 'vertical';

    let currentValue = 0;
    if (stateObj) {
      currentValue = attribute ? parseFloat(stateObj.attributes?.[attribute] ?? 0) : parseFloat(stateObj.state ?? 0);
    }
    if (isNaN(currentValue)) currentValue = min;
    const fillPct = max > min ? Math.max(0, Math.min(100, (currentValue - min) / (max - min) * 100)) : 0;

    const rangeInput = html`
      <input type="range" class="slider-range" .min="${min}" .max="${max}" .step="${step}"
             .value="${currentValue}" ?disabled="${disabled}"
             @input="${(e) => this._onSliderInput(e, index)}"
             @change="${(e) => this._onSliderChange(e, index)}"
             @pointerdown="${(e) => this._onSliderStart(e, index)}"
             @pointerup="${() => this._onSliderEnd(index)}"
             @pointercancel="${() => this._onSliderEnd(index)}">
    `;

    if (variant !== 'classic') {
      const variantClass = VARIANT_CSS_CLASS[variant] || variant;
      return html`
        <div class="slider-item ${variantClass} ${disabled ? 'disabled' : ''} ${vertical ? 'vertical' : ''}"
             style="--slider-fill:${fillPct}%">
          <div class="pill-track">
            <div class="pill-fill"></div>
            ${showIcon ? html`<ha-icon class="pill-icon" .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>` : ''}
          </div>
          ${rangeInput}
          <span class="slider-popup" id="slider-popup-${index}"></span>
        </div>
      `;
    }

    return html`
      <div class="slider-item classic ${disabled ? 'disabled' : ''} ${vertical ? 'vertical' : ''}">
        ${showIcon ? html`<ha-icon .icon="${icon}" style="${iconColor ? `color:${iconColor}` : ''}"></ha-icon>` : ''}
        ${rangeInput}
        <span class="slider-popup" id="slider-popup-${index}"></span>
      </div>
    `;
  }

  _sliderDisplayValue(value, item) {
    const stateObj = this._getState(item.entity_id);
    const defaults = getSliderDefaults(item.entity_id, stateObj);
    const attribute = item.attribute || defaults?.attribute;
    const min = item.min ?? defaults?.min ?? 0;
    const max = item.max ?? defaults?.max ?? 100;
    // Show as percentage for brightness (0-255), volume_level (0-1), percentage, position
    if (attribute === 'brightness') return `${Math.round(value / 255 * 100)}%`;
    if (attribute === 'volume_level') return `${Math.round(value * 100)}%`;
    if (attribute === 'percentage' || attribute === 'current_position') return `${Math.round(value)}%`;
    if (min === 0 && max === 100) return `${Math.round(value)}%`;
    const step = item.step ?? defaults?.step ?? 1;
    return step < 1 ? value.toFixed(Math.min(2, String(step).split('.')[1]?.length || 2)) : String(Math.round(value));
  }

  _updateSliderPopup(index, input) {
    const item = this._items[index];
    if (!item) return;
    const popup = this.shadowRoot?.getElementById(`slider-popup-${index}`);
    if (!popup || !input) return;
    const value = parseFloat(input.value);
    popup.textContent = this._sliderDisplayValue(value, item);
    const rect = input.getBoundingClientRect();
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const pct = (value - min) / (max - min);
    const parentRect = input.closest('.slider-item').getBoundingClientRect();
    const thumbX = rect.left + pct * rect.width - parentRect.left;
    popup.style.left = `${thumbX - popup.offsetWidth / 2}px`;
  }

  _updateSliderFill(input) {
    const host = input?.closest?.('.slider-item:not(.classic)');
    if (!host) return;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    if (!(max > min)) return;
    const pct = Math.max(0, Math.min(100, (val - min) / (max - min) * 100));
    host.style.setProperty('--slider-fill', `${pct}%`);
  }

  _onSliderStart(e, index) {
    this._sliderActive = index;
    const popup = this.shadowRoot?.getElementById(`slider-popup-${index}`);
    if (popup) popup.classList.add('visible');
    this._updateSliderPopup(index, e.target);
  }

  _onSliderEnd(index) {
    this._sliderActive = null;
    const popup = this.shadowRoot?.getElementById(`slider-popup-${index}`);
    if (popup) popup.classList.remove('visible');
  }

  _onSliderInput(e, index) {
    const item = this._items[index];
    if (!item?.entity_id || !this.hass) return;
    this._updateSliderFill(e.target);
    this._updateSliderPopup(index, e.target);
    if (item.slider_live) {
      clearTimeout(this._sliderDebounce);
      this._sliderDebounce = setTimeout(() => this._sliderSendValue(item, parseFloat(e.target.value)), 150);
    }
  }

  _onSliderChange(e, index) {
    // Fired on release — send value if not live mode
    const item = this._items[index];
    if (!item?.entity_id || !this.hass || item.slider_live) return;
    this._sliderSendValue(item, parseFloat(e.target.value));
  }

  _sliderSendValue(item, value) {
    const stateObj = this._getState(item.entity_id);
    const defaults = getSliderDefaults(item.entity_id, stateObj);
    const service = item.service || defaults?.service;
    if (!service) return;
    const [domain, action] = service.split('.');
    const serviceField = item.service_field || defaults?.service_field || 'value';
    this.hass.callService(domain, action, {
      entity_id: item.entity_id,
      [serviceField]: value,
    });
  }

  // -- Media rendering --------------------------------------------------------

  _renderMedia(item, index) {
    const entityId = item.entity_id;
    const stateObj = this._getState(entityId);
    const friendlyName = stateObj?.attributes?.friendly_name || entityId || '';
    const showInfo = item.show_info !== false;
    const scrollInfo = !!item.scroll_info;

    let coverUrl = null;
    let title = '';
    let artist = '';
    let isPlaying = false;

    if (stateObj) {
      const state = stateObj.state;
      isPlaying = state === 'playing' || state === 'paused' || state === 'buffering' || state === 'on';
      const entityPicture = stateObj.attributes?.entity_picture;
      if (entityPicture) {
        coverUrl = entityPicture.startsWith('/') ? `${this.hass.hassUrl?.(entityPicture) || entityPicture}` : entityPicture;
      }
      title = stateObj.attributes?.media_title || '';
      artist = stateObj.attributes?.media_artist || '';
    }

    const showFallback = !isPlaying || !title;
    const displayTitle = showFallback ? friendlyName : title;
    const displayArtist = showFallback
      ? (stateObj ? this.hass.formatEntityState?.(stateObj) || stateObj.state : 'unavailable')
      : artist;

    return html`
      <div class="media-tile" ?data-cover-url="${!!coverUrl}"
        @pointerdown="${(e) => this._onPointerDown(e, index, null)}"
        @pointerup="${(e) => this._onPointerUp(e, index, null)}"
        @pointermove="${(e) => this._onPointerMove(e)}"
        @pointerleave="${(e) => this._onPointerCancel(e)}"
        @pointercancel="${(e) => this._onPointerCancel(e)}"
        @contextmenu="${(e) => e.preventDefault()}">
        <span class="ripple-container"></span>
        ${coverUrl
          ? html`<img class="media-cover" src="${coverUrl}" alt="" @error="${(e) => { e.target.closest('.media-tile').classList.add('cover-error'); }}">`
          : ''}
        <div class="media-cover-fallback">
          <ha-icon icon="${item.fallback_icon || 'mdi:music'}" style="--mdc-icon-size:48px;color:var(--secondary-text-color);opacity:0.5;"></ha-icon>
        </div>
        ${showInfo ? html`
          <div class="media-overlay">
            <span class="media-title" data-scroll="${scrollInfo ? '1' : ''}">${displayTitle}</span>
            ${displayArtist ? html`<span class="media-artist" data-scroll="${scrollInfo ? '1' : ''}">${displayArtist}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  // -- Pointer events ---------------------------------------------------------

  _getPointerState(el) {
    let s = this._ptrStates.get(el);
    if (!s) {
      s = { holdTimer: null, repeatTimer: null, isHold: false, tapCount: 0, tapTimer: null, startX: 0, startY: 0 };
      this._ptrStates.set(el, s);
    }
    return s;
  }

  _onPointerDown(e, itemIndex, subButton) {
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const s = this._getPointerState(el);
    s.isHold = false;
    s.startX = e.clientX;
    s.startY = e.clientY;
    this._createRipple(el, e);
    s.holdTimer = setTimeout(() => {
      s.isHold = true;
      if (this._shouldRepeatOnHold(itemIndex, subButton)) {
        this._handleAction(itemIndex, subButton, 'tap', el);
        const item = this._items[itemIndex];
        const subCfg = subButton ? item?.buttons?.[subButton] : null;
        const interval = subCfg?.hold_repeat_interval ?? item?.hold_repeat_interval ?? this._config.hold_repeat_interval ?? DEFAULT_REPEAT_INTERVAL_MS;
        s.repeatTimer = setInterval(() => {
          this._handleAction(itemIndex, subButton, 'tap', el);
        }, interval);
      } else {
        this._handleAction(itemIndex, subButton, 'hold', el);
      }
    }, HOLD_DELAY_MS);
  }

  _shouldRepeatOnHold(itemIndex, subButton) {
    const item = this._items[itemIndex];
    if (!item) return false;
    if (subButton) {
      const btnCfg = item.buttons?.[subButton];
      if (!btnCfg?.hold_repeat) return false;
      const holdAction = btnCfg.hold_action;
      return !holdAction || !holdAction.action || holdAction.action === 'none';
    }
    if (!item.hold_repeat) return false;
    const holdAction = item.hold_action;
    return !holdAction || !holdAction.action || holdAction.action === 'none';
  }

  _onPointerMove(e) {
    const el = e.currentTarget;
    const s = this._ptrStates.get(el);
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
      clearTimeout(s.holdTimer);
      s.holdTimer = null;
      clearInterval(s.repeatTimer);
      s.repeatTimer = null;
    }
  }

  _onPointerUp(e, itemIndex, subButton) {
    const el = e.currentTarget;
    const s = this._ptrStates.get(el);
    if (!s) return;
    clearTimeout(s.holdTimer);
    s.holdTimer = null;
    clearInterval(s.repeatTimer);
    s.repeatTimer = null;
    if (s.isHold) return;
    s.tapCount++;
    if (s.tapCount === 1) {
      s.tapTimer = setTimeout(() => {
        if (s.tapCount === 1) this._handleAction(itemIndex, subButton, 'tap', el);
        s.tapCount = 0;
      }, DOUBLE_TAP_MS);
    } else if (s.tapCount === 2) {
      clearTimeout(s.tapTimer);
      s.tapCount = 0;
      this._handleAction(itemIndex, subButton, 'double_tap', el);
    }
  }

  _onPointerCancel(e) {
    const el = e.currentTarget;
    const s = this._ptrStates.get(el);
    if (!s) return;
    clearTimeout(s.holdTimer);
    s.holdTimer = null;
    clearInterval(s.repeatTimer);
    s.repeatTimer = null;
  }

  // -- Ripple -----------------------------------------------------------------

  _createRipple(el, event) {
    const container = el.querySelector('.ripple-container');
    if (!container) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    container.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  // -- Action handling --------------------------------------------------------

  _handleAction(itemIndex, subButton, actionType, anchorEl) {
    const hapticKey = `haptic_${actionType}`;
    if (this._config[hapticKey]) this._hapticFeedback();

    const item = this._items[itemIndex];
    if (!item) return;

    // Source button: open popup on tap unless custom tap_action is configured
    if (item.type === 'source' && actionType === 'tap' && !subButton) {
      if (!item.tap_action || !item.tap_action.action || item.tap_action.action === 'none') {
        this._sourcePopupItemIdx = itemIndex;
        this._openSourcePopup(anchorEl, itemIndex);
        return;
      }
    }

    // Media tile: open source popup on tap unless custom tap_action is configured
    if (item.type === 'media' && actionType === 'tap' && !subButton) {
      if (!item.tap_action || !item.tap_action.action || item.tap_action.action === 'none') {
        this._sourcePopupItemIdx = itemIndex;
        this._openSourcePopup(anchorEl, itemIndex);
        return;
      }
    }

    // Numbers button: open numpad popup on tap unless custom tap_action is configured
    if (item.type === 'numbers' && actionType === 'tap' && !subButton) {
      if (!item.tap_action || !item.tap_action.action || item.tap_action.action === 'none') {
        this._numpadPopupItemIdx = itemIndex;
        this._openNumpadPopup(anchorEl, itemIndex);
        return;
      }
    }

    let actionConfig;
    if (subButton && (item.type === 'dpad' || item.type === 'color_buttons')) {
      actionConfig = item.buttons?.[subButton]?.[`${actionType}_action`];
    } else {
      actionConfig = item[`${actionType}_action`];
    }

    // Entity button default: more-info on tap if no action configured
    if (!actionConfig && item.type === 'entity' && item.entity_id && actionType === 'tap') {
      actionConfig = { action: 'more-info' };
    }

    if (!actionConfig || actionConfig.action === 'none') return;

    // Inject entity for entity buttons so HA knows the target
    if (item.type === 'entity' && item.entity_id) {
      const config = { entity: item.entity_id, [`${actionType}_action`]: actionConfig };
      this._fireHassAction(config, actionType);
      return;
    }

    this._fireHassAction({ [`${actionType}_action`]: actionConfig }, actionType);
  }

  _fireHassAction(config, actionType) {
    const event = new Event('hass-action', { bubbles: true, composed: true });
    event.detail = { config, action: actionType };
    this.dispatchEvent(event);
  }

  _hapticFeedback() {
    try { navigator.vibrate?.(50); } catch (_) {}
  }

  // -- Source resolution (entity-based + manual) ------------------------------

  _getResolvedSources(itemIndex) {
    const item = this._items[itemIndex];
    if (!item) return [];
    const manualSources = item.sources ?? [];
    const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
    if (!entityId || !this.hass) return manualSources;

    const entity = this._getState(entityId);
    if (!entity) return manualSources;

    const domain = entityId.split('.')[0];
    let options = [];
    if (domain === 'select') options = entity.attributes.options ?? [];
    else if (domain === 'media_player') options = entity.attributes.source_list ?? [];
    if (!options.length) return manualSources;

    const manualByName = {};
    const extraManual = [];
    for (const m of manualSources) {
      if (m.name && options.includes(m.name)) manualByName[m.name] = m;
      else extraManual.push(m);
    }

    const autoSources = options.map(option => {
      const tapAction = domain === 'select'
        ? { action: 'perform-action', perform_action: 'select.select_option', target: { entity_id: entityId }, data: { option } }
        : { action: 'perform-action', perform_action: 'media_player.select_source', target: { entity_id: entityId }, data: { source: option } };
      const base = { name: option, tap_action: tapAction };
      const manual = manualByName[option];
      if (manual) {
        const { tap_action: manualTap, ...manualRest } = manual;
        const merged = { ...base, ...manualRest };
        if (manualTap?.action && manualTap.action !== 'none') merged.tap_action = manualTap;
        return merged;
      }
      return base;
    });

    const allSources = [...autoSources, ...extraManual];
    const order = item.source_order;
    if (Array.isArray(order) && order.length > 0) {
      const orderMap = new Map(order.map((name, i) => [name, i]));
      allSources.sort((a, b) => {
        const ai = orderMap.has(a.name) ? orderMap.get(a.name) : order.length;
        const bi = orderMap.has(b.name) ? orderMap.get(b.name) : order.length;
        return ai - bi;
      });
    }
    return allSources.filter(s => !s.hidden);
  }

  _getActiveSourceName(itemIndex) {
    const item = this._items[itemIndex];
    if (!item) return null;
    const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
    if (!entityId || !this.hass) return null;
    const entity = this._getState(entityId);
    if (!entity) return null;
    const domain = entityId.split('.')[0];
    if (domain === 'select') return entity.state;
    if (domain === 'media_player') return entity.attributes.source ?? null;
    return null;
  }

  // -- Source popup ------------------------------------------------------------

  _onWindowPointerDown = (e) => {
    // Close popups when clicking outside the card
    if (!e.composedPath().includes(this)) {
      this._closeSourcePopup();
      this._closeNumpadPopup();
    }
  };

  _addPopupOutsideListener() {
    if (!this._popupOutsideListenerActive) {
      this._popupOutsideListenerActive = true;
      window.addEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }

  _removePopupOutsideListener() {
    if (this._popupOutsideListenerActive && !this._sourcePopupOpen && !this._numpadPopupOpen) {
      this._popupOutsideListenerActive = false;
      window.removeEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }

  _openSourcePopup(anchorEl, itemIndex) {
    this._sourcePopupItemIdx = itemIndex;
    this._sourcePopupOpen = true;
    this._addPopupOutsideListener();
    this.updateComplete.then(() => {
      const menu = this.shadowRoot?.getElementById('source-popup-menu');
      if (!menu || !anchorEl) return;
      const container = this.shadowRoot?.querySelector('.remote-grid');
      if (!container) return;
      const scale = (this._config.scale || 100) / 100;
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let top = (anchorRect.bottom - containerRect.top) / scale + 8;
      // If popup would overflow below the container, position above the anchor instead
      if (top + menuRect.height / scale > containerRect.height / scale) {
        top = (anchorRect.top - containerRect.top) / scale - menuRect.height / scale - 8;
        if (top < 0) top = 0;
      }
      menu.style.setProperty('--grc-popup-top', `${top}px`);
      menu.style.top = `${top}px`;
      let left = (anchorRect.left + anchorRect.width / 2 - containerRect.left) / scale - menuRect.width / scale / 2;
      left = Math.max(0, Math.min(left, containerRect.width / scale - menuRect.width / scale));
      menu.style.left = `${left}px`;
    });
  }

  _closeSourcePopup() {
    if (this._sourcePopupOpen) {
      this._sourcePopupOpen = false;
      this._removePopupOutsideListener();
    }
  }

  _handleSourceTap(source) {
    this._closeSourcePopup();
    if (!source.tap_action || source.tap_action.action === 'none') return;
    if (this._config.haptic_tap) this._hapticFeedback();
    this._fireHassAction({ tap_action: source.tap_action }, 'tap');
  }

  _renderSourcePopup() {
    if (!this._sourcePopupOpen) return '';
    const itemIdx = this._sourcePopupItemIdx;
    const sources = this._getResolvedSources(itemIdx);
    const activeName = this._getActiveSourceName(itemIdx);
    return html`
      <div class="popup-overlay" @click=${() => this._closeSourcePopup()}></div>
      <div class="popup-menu" id="source-popup-menu">
        ${sources.length === 0
          ? html`<div class="source-empty">No sources configured</div>`
          : sources.map(s => this._renderPopupMenuItem(s, s.name === activeName))}
      </div>
    `;
  }

  _renderPopupMenuItem(source, isActive = false) {
    const hasImage = source.image;
    const iconOrImage = hasImage
      ? html`<img class="source-img popup-item-img" src="${source.image}" alt="${source.name || ''}">`
      : html`<ha-icon .icon="${source.icon || 'mdi:video-input-hdmi'}"></ha-icon>`;
    return html`
      <button class="popup-item ${isActive ? 'active' : ''}" @click=${() => this._handleSourceTap(source)}>
        <div class="popup-item-icon-wrap">${iconOrImage}</div>
        <span class="popup-item-label">${source.label || source.name || ''}</span>
      </button>
    `;
  }

  // -- Numpad popup -----------------------------------------------------------

  _openNumpadPopup(anchorEl, itemIndex) {
    this._numpadPopupItemIdx = itemIndex;
    this._numpadPopupOpen = true;
    this._addPopupOutsideListener();
    this.updateComplete.then(() => {
      const menu = this.shadowRoot?.getElementById('numpad-popup-menu');
      if (!menu || !anchorEl) return;
      const container = this.shadowRoot?.querySelector('.remote-grid');
      if (!container) return;
      const scale = (this._config.scale || 100) / 100;
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();

      // Remove max-height constraint for numpad
      menu.style.maxHeight = 'none';

      // Measure menu height first
      const menuRect = menu.getBoundingClientRect();

      // Try below first (compare in viewport coords, then convert to local CSS coords)
      const spaceBelow = containerRect.bottom - anchorRect.bottom - 8 * scale;
      const spaceAbove = anchorRect.top - containerRect.top - 8 * scale;
      if (spaceBelow >= menuRect.height || spaceBelow >= spaceAbove) {
        menu.style.top = `${(anchorRect.bottom - containerRect.top) / scale + 8}px`;
      } else {
        menu.style.top = `${(anchorRect.top - containerRect.top) / scale - menuRect.height / scale - 8}px`;
      }

      let left = (anchorRect.left + anchorRect.width / 2 - containerRect.left) / scale - menuRect.width / scale / 2;
      left = Math.max(0, Math.min(left, containerRect.width / scale - menuRect.width / scale));
      menu.style.left = `${left}px`;
    });
  }

  _closeNumpadPopup() {
    if (this._numpadPopupOpen) {
      this._numpadPopupOpen = false;
      this._removePopupOutsideListener();
    }
  }

  _handleNumpadTap(key) {
    const item = this._items[this._numpadPopupItemIdx];
    if (!item) return;
    const actionConfig = item.buttons?.[key]?.tap_action;
    if (!actionConfig || actionConfig.action === 'none') return;
    if (this._config.haptic_tap) this._hapticFeedback();
    this._fireHassAction({ tap_action: actionConfig }, 'tap');
  }

  _renderNumpadPopup() {
    if (!this._numpadPopupOpen) return '';
    const item = this._items[this._numpadPopupItemIdx];
    const hideDash = item?.hide_dash ?? false;
    const hideEnter = item?.hide_enter ?? false;
    return html`
      <div class="popup-overlay" @click=${() => this._closeNumpadPopup()}></div>
      <div class="popup-menu numpad-popup" id="numpad-popup-menu">
        <div class="numpad-grid">
          ${NUMPAD_KEYS.map(key => {
            const hidden = (key === 'dash' && hideDash) || (key === 'enter' && hideEnter);
            if (hidden) return '';
            const col = key === 'dash' ? '1' : key === '0' ? '2' : key === 'enter' ? '3' : '';
            const style = col ? `grid-column:${col}` : '';
            return html`
              <button class="numpad-btn ${key === 'enter' ? 'numpad-enter' : ''} ${key === 'dash' ? 'numpad-dash' : ''}"
                      style="${style}"
                      @click=${() => this._handleNumpadTap(key)}>
                ${key === 'enter'
                  ? html`<ha-icon icon="mdi:keyboard-return" style="--mdc-icon-size:20px;"></ha-icon>`
                  : NUMPAD_DISPLAY[key]}
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._popupOutsideListenerActive) {
      this._popupOutsideListenerActive = false;
      window.removeEventListener('pointerdown', this._onWindowPointerDown, true);
    }
  }

  // -- Styles -----------------------------------------------------------------

  static get styles() {
    return css`
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
      }

      .dpad-wrapper { width: 100%; height: 100%; }

      /* D-Pad */
      .dpad-ring {
        position: relative;
        margin: 0 auto;
        border-radius: 50%;
        overflow: hidden;
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
        background: var(--grc-btn-bg, var(--card-background-color, var(--ha-card-background, #1c1c1c)));
        border: 2px solid color-mix(in srgb, var(--primary-text-color) 12%, transparent);
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }

      /* Color buttons */
      .color-buttons-wrapper {
        width: 100%;
        height: 100%;
      }
      .color-buttons-row {
        display: flex;
        gap: 8px;
        justify-content: space-evenly;
        align-items: center;
        width: 100%;
        height: 100%;
      }
      .color-btn {
        flex: 0 0 auto !important;
        width: 35px !important;
        height: 20px !important;
        border-radius: 6px !important;
        margin: 0 !important;
      }
      .remote-btn.color-btn:hover {
        background: color-mix(in srgb, var(--grc-btn-bg) 80%, white);
      }
      .remote-btn.color-btn:active {
        filter: var(--grc-item-press-filter);
      }

      /* Slider */
      .slider-wrapper { width: 100%; height: 100%; min-width: 0; overflow: visible; }
      .slider-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        position: relative;
      }
      .slider-item ha-icon {
        --mdc-icon-size: 20px;
        color: var(--grc-item-icon);
        flex-shrink: 0;
      }
      .slider-item.classic input[type=range] {
        flex: 1;
        min-width: 0;
        height: 4px;
        accent-color: var(--primary-color);
        cursor: pointer;
        margin: 0;
      }
      .slider-popup {
        position: absolute;
        top: -30px;
        left: 0;
        background: var(--card-background-color, var(--ha-card-background, #fff));
        color: var(--primary-text-color);
        border-width: var(--ha-card-border-width, 1px);
        border-style: solid;
        border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
        box-shadow: 0 4px 16px rgba(0,0,0,0.22);
        font-size: 12px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
        z-index: 10;
      }
      .slider-popup.visible { opacity: 1; }
      .slider-item.disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .slider-item.vertical {
        flex-direction: column;
      }
      .slider-item.classic.vertical input[type=range] {
        writing-mode: vertical-lr;
        direction: rtl;
        flex: 1;
        min-height: 0;
        width: 4px;
        height: auto;
      }
      .slider-item.vertical .slider-popup {
        top: auto;
        left: -40px;
        bottom: 50%;
      }

      /* Track-based slider variants (pill, rounded, square) */
      .slider-item:not(.classic) {
        gap: 0;
        padding: 0;
      }
      .slider-item:not(.classic) .pill-track {
        position: absolute;
        inset: 0;
        background: var(--grc-item-bg);
        overflow: hidden;
        border-radius: var(--grc-variant-radius, 9999px);
      }
      .slider-item:not(.classic) .pill-fill {
        position: absolute;
        background: color-mix(in srgb, var(--primary-text-color) 28%, transparent);
        transition: width 0.08s linear, height 0.08s linear;
      }
      /* Horizontal: fill grows from left */
      .slider-item:not(.classic):not(.vertical) .pill-fill {
        left: 0; top: 0; bottom: 0;
        width: var(--slider-fill, 0%);
      }
      /* Vertical: fill grows from bottom */
      .slider-item:not(.classic).vertical .pill-fill {
        left: 0; right: 0; bottom: 0;
        height: var(--slider-fill, 0%);
      }
      .slider-item:not(.classic) .pill-icon {
        position: absolute;
        --mdc-icon-size: 22px;
        color: var(--grc-item-icon);
        pointer-events: none;
        z-index: 1;
      }
      .slider-item:not(.classic):not(.vertical) .pill-icon {
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
      }
      .slider-item:not(.classic).vertical .pill-icon {
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
      }
      .slider-item:not(.classic) .slider-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: transparent;
        opacity: 0;
        cursor: pointer;
        z-index: 2;
      }
      .slider-item:not(.classic).vertical .slider-range {
        writing-mode: vertical-lr;
        direction: rtl;
      }

      /* Media tile */
      .media-wrapper { width: 100%; height: 100%; }
      .media-tile {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        background: var(--grc-item-bg);
        -webkit-tap-highlight-color: transparent;
      }
      .media-tile:hover { filter: brightness(1.1); }
      .media-tile:active { filter: brightness(0.9); }
      .media-cover {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      .media-cover-fallback {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .media-tile:not([data-cover-url]) .media-cover-fallback,
      .media-tile.cover-error .media-cover-fallback { display: flex; }
      .media-tile.cover-error .media-cover { display: none; }
      .media-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 6px 10px;
        box-sizing: border-box;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        display: flex;
        flex-direction: column;
        gap: 1px;
        pointer-events: none;
      }
      .media-title {
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      }
      .media-artist {
        font-size: 11px;
        color: rgba(255,255,255,0.8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
      }
      .media-title.marquee, .media-artist.marquee {
        text-overflow: clip;
      }
      .media-title.marquee span, .media-artist.marquee span {
        display: inline-block;
        padding-right: 2em;
        animation: crc-marquee var(--grc-marquee-duration, 10s) linear infinite;
      }
      @keyframes crc-marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }

      /* Regular buttons */
      .remote-btn {
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
        border-radius: var(--grc-variant-radius, 50%);
        background: var(--grc-btn-bg, var(--grc-item-bg));
        -webkit-tap-highlight-color: transparent;
        margin: 0 auto;
      }

      .remote-btn.multi-span {
        width: 100%;
        height: 100%;
      }

      .remote-btn ha-icon {
        --mdc-icon-size: 25px;
        color: var(--grc-item-icon);
        position: relative;
        z-index: 1;
      }
      .remote-btn .btn-text {
        font-size: 12px;
        font-weight: 600;
        color: var(--primary-text-color);
        position: relative;
        z-index: 1;
        font-family: var(--mdc-typography-font-family, Roboto, sans-serif);
        letter-spacing: 0.05em;
      }

      .entity-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        position: relative;
        z-index: 1;
      }

      /* Shared variant radius tokens — consumed by .remote-btn and
         .slider-item:not(.classic) .pill-track via --grc-variant-radius. */
      .round       { --grc-variant-radius: 100%; }
      .rounded     { --grc-variant-radius: 12px; }
      .square      { --grc-variant-radius: 4px; }
      .pill        { --grc-variant-radius: 9999px; }
      .pill-top    { --grc-variant-radius: 9999px 9999px 4px 4px; }
      .pill-bottom { --grc-variant-radius: 4px 4px 9999px 9999px; }
      .pill-left   { --grc-variant-radius: 9999px 4px 4px 9999px; }
      .pill-right  { --grc-variant-radius: 4px 9999px 9999px 4px; }

      /* Ripple */
      .ripple-container {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }
      @keyframes crc-ripple {
        to { transform: scale(2.5); opacity: 0; }
      }
      .ripple {
        position: absolute;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.18;
        transform: scale(0);
        animation: crc-ripple 0.45s ease-out forwards;
        pointer-events: none;
      }

      /* Hover & active */
      .remote-btn:hover {
        background: var(--grc-item-bg-hover);
      }
      .remote-btn:active { filter: var(--grc-item-press-filter); }

      /* Popup */
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
        max-width: 100%;
        max-height: calc(100% - var(--grc-popup-top, 0px) - 8px);
        overflow-x: hidden;
        overflow-y: auto;
        animation: crc-popup-in 0.15s ease-out;
        box-sizing: border-box;
      }
      @keyframes crc-popup-in {
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

      /* Numpad popup */
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

      /* Page swipe & dots */
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
  }
}

// -- Editor schemas -----------------------------------------------------------

const SCHEMA_BUTTON_BASIS = [
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'background_color', selector: { ui_color: {} } },
];

const SVG_SIZING_NORMAL = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 44" width="72" height="44">
    <rect x="1" y="1" width="70" height="42" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" fill="none" opacity="0.4"/>
    <rect x="22" y="4" width="28" height="36" rx="4" fill="currentColor" opacity="0.75"/>
  </svg>`;

const SVG_SIZING_STRETCH = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 44" width="72" height="44">
    <rect x="1" y="1" width="70" height="42" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" fill="none" opacity="0.4"/>
    <rect x="4" y="4" width="64" height="36" rx="4" fill="currentColor" opacity="0.75"/>
  </svg>`;

const SCHEMA_GLOBAL_APPEARANCE = [
  { name: 'card_background_color', selector: { ui_color: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
  { name: 'button_background_color', selector: { ui_color: {} } },
  { name: 'scale', selector: { number: { min: 50, max: 200, step: 5, mode: 'slider', unit_of_measurement: '%' } } },
];

const SCHEMA_GLOBAL_HAPTIC = [
  { name: 'haptic_tap', selector: { boolean: {} } },
  { name: 'haptic_double_tap', selector: { boolean: {} } },
  { name: 'haptic_hold', selector: { boolean: {} } },
  { name: 'hold_repeat_interval', selector: { number: { min: 50, max: 1000, step: 10, mode: 'box', unit_of_measurement: 'ms' } } },
];

const SCHEMA_GRID = [
  { name: '', type: 'grid', schema: [
    { name: 'columns', selector: { number: { min: 1, max: 12, step: 1, mode: 'box' } } },
    { name: 'rows', selector: { number: { min: 1, max: 20, step: 1, mode: 'box' } } },
  ]},
];

const SCHEMA_HOLD_REPEAT = [
  { name: 'hold_repeat', selector: { boolean: {} } },
  { name: 'hold_repeat_interval', selector: { number: { min: 50, max: 1000, step: 10, mode: 'box', unit_of_measurement: 'ms' } } },
];

const SCHEMA_SPAN = [
  { name: '', type: 'grid', schema: [
    { name: 'col_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } },
    { name: 'row_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } },
  ]},
];
const SCHEMA_DPAD_SPAN = [
  { name: 'col_span', selector: { number: { min: 1, max: 7, step: 1, mode: 'box' } } },
];
const SCHEMA_COL_SPAN = SCHEMA_DPAD_SPAN;
const SCHEMA_ROW_SPAN = [
  { name: 'row_span', selector: { number: { min: 1, max: 15, step: 1, mode: 'box' } } },
];

const SCHEMA_VARIANT = [
  { name: 'variant', selector: { select: { options: BUTTON_VARIANTS.map(v => ({ value: v, label: VARIANT_LABELS[v] })), mode: 'dropdown' } } },
];

const SCHEMA_ENTITY = [
  { name: 'entity_id', selector: { entity: {} } },
];

const SCHEMA_SOURCE_ENTITY = [
  { name: 'source_entity', selector: { entity: { include_domains: ['select', 'media_player'] } } },
];

const SCHEMA_SOURCE_ITEM = [
  { name: 'name', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'image', selector: { text: {} } },
];

const SCHEMA_AUTO_SOURCE_ITEM = [
  { name: 'label', selector: { text: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'image', selector: { text: {} } },
];

const SCHEMA_COLOR_BTN_BASIS = [
  { name: 'color', selector: { ui_color: {} } },
  { name: 'icon', selector: { icon: {} } },
  { name: 'text', selector: { text: {} } },
  { name: 'icon_color', selector: { ui_color: {} } },
  { name: 'text_color', selector: { ui_color: {} } },
];

const SCHEMA_NUMPAD_OPTIONS = [
  { name: 'hide_dash', selector: { boolean: {} } },
  { name: 'hide_enter', selector: { boolean: {} } },
];

const SCHEMA_SLIDER_OPTIONS = [
  { name: 'variant', selector: { select: { options: SLIDER_VARIANTS.map(v => ({ value: v, label: VARIANT_LABELS[v] })), mode: 'dropdown' } } },
  { name: 'orientation', selector: { select: { options: [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ], mode: 'dropdown' } } },
  { name: 'attribute', selector: { text: {} } },
  { name: 'min', selector: { number: { mode: 'box' } } },
  { name: 'max', selector: { number: { mode: 'box' } } },
  { name: 'step', selector: { number: { mode: 'box', step: 0.01 } } },
  { name: 'show_icon', selector: { boolean: {} } },
  { name: 'slider_live', selector: { boolean: {} } },
];

const SCHEMA_MEDIA_ENTITY = [
  { name: 'entity_id', selector: { entity: { include_domains: ['media_player'] } } },
];

const SCHEMA_MEDIA_OPTIONS = [
  { name: 'show_info', selector: { boolean: {} } },
  { name: 'scroll_info', selector: { boolean: {} } },
  { name: 'fallback_icon', selector: { icon: {} } },
];

const SCHEMA_ENTITY_TOGGLE = [
  { name: 'show_state_background', selector: { boolean: {} } },
];

const _uiActionSchema = (name) => [{ name, selector: { ui_action: {} } }];

// -- Editor labels / helpers --------------------------------------------------

const EDITOR_LABELS = {
  color: 'Color', hide_dash: 'Hide "-/--"', hide_enter: 'Hide "Enter"',
  icon: 'Icon', text: 'Text',
  icon_color: 'Icon color', text_color: 'Text color',
  background_color: 'Background color',
  card_background_color: 'Card background color',
  button_background_color: 'Button background color',
  scale: 'Scale', width: 'Width', height: 'Height',
  tap_action: 'Tap action', double_tap_action: 'Double-tap action',
  hold_action: 'Hold action',
  haptic_tap: 'On tap', haptic_double_tap: 'On double-tap',
  haptic_hold: 'On hold',
  hold_repeat_interval: 'Repeat interval',
  hold_repeat: 'Repeat on hold',
  col_span: 'Column width', row_span: 'Row height',
  name: 'Name', label: 'Display name', image: 'Image URL',
  entity_id: 'Entity',
  source_entity: 'Source entity',
  variant: 'Variant',
  columns: 'Columns', rows: 'Rows',
  orientation: 'Orientation',
  attribute: 'Attribute', min: 'Minimum', max: 'Maximum', step: 'Step size',
  show_icon: 'Show icon',
  slider_live: 'Send value while dragging',
  show_info: 'Show title/artist',
  scroll_info: 'Scroll text',
  fallback_icon: 'Fallback icon',
  show_state_background: 'Background when active',
};

const EDITOR_HELPERS = {
  color: 'Button color',
  icon: 'MDI icon (empty = default icon)',
  text: 'Text instead of icon (overrides icon)',
  icon_color: 'CSS color or variable',
  text_color: 'CSS color or variable',
  background_color: 'CSS color or variable',
  card_background_color: 'CSS color or variable',
  button_background_color: 'Global background color for all buttons',
  scale: 'Card size in percent (default: 100%)',
  width: 'CSS width value (e.g. fit-content, 100%, 300px). Default: fit-content',
  height: 'CSS height value (e.g. fit-content, 100%, 500px). Default: fit-content',
  label: 'Alternative display name (empty = original name)',
  image: 'URL to an image (e.g. /local/img.png)',
  entity_id: 'Entity for icon/image and default name',
  variant: 'Button shape',
  source_entity: 'Select or media player entity for automatic sources',
  hold_repeat_interval: 'Repeat interval in ms. Default: 200ms',
  hold_repeat: 'Repeat tap action while finger held',
  col_span: 'Number of columns the element spans',
  row_span: 'Number of rows the element spans',
  columns: 'Number of columns in the grid',
  rows: 'Number of rows in the grid',
  attribute: 'Attribute name (empty = auto from domain)',
  min: 'Minimum value (empty = auto)',
  max: 'Maximum value (empty = auto)',
  step: 'Step size (empty = auto)',
  show_icon: 'Show icon next to slider',
  slider_live: 'Send command while dragging instead of on release',
  show_info: 'Show title and artist at bottom',
  scroll_info: 'Scroll long text continuously instead of cutting off',
  fallback_icon: 'Icon if no cover available (default: mdi:music)',
  show_state_background: 'Subtly tint background when entity is active',
};

const _label = (hass, s) => t(hass, EDITOR_LABELS[s.name] ?? s.name);
const _helper = (hass, s) => { const h = EDITOR_HELPERS[s.name]; return h ? t(hass, h) : ''; };

// -- Editor styles ------------------------------------------------------------

const EDITOR_STYLES = css`
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

// -- Editor class -------------------------------------------------------------

class GridRemoteCardEditor extends LitElement {
  static get properties() {
    return {
      hass:             { attribute: false },
      _config:          { state: true },
      _activePanel:     { state: true },
      _openItemIdx:     { state: true },
      _openSubButton:   { state: true },
      _openSourceIdx:   { state: true },
      _dragFromIdx:        { state: true },
      _dragToIdx:          { state: true },
      _currentEditorPage:  { state: true },
      _pendingPreset:      { state: true },
      _presetEntity:       { state: true },
      _presetSecondaryEntity: { state: true },
      _itemYamlMode:       { state: true },
      _conditionDialogOpen: { state: true },
    };
  }

  static get styles() { return EDITOR_STYLES; }

  constructor() {
    super();
    this._config = {};
    this._activePanel = 'layout';
    this._openItemIdx = null;
    this._openSubButton = null;
    this._openSourceIdx = null;
    this._dragFromIdx = null;
    this._dragToIdx = null;
    this._currentEditorPage = 0;
    this._itemYamlMode = false;
    this._ignoreNextSetConfig = false;
    this._pendingPreset = null;
    this._presetEntity = '';
    this._presetSecondaryEntity = '';
    this._gridDragState = null;
    this._addDragState = null;
    this._dialogBoxHandler = null;
    this._dialogBoxEditCard = null;
  }

  /** @returns {Array} Config items with fallback to empty array */
  get _items() { return this._config?.items || []; }

  get _pageCount() { return Math.max(this._config?.page_count || 1, 1); }

  setConfig(config) {
    if (this._ignoreNextSetConfig) {
      this._ignoreNextSetConfig = false;
      return;
    }
    if (!config) throw new Error('Grid Remote Card Editor: Configuration missing');
    this._config = { ...config };
  }

  connectedCallback() {
    super.connectedCallback();
    // Eagerly load dialog-box element for HA native confirmation dialogs
    if (!customElements.get('dialog-box')) {
      const ha = document.querySelector('home-assistant');
      this._dialogBoxEditCard = ha?.shadowRoot?.querySelector('hui-dialog-edit-card');
      if (this._dialogBoxEditCard?._confirmCancel) {
        this._dialogBoxHandler = (e) => {
          if (e.detail?.dialogTag === 'dialog-box') {
            e.stopImmediatePropagation();
            this._dialogBoxEditCard?.removeEventListener('show-dialog', this._dialogBoxHandler, true);
            this._dialogBoxHandler = null;
            this._dialogBoxEditCard = null;
            e.detail.dialogImport?.();
          }
        };
        this._dialogBoxEditCard.addEventListener('show-dialog', this._dialogBoxHandler, { capture: true });
        this._dialogBoxEditCard._confirmCancel();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up dialog-box handler if still pending
    if (this._dialogBoxHandler && this._dialogBoxEditCard) {
      this._dialogBoxEditCard.removeEventListener('show-dialog', this._dialogBoxHandler, true);
      this._dialogBoxHandler = null;
      this._dialogBoxEditCard = null;
    }
  }

  _fireConfigChanged() {
    this._ignoreNextSetConfig = true;
    const config = { ...this._config };
    // Pass current editor page as transient property so the preview card stays on the right page
    if (this._pageCount > 1) {
      config._editor_page = this._currentEditorPage;
    }
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true, composed: true, detail: { config },
    }));
  }

  // -- Render -----------------------------------------------------------------

  render() {
    if (!this._config) return html``;
    return html`
      <div class="tabs">
        <button class="tab ${this._activePanel === 'layout' ? 'active' : ''}"
                @click=${() => { this._activePanel = 'layout'; }}>${t(this.hass, 'Layout')}</button>
        <button class="tab ${this._activePanel === 'settings' ? 'active' : ''}"
                @click=${() => { this._activePanel = 'settings'; }}>${t(this.hass, 'Settings')}</button>
      </div>
      <div class="tab-panel ${this._activePanel === 'layout' ? 'active' : ''}">
        ${this._renderLayoutPanel()}
      </div>
      <div class="tab-panel ${this._activePanel === 'settings' ? 'active' : ''}">
        ${this._renderSettingsPanel()}
      </div>
      ${this._renderConditionDialog()}
    `;
  }

  // -- Layout panel -----------------------------------------------------------

  _renderLayoutPanel() {
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const items = this._items;
    const multiPage = this._pageCount > 1;
    const pageItems = multiPage
      ? items.map((item, i) => [item, i]).filter(([item]) => (item.page || 0) === this._currentEditorPage)
      : items.map((item, i) => [item, i]);
    const cellSize = 44;
    const gridStyle = `grid-template-columns:repeat(${cols},${cellSize}px);grid-template-rows:repeat(${rows},${cellSize}px);`;

    return html`
      ${this._renderSliderInput('columns', cols, 1, 7, t(this.hass, 'Columns'), t(this.hass, 'Number of columns in the grid'))}
      ${this._renderSliderInput('rows', rows, 1, 15, t(this.hass, 'Rows'), t(this.hass, 'Number of rows in the grid'))}

      ${this._renderPageTabs()}
      ${this._renderPresetSelector()}
      <div class="grid-editor-container">
        <div class="grid-editor" style="${gridStyle}">
          ${this._renderGridCells(cols, rows)}
          ${pageItems.map(([item, i]) => this._renderGridEditorItem(item, i))}
        </div>
        <button class="clear-all-btn" @click=${() => this._clearAllItems()} title="${t(this.hass, 'Remove all buttons')}">
          <ha-icon icon="mdi:delete-sweep-outline" style="--mdc-icon-size:20px;"></ha-icon>
        </button>
      </div>
      <div class="drag-trash-zone">
        <ha-icon icon="mdi:delete-outline" style="--mdc-icon-size:20px;"></ha-icon>
      </div>
      <div class="add-item-bar">
        <span class="add-item-label">${t(this.hass, 'Add:')}</span>
        ${ITEM_TYPES.map(type => html`
          <button class="add-type-btn" @pointerdown=${(e) => this._onAddBtnPointerDown(e, type)} title="${t(this.hass, TYPE_LABELS[type])}">
            <ha-icon icon="${TYPE_EDITOR_ICONS[type]}" style="--mdc-icon-size:16px;"></ha-icon>
            <span class="add-type-btn-label">${t(this.hass, TYPE_LABELS[type]).split(' ')[0]}</span>
          </button>
        `)}
      </div>
      ${this._renderSelectedItemEditor()}
    `;
  }

  _renderPresetSelector() {
    if (this._pendingPreset) {
      const preset = REMOTE_PRESETS[this._pendingPreset];
      const hasSecondary = !!preset.secondary_entity_domain;
      const canApply = this._presetEntity && (!hasSecondary || this._presetSecondaryEntity);
      return html`
        <div class="preset-bar preset-form">
          <ha-icon icon="${preset.icon}" style="--mdc-icon-size:18px;"></ha-icon>
          <span class="preset-form-label">${preset.label}</span>
          <ha-selector
            .hass=${this.hass}
            .selector=${{ entity: { domain: preset.entity_domain, ...(preset.entity_integration ? { integration: preset.entity_integration } : {}) } }}
            .value=${this._presetEntity}
            .label=${preset.entity_label}
            @value-changed=${(e) => { this._presetEntity = e.detail.value || ''; }}
            style="flex:1;min-width:180px;"
          ></ha-selector>
          ${hasSecondary ? html`
            <ha-selector
              .hass=${this.hass}
              .selector=${{ entity: { domain: preset.secondary_entity_domain, ...(preset.secondary_entity_integration ? { integration: preset.secondary_entity_integration } : {}) } }}
              .value=${this._presetSecondaryEntity}
              .label=${preset.secondary_entity_label}
              @value-changed=${(e) => { this._presetSecondaryEntity = e.detail.value || ''; }}
              style="flex:1;min-width:180px;"
            ></ha-selector>
          ` : ''}
          <button class="preset-apply-btn" @click=${() => this._confirmApplyPreset()}
                  ?disabled=${!canApply}>${t(this.hass, 'Load')}</button>
          <button class="preset-cancel-btn" @click=${() => { this._pendingPreset = null; this._presetEntity = ''; this._presetSecondaryEntity = ''; }}>${t(this.hass, 'Cancel')}</button>
        </div>
      `;
    }
    return html`
      <div class="preset-bar">
        <span class="preset-label">${t(this.hass, 'Template:')}</span>
        ${Object.entries(REMOTE_PRESETS).map(([key, preset]) => html`
          <button class="preset-btn" @click=${() => { if (preset.entity_domain) { this._pendingPreset = key; this._presetEntity = ''; this._presetSecondaryEntity = ''; } else { this._confirmApplyPresetSimple(key); } }} title="${preset.label}">
            <ha-icon icon="${preset.icon}" style="--mdc-icon-size:16px;"></ha-icon>
            <span>${preset.label}</span>
          </button>
        `)}
      </div>
    `;
  }

  _buildMediaPlayerItems(entityId) {
    const entity = this.hass?.states?.[entityId];
    const features = entity?.attributes?.supported_features ?? 0;
    const has = (flag) => (features & flag) !== 0;

    const items = [];
    let row = 0;

    // Row: Power + Source
    const hasPower = has(MP_FEATURE.TURN_ON) || has(MP_FEATURE.TURN_OFF);
    const hasSource = has(MP_FEATURE.SELECT_SOURCE);
    if (hasPower || hasSource) {
      if (hasPower)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:power',
          tap_action: { action: 'perform-action', perform_action: 'media_player.toggle' } });
      if (hasSource)
        items.push({ type: 'source', row, col: 2, icon: 'mdi:import' });
      row++;
    }

    // Media-Info (always, 3×2)
    items.push({ type: 'media', row, col: 0 });
    row += 2;

    // Transport Row: Prev, Play/Pause, Next
    const hasPrev = has(MP_FEATURE.PREVIOUS_TRACK);
    const hasNext = has(MP_FEATURE.NEXT_TRACK);
    const hasPlay = has(MP_FEATURE.PLAY) || has(MP_FEATURE.PAUSE);
    if (hasPrev || hasPlay || hasNext) {
      if (hasPrev)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:skip-previous',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_previous_track' } });
      if (hasPlay)
        items.push({ type: 'button', row, col: 1, icon: 'mdi:play-pause',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_play_pause' } });
      if (hasNext)
        items.push({ type: 'button', row, col: 2, icon: 'mdi:skip-next',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_next_track' } });
      row++;
    }

    // Extras Row: Shuffle, Stop, Repeat
    const hasShuffle = has(MP_FEATURE.SHUFFLE_SET);
    const hasStop = has(MP_FEATURE.STOP);
    const hasRepeat = has(MP_FEATURE.REPEAT_SET);
    if (hasShuffle || hasStop || hasRepeat) {
      if (hasShuffle)
        items.push({ type: 'button', row, col: 0, icon: 'mdi:shuffle-variant',
          tap_action: { action: 'perform-action', perform_action: 'media_player.shuffle_set' } });
      if (hasStop)
        items.push({ type: 'button', row, col: 1, icon: 'mdi:stop',
          tap_action: { action: 'perform-action', perform_action: 'media_player.media_stop' } });
      if (hasRepeat)
        items.push({ type: 'button', row, col: 2, icon: 'mdi:repeat',
          tap_action: { action: 'perform-action', perform_action: 'media_player.repeat_set' } });
      row++;
    }

    // Volume Row(s): Vol+/Vol- as pills (col 1), Mute (col 0) on Vol- row
    const hasVolume = has(MP_FEATURE.VOLUME_STEP) || has(MP_FEATURE.VOLUME_SET);
    const hasMute = has(MP_FEATURE.VOLUME_MUTE);
    if (hasVolume || hasMute) {
      if (hasVolume) {
        items.push({ type: 'button', variant: 'pill_top', row, col: 1, icon: 'mdi:plus', hold_repeat: true,
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_up' } });
        row++;
        items.push({ type: 'button', variant: 'pill_bottom', row, col: 1, icon: 'mdi:minus', hold_repeat: true,
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_down' } });
      }
      if (hasMute)
        items.push({ type: 'button', row, col: hasVolume ? 0 : 1, icon: 'mdi:volume-off',
          tap_action: { action: 'perform-action', perform_action: 'media_player.volume_mute', data: { is_volume_muted: true } } });
      row++;
    }

    return { items, rows: Math.max(row, 3), columns: 3 };
  }

  _confirmApplyPreset() {
    const key = this._pendingPreset;
    const entityId = this._presetEntity;
    const secondaryEntityId = this._presetSecondaryEntity;
    const preset = REMOTE_PRESETS[key];
    if (!preset || !entityId) return;

    const entityText = secondaryEntityId
      ? `${entityId} + ${secondaryEntityId}`
      : entityId;

    this.dispatchEvent(new CustomEvent('show-dialog', {
      bubbles: true, composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Load template'),
          text: t(this.hass, '"{label}" with {entities}? The current layout will be replaced.', { label: preset.label, entities: entityText }),
          confirmText: t(this.hass, 'Load'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            let items, cols, rows;
            if (preset.dynamic) {
              const built = this._buildMediaPlayerItems(entityId);
              items = built.items;
              cols = built.columns;
              rows = built.rows;
            } else {
              items = JSON.parse(JSON.stringify(preset.items));
              cols = preset.columns;
              rows = preset.rows;
            }
            for (const item of items) {
              const eid = (item._secondary && secondaryEntityId) ? secondaryEntityId : entityId;
              delete item._secondary;
              // Apply entity to media and source items
              if (item.type === 'media') item.entity_id = eid;
              if (item.type === 'source') item.source_entity = eid;
              // Apply entity to all perform-action tap/hold/double_tap actions via data.entity_id
              for (const actionKey of ['tap_action', 'hold_action', 'double_tap_action']) {
                if (item[actionKey]?.action === 'perform-action') {
                  item[actionKey].data = { ...item[actionKey].data, entity_id: eid };
                }
              }
              // Apply entity to sub-button actions (dpad, color_buttons, numbers)
              if (item.buttons) {
                for (const btn of Object.values(item.buttons)) {
                  for (const actionKey of ['tap_action', 'hold_action', 'double_tap_action']) {
                    if (btn[actionKey]?.action === 'perform-action') {
                      btn[actionKey].data = { ...btn[actionKey].data, entity_id: eid };
                    }
                  }
                }
              }
            }
            this._currentEditorPage = 0;
            this._openItemIdx = null;
            this._pendingPreset = null;
            this._presetEntity = '';
            this._presetSecondaryEntity = '';
            this._config = {
              ...this._config,
              columns: cols,
              rows,
              items,
              page_count: undefined,
            };
            this._fireConfigChanged();
          },
        },
      },
    }));
  }

  _confirmApplyPresetSimple(key) {
    const preset = REMOTE_PRESETS[key];
    if (!preset) return;
    this.dispatchEvent(new CustomEvent('show-dialog', {
      bubbles: true, composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Load template'),
          text: t(this.hass, '"{label}"? The current layout will be replaced.', { label: preset.label }),
          confirmText: t(this.hass, 'Load'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            const items = JSON.parse(JSON.stringify(preset.items));
            this._currentEditorPage = 0;
            this._openItemIdx = null;
            this._pendingPreset = null;
            this._presetEntity = '';
            this._presetSecondaryEntity = '';
            this._config = {
              ...this._config,
              columns: preset.columns,
              rows: preset.rows,
              items,
              page_count: undefined,
            };
            this._fireConfigChanged();
          },
        },
      },
    }));
  }

  _renderPageTabs() {
    const count = this._pageCount;
    const tabs = [];
    for (let i = 0; i < count; i++) {
      tabs.push(html`
        <button class="page-tab ${i === this._currentEditorPage ? 'active' : ''}"
                @click=${() => { this._currentEditorPage = i; this._openItemIdx = null; this._fireConfigChanged(); }}>
          ${t(this.hass, 'Page {n}', { n: i + 1 })}
          ${count > 1 ? html`
            <span class="page-tab-delete" @click=${(e) => { e.stopPropagation(); this._deletePage(i); }}
                  title="${t(this.hass, 'Delete page')}">&times;</span>
          ` : ''}
        </button>
      `);
    }
    const currentConds = this._config.page_conditions?.[this._currentEditorPage];
    const hasCondition = currentConds?.length > 0;
    return html`
      <div class="page-tabs-bar">
        ${tabs}
        <button class="page-tab page-tab-add" @click=${this._addPage} title="${t(this.hass, 'New page')}">+</button>
      </div>
      ${count > 1 ? html`
        <button class="page-condition-btn ${hasCondition ? 'active' : ''}"
                @click=${() => { this._conditionDialogOpen = true; }}>
          <ha-icon icon="mdi:swap-horizontal" style="--mdc-icon-size:16px;"></ha-icon>
          ${t(this.hass, 'Conditions')}${hasCondition ? ' ' + t(this.hass, '(active)') : ''}
        </button>
      ` : ''}
    `;
  }

  _addPage() {
    const newCount = this._pageCount + 1;
    this._config = { ...this._config, page_count: newCount };
    this._currentEditorPage = newCount - 1;
    this._openItemIdx = null;
    this._fireConfigChanged();
  }

  _onPageConditionChanged(e) {
    e.stopPropagation();
    const conditions = e.detail.value;
    const pageIdx = this._currentEditorPage;
    const conds = [...(this._config.page_conditions || [])];
    while (conds.length <= pageIdx) conds.push(null);
    conds[pageIdx] = conditions?.length ? conditions : null;
    while (conds.length > 0 && !conds[conds.length - 1]) conds.pop();
    const newConfig = { ...this._config };
    if (conds.length) newConfig.page_conditions = conds;
    else delete newConfig.page_conditions;
    this._config = newConfig;
    this._fireConfigChanged();
  }

  _renderConditionDialog() {
    if (!this._conditionDialogOpen) return '';
    const currentConds = this._config.page_conditions?.[this._currentEditorPage] ?? [];
    return html`
      <ha-dialog
        open
        @closed=${(e) => { e.stopPropagation(); this._conditionDialogOpen = false; }}
      >
        <ha-icon-button slot="headerNavigationIcon"
          @click=${(e) => { e.target.closest('ha-dialog').open = false; }}
        >
          <ha-icon icon="mdi:close"></ha-icon>
        </ha-icon-button>
        <span slot="headerTitle">${t(this.hass, 'Conditions — Page {n}', { n: this._currentEditorPage + 1 })}</span>
        <div style="padding:0 24px 24px;">
          <ha-alert alert-type="info" style="display:block;margin-bottom:16px;">
            ${t(this.hass, 'When the condition is met, the card will automatically switch to this page.')}
          </ha-alert>
          <ha-card-conditions-editor
            .hass=${this.hass}
            .conditions=${currentConds}
            @value-changed=${this._onPageConditionChanged}
          ></ha-card-conditions-editor>
        </div>
      </ha-dialog>
    `;
  }

  _deletePage(pageIdx) {
    const count = this._pageCount;
    if (count <= 1) return;
    const hasItems = this._items.some(item => (item.page || 0) === pageIdx);
    if (hasItems) {
      const event = new CustomEvent('show-dialog', {
        bubbles: true,
        composed: true,
        detail: {
          dialogTag: 'dialog-box',
          dialogImport: () => Promise.resolve(),
          dialogParams: {
            title: t(this.hass, 'Delete page'),
            text: t(this.hass, 'Page {n} still contains buttons. Delete page and all its buttons?', { n: pageIdx + 1 }),
            confirmText: t(this.hass, 'Delete'),
            dismissText: t(this.hass, 'Cancel'),
            destructive: true,
            confirm: () => this._doDeletePage(pageIdx),
          },
        },
      });
      this.dispatchEvent(event);
    } else {
      this._doDeletePage(pageIdx);
    }
  }

  _doDeletePage(pageIdx) {
    const count = this._pageCount;
    // Remove items on deleted page, shift higher pages down
    const items = this._items
      .filter(item => (item.page || 0) !== pageIdx)
      .map(item => {
        const p = item.page || 0;
        if (p > pageIdx) return { ...item, page: p - 1 };
        return item;
      });
    // Clean up page:0 since it's the default
    for (const item of items) {
      if (item.page === 0) delete item.page;
    }
    const newCount = count - 1;
    const config = { ...this._config, items, page_count: newCount > 1 ? newCount : undefined };
    // Update page_conditions: remove entry for deleted page, shift higher indices
    if (config.page_conditions) {
      const conds = [...config.page_conditions];
      conds.splice(pageIdx, 1);
      while (conds.length > 0 && !conds[conds.length - 1]) conds.pop();
      if (conds.length) config.page_conditions = conds;
      else delete config.page_conditions;
    }
    this._config = config;
    if (this._currentEditorPage >= newCount) this._currentEditorPage = newCount - 1;
    this._openItemIdx = null;
    this._fireConfigChanged();
  }

  _renderSpanEditor(item, index) {
    const base = ITEM_SIZES[item.type];
    if (!base) return '';
    const size = _getItemSize(item);
    if (item.type === 'dpad') {
      return html`
        ${this._renderCollapsible(`item-${index}-span`, t(this.hass, 'Size'), false, html`
          <ha-form .hass=${this.hass}
            .data=${{ col_span: size.cols }}
            .schema=${SCHEMA_DPAD_SPAN}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onSpanChanged(e, index)}
          ></ha-form>
        `)}
      `;
    }
    if (item.type === 'slider') {
      const isVertical = item.orientation === 'vertical';
      return html`
        ${this._renderCollapsible(`item-${index}-span`, t(this.hass, 'Size'), false, html`
          <ha-form .hass=${this.hass}
            .data=${isVertical ? { row_span: size.rows } : { col_span: size.cols }}
            .schema=${isVertical ? SCHEMA_ROW_SPAN : SCHEMA_COL_SPAN}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onSpanChanged(e, index)}
          ></ha-form>
        `)}
      `;
    }
    if (item.type === 'color_buttons') {
      return html`
        ${this._renderCollapsible(`item-${index}-span`, t(this.hass, 'Size'), false, html`
          <ha-form .hass=${this.hass}
            .data=${{ col_span: size.cols }}
            .schema=${SCHEMA_COL_SPAN}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onSpanChanged(e, index)}
          ></ha-form>
        `)}
      `;
    }
    return html`
      ${this._renderCollapsible(`item-${index}-span`, t(this.hass, 'Size'), false, html`
        <ha-form .hass=${this.hass}
          .data=${{ col_span: size.cols, row_span: size.rows }}
          .schema=${SCHEMA_SPAN}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onSpanChanged(e, index)}
        ></ha-form>
      `)}
    `;
  }

  _onSpanChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    const base = ITEM_SIZES[item.type];
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;

    let colSpan, rowSpan;
    if (item.type === 'dpad') {
      colSpan = val.col_span || base.cols;
      rowSpan = colSpan;
    } else if (item.type === 'slider') {
      if (item.orientation === 'vertical') {
        colSpan = 1;
        rowSpan = val.row_span || base.cols;
      } else {
        colSpan = val.col_span || base.cols;
        rowSpan = 1;
      }
    } else if (item.type === 'color_buttons') {
      colSpan = val.col_span || base.cols;
      rowSpan = 1;
    } else {
      colSpan = val.col_span || base.cols;
      rowSpan = val.row_span || base.rows;
    }

    // Clamp to grid bounds
    colSpan = Math.min(colSpan, cols - item.col);
    rowSpan = Math.min(rowSpan, rows - item.row);

    // Check overlap — only apply if valid
    const testItem = { ...item, col_span: colSpan, row_span: rowSpan };
    const testSize = _getItemSize(testItem);
    const page = item.page || 0;
    if (!this._canPlaceAt(items, index, testSize, item.row, item.col, cols, rows, undefined, page)) return;

    // Slider vertical has an asymmetric default: row_span falls back to
    // base.cols (3) in _getItemSize, so compare against that for the delete.
    if (item.type === 'slider' && item.orientation === 'vertical') {
      delete item.col_span;
      if (rowSpan !== base.cols) item.row_span = rowSpan;
      else delete item.row_span;
    } else {
      if (colSpan !== base.cols) item.col_span = colSpan;
      else delete item.col_span;
      if (rowSpan !== base.rows) item.row_span = rowSpan;
      else delete item.row_span;
    }

    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _renderSelectedItemEditor() {
    const items = this._items;
    const selectedItem = this._openItemIdx != null ? items[this._openItemIdx] : null;
    if (!selectedItem) return '';
    return html`
      <div class="button-editor-below">
        <div class="button-editor-below-header">
          <ha-icon .icon="${this._resolveEditorIcon(selectedItem)}" style="--mdc-icon-size:18px;"></ha-icon>
          <span>${t(this.hass, TYPE_LABELS[selectedItem.type] || selectedItem.type)}${selectedItem.variant ? ` (${t(this.hass, VARIANT_LABELS[selectedItem.variant] || selectedItem.variant)})` : ''} - ${t(this.hass, 'R{row}, C{col}', { row: selectedItem.row, col: selectedItem.col })}</span>
          <button class="yaml-toggle-btn ${this._itemYamlMode ? 'active' : ''}"
                  @click=${() => { this._itemYamlMode = !this._itemYamlMode; }}
                  title="${this._itemYamlMode ? t(this.hass, 'Show UI editor') : t(this.hass, 'Edit as YAML')}">
            <ha-icon icon="mdi:code-braces" style="--mdc-icon-size:18px;"></ha-icon>
          </button>
        </div>
        ${this._itemYamlMode
          ? this._renderItemYamlEditor(selectedItem, this._openItemIdx)
          : html`
            ${this._renderSpanEditor(selectedItem, this._openItemIdx)}
            ${selectedItem.type === 'dpad' ? this._renderDpadEditor(selectedItem, this._openItemIdx)
              : selectedItem.type === 'color_buttons' ? this._renderColorButtonsEditor(selectedItem, this._openItemIdx)
              : selectedItem.type === 'numbers' ? this._renderNumbersEditor(selectedItem, this._openItemIdx)
              : selectedItem.type === 'slider' ? this._renderSliderEditor(selectedItem, this._openItemIdx)
              : selectedItem.type === 'media' ? this._renderMediaEditor(selectedItem, this._openItemIdx)
              : this._renderItemBasisEditor(selectedItem, this._openItemIdx)}
          `}
      </div>
    `;
  }

  _renderItemYamlEditor(item, index) {
    const yaml = this._itemToYaml(item);
    return html`
      <div class="item-yaml-editor">
        <ha-code-editor
          .hass=${this.hass}
          .value=${yaml}
          mode="yaml"
          autocompleteEntities
          autocompleteIcons
          @value-changed=${(e) => this._onItemYamlChanged(e, index)}
        ></ha-code-editor>
      </div>
    `;
  }

  _itemToYaml(item) {
    const obj = { ...item };
    delete obj.row;
    delete obj.col;
    try {
      const dump = (o, indent = 0) => {
        const pad = '  '.repeat(indent);
        if (o === null || o === undefined) return 'null';
        if (typeof o === 'boolean') return o ? 'true' : 'false';
        if (typeof o === 'number') return String(o);
        if (typeof o === 'string') return /[\n:#{}\[\],&*?|>!%@`]/.test(o) || o === '' || o === 'true' || o === 'false' || o === 'null' || o !== o.trim() ? `"${o.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : o;
        if (Array.isArray(o)) {
          if (o.length === 0) return '[]';
          return o.map(v => `${pad}- ${dump(v, indent + 1).trimStart()}`).join('\n');
        }
        if (typeof o === 'object') {
          const keys = Object.keys(o);
          if (keys.length === 0) return '{}';
          return keys.map(k => {
            const v = o[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return `${pad}${k}:\n${dump(v, indent + 1)}`;
            }
            if (Array.isArray(v)) {
              return `${pad}${k}:\n${dump(v, indent + 1)}`;
            }
            return `${pad}${k}: ${dump(v, indent)}`;
          }).join('\n');
        }
        return String(o);
      };
      return dump(obj);
    } catch (_) { return ''; }
  }

  _yamlToItem(yaml, origItem) {
    try {
      const lines = yaml.split('\n');
      const result = {};
      const stack = [{ obj: result, indent: -1 }];
      for (const rawLine of lines) {
        if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;
        const indent = rawLine.search(/\S/);
        const line = rawLine.trim();
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        const parent = stack[stack.length - 1].obj;
        if (line.startsWith('- ')) {
          if (!Array.isArray(parent)) continue;
          const val = this._parseYamlValue(line.slice(2).trim());
          if (val && typeof val === 'object' && val.__needsNest) {
            const o = {}; o[val.key] = val.value;
            parent.push(o);
            stack.push({ obj: o, indent });
          } else { parent.push(val); }
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const rest = line.slice(colonIdx + 1).trim();
        if (rest === '' || rest === '|' || rest === '>') {
          const nextNonEmpty = lines.slice(lines.indexOf(rawLine) + 1).find(l => l.trim() !== '');
          if (nextNonEmpty && nextNonEmpty.trim().startsWith('- ')) {
            parent[key] = [];
            stack.push({ obj: parent[key], indent });
          } else {
            parent[key] = {};
            stack.push({ obj: parent[key], indent });
          }
        } else {
          parent[key] = this._parseYamlValue(rest);
        }
      }
      result.row = origItem.row;
      result.col = origItem.col;
      if (origItem.colspan && !result.colspan) result.colspan = origItem.colspan;
      if (origItem.rowspan && !result.rowspan) result.rowspan = origItem.rowspan;
      return result;
    } catch (_) { return null; }
  }

  _parseYamlValue(s) {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (s === '[]') return [];
    if (s === '{}') return {};
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
    const colonIdx = s.indexOf(':');
    if (colonIdx > 0 && !s.startsWith('{')) {
      return { __needsNest: true, key: s.slice(0, colonIdx).trim(), value: this._parseYamlValue(s.slice(colonIdx + 1).trim()) };
    }
    return s;
  }

  _onItemYamlChanged(e, index) {
    e.stopPropagation();
    const yaml = e.detail.value;
    if (!yaml) return;
    const items = [...this._items];
    const origItem = items[index];
    const newItem = this._yamlToItem(yaml, origItem);
    if (!newItem || !newItem.type) return;
    items[index] = newItem;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _renderGridCells(cols, rows) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push(html`
          <div class="grid-bg-cell" style="grid-row:${r + 1};grid-column:${c + 1};" data-row="${r}" data-col="${c}"></div>
        `);
      }
    }
    return cells;
  }

  _resolveEditorIcon(item) {
    if (item.type === 'dpad') return 'mdi:gamepad-variant-outline';
    if (item.type === 'color_buttons') return 'mdi:palette';
    if (item.icon) return item.icon;
    if ((item.type === 'entity' || item.type === 'slider' || item.type === 'media') && item.entity_id && this.hass) {
      const stateObj = this.hass.states[item.entity_id] ?? null;
      if (stateObj?.attributes?.icon) return stateObj.attributes.icon;
    }
    return TYPE_EDITOR_ICONS[item.type] || 'mdi:help';
  }

  _renderGridEditorItem(item, idx) {
    if (!ITEM_SIZES[item.type]) return html``;
    const size = _getItemSize(item);
    const icon = this._resolveEditorIcon(item);
    const text = item.type !== 'dpad' && item.type !== 'color_buttons' && item.text ? item.text : '';
    const isSelected = this._openItemIdx === idx;

    return html`
      <div class="grid-editor-item ${isSelected ? 'selected' : ''} type-${item.type}"
           style="grid-row:${item.row + 1}/span ${size.rows};grid-column:${item.col + 1}/span ${size.cols};"
           @pointerdown=${(e) => this._onGridItemPointerDown(e, idx)}>
        ${text
          ? html`<span class="grid-item-text">${text}</span>`
          : html`<ha-icon icon="${icon}"></ha-icon>`}
        <button class="grid-item-delete"
                @pointerdown=${(e) => e.stopPropagation()}
                @click=${(e) => { e.stopPropagation(); this._deleteItem(idx); }}>
          <ha-icon icon="mdi:close" style="--mdc-icon-size:12px;"></ha-icon>
        </button>
      </div>
    `;
  }

  // -- Grid drag-and-drop -----------------------------------------------------

  _onGridItemPointerDown(e, idx) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        this._startGridDrag(el, idx, ev);
      }
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      // Simple click => open editor
      const opening = this._openItemIdx !== idx;
      this._openItemIdx = opening ? idx : null;
      if (opening) {
        this.updateComplete.then(() => {
          setTimeout(() => {
            const ed = this.shadowRoot?.querySelector('.button-editor-below');
            if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 150);
        });
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }

  _startGridDrag(el, idx, e) {
    const gridEl = this.shadowRoot.querySelector('.tab-panel.active .grid-editor');
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;

    const item = this._items[idx];
    const cellW = gridRect.width / cols;
    const cellH = gridRect.height / rows;
    const grabCol = Math.floor((e.clientX - gridRect.left) / cellW) - item.col;
    const grabRow = Math.floor((e.clientY - gridRect.top) / cellH) - item.row;
    const size = _getItemSize(item);
    const anchorCol = Math.max(0, Math.min(grabCol, size.cols - 1));
    const anchorRow = Math.max(0, Math.min(grabRow, size.rows - 1));

    const trashEl = this.shadowRoot.querySelector('.drag-trash-zone');
    if (trashEl) trashEl.classList.add('visible');

    this._gridDragState = {
      itemIdx: idx, el, startX: e.clientX, startY: e.clientY,
      gridRect, cols, rows, targetRow: null, targetCol: null, targetValid: false,
      anchorCol, anchorRow, trashEl, overTrash: false,
    };
    el.classList.add('dragging');

    const onMove = (ev) => this._onGridDragMove(ev);
    const onUp = (ev) => { this._onGridDragEnd(ev); cleanup(); };
    const onCancel = (ev) => { this._onGridDragCancel(ev); cleanup(); };
    const cleanup = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  }

  _onGridDragMove(e) {
    const d = this._gridDragState;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.el.style.transform = `translate(${dx}px, ${dy}px)`;

    const pointerCol = Math.floor((e.clientX - d.gridRect.left) / (d.gridRect.width / d.cols));
    const pointerRow = Math.floor((e.clientY - d.gridRect.top) / (d.gridRect.height / d.rows));
    const col = pointerCol - d.anchorCol;
    const row = pointerRow - d.anchorRow;

    // Clear highlights
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));

    if (pointerCol >= 0 && pointerCol < d.cols && pointerRow >= 0 && pointerRow < d.rows) {
      const items = this._items;
      const item = items[d.itemIdx];
      const size = _getItemSize(item);
      const page = items[d.itemIdx]?.page || 0;
      let valid = this._canPlaceAt(items, d.itemIdx, size, row, col, d.cols, d.rows, undefined, page);
      let swapPlacements = null;

      if (!valid) {
        swapPlacements = this._canSwapWith(items, d.itemIdx, row, col, d.cols, d.rows, page);
        if (swapPlacements) valid = true;
      }

      // Highlight target cells
      for (let r = row; r < Math.min(row + size.rows, d.rows); r++) {
        for (let c = col; c < Math.min(col + size.cols, d.cols); c++) {
          const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) cell.classList.add('highlight', valid ? 'valid' : 'invalid');
        }
      }
      // Highlight swap partner cells
      if (swapPlacements) {
        for (const p of swapPlacements) {
          const swapItem = items[p.idx];
          const ss = _getItemSize(swapItem);
          for (let r = swapItem.row; r < swapItem.row + ss.rows; r++) {
            for (let c = swapItem.col; c < swapItem.col + ss.cols; c++) {
              const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
              if (cell) cell.classList.add('highlight', 'swap');
            }
          }
        }
      }
      d.targetRow = row;
      d.targetCol = col;
      d.targetValid = valid;
      d.swapPlacements = swapPlacements;
    }

    // Check trash zone
    if (d.trashEl) {
      const tr = d.trashEl.getBoundingClientRect();
      const over = e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
      d.trashEl.classList.toggle('hover', over);
      d.overTrash = over;
    }
  }

  _onGridDragEnd(e) {
    const d = this._gridDragState;
    if (!d) return;
    d.el.style.transform = '';
    d.el.classList.remove('dragging');
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));
    if (d.trashEl) { d.trashEl.classList.remove('visible', 'hover'); }

    if (d.overTrash) {
      this._deleteItem(d.itemIdx);
    } else if (d.targetValid && d.targetRow != null) {
      const items = [...this._items];
      items[d.itemIdx] = { ...items[d.itemIdx], row: d.targetRow, col: d.targetCol };
      if (d.swapPlacements) {
        for (const p of d.swapPlacements) {
          items[p.idx] = { ...items[p.idx], row: p.row, col: p.col };
        }
      }
      this._config = { ...this._config, items };
      this._fireConfigChanged();
    }
    this._gridDragState = null;
  }

  _onGridDragCancel() {
    const d = this._gridDragState;
    if (!d) return;
    d.el.style.transform = '';
    d.el.classList.remove('dragging');
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid', 'swap'));
    if (d.trashEl) { d.trashEl.classList.remove('visible', 'hover'); }
    this._gridDragState = null;
  }

  // -- Drag-to-add from add-item-bar ------------------------------------------

  _onAddBtnPointerDown(e, type) {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const btnEl = e.currentTarget;
    const pointerId = e.pointerId;
    btnEl.setPointerCapture(pointerId);

    const isTouch = e.pointerType === 'touch';
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5) {
        btnEl.removeEventListener('pointermove', onMove);
        btnEl.removeEventListener('pointerup', onUp);
        btnEl.releasePointerCapture(pointerId);
        this._startAddDrag(type, ev, isTouch);
      }
    };
    const onUp = () => {
      btnEl.removeEventListener('pointermove', onMove);
      btnEl.removeEventListener('pointerup', onUp);
      this._addItem(type);
    };
    btnEl.addEventListener('pointermove', onMove);
    btnEl.addEventListener('pointerup', onUp);
  }

  _startAddDrag(type, e, isTouch) {
    const gridEl = this.shadowRoot.querySelector('.tab-panel.active .grid-editor');
    if (!gridEl) return;
    const gridRect = gridEl.getBoundingClientRect();
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const size = ITEM_SIZES[type];
    const cellW = gridRect.width / cols;
    const cellH = gridRect.height / rows;
    const touchOffsetY = isTouch ? cellH * size.rows + 20 : 0;

    // Create ghost element
    const ghost = document.createElement('div');
    ghost.className = `grid-editor-item type-${type} dragging`;
    ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${cellW * size.cols - 4}px;height:${cellH * size.rows - 4}px;left:0;top:0;`;
    const icon = TYPE_EDITOR_ICONS[type];
    ghost.innerHTML = `<ha-icon icon="${icon}" style="--mdc-icon-size:20px;pointer-events:none;"></ha-icon>`;
    this.shadowRoot.appendChild(ghost);
    // Measure containing block offset (fixed positioning inside transformed parents)
    const ghostRect = ghost.getBoundingClientRect();
    const offsetX = ghostRect.left;
    const offsetY = ghostRect.top;
    ghost.style.left = `${e.clientX - (cellW * size.cols) / 2 - offsetX}px`;
    ghost.style.top = `${e.clientY - (cellH * size.rows) / 2 - offsetY - touchOffsetY}px`;

    this._addDragState = {
      type, ghost, gridRect, cols, rows, size, offsetX, offsetY, touchOffsetY,
      targetRow: null, targetCol: null, targetValid: false,
    };

    const onMove = (ev) => this._onAddDragMove(ev);
    const onUp = (ev) => { this._onAddDragEnd(ev); cleanup(); };
    const onCancel = () => { this._onAddDragCancel(); cleanup(); };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }

  _onAddDragMove(e) {
    const d = this._addDragState;
    if (!d) return;
    const cellW = d.gridRect.width / d.cols;
    const cellH = d.gridRect.height / d.rows;
    d.ghost.style.left = `${e.clientX - (cellW * d.size.cols) / 2 - d.offsetX}px`;
    d.ghost.style.top = `${e.clientY - (cellH * d.size.rows) / 2 - d.offsetY - d.touchOffsetY}px`;

    const centerCol = (e.clientX - d.gridRect.left) / cellW;
    const centerRow = (e.clientY - d.touchOffsetY - d.gridRect.top) / cellH;
    const col = Math.round(centerCol - d.size.cols / 2);
    const row = Math.round(centerRow - d.size.rows / 2);

    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));

    if (centerCol >= 0 && centerCol < d.cols && centerRow >= 0 && centerRow < d.rows) {
      const items = this._items;
      const page = this._pageCount > 1 ? this._currentEditorPage : undefined;
      const valid = this._canPlaceAt(items, -1, d.size, row, col, d.cols, d.rows, undefined, page);

      for (let r = row; r < Math.min(row + d.size.rows, d.rows); r++) {
        for (let c = col; c < Math.min(col + d.size.cols, d.cols); c++) {
          const cell = this.shadowRoot.querySelector(`.grid-bg-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) cell.classList.add('highlight', valid ? 'valid' : 'invalid');
        }
      }
      d.targetRow = row;
      d.targetCol = col;
      d.targetValid = valid;
    } else {
      d.targetValid = false;
    }
  }

  _onAddDragEnd() {
    const d = this._addDragState;
    if (!d) return;
    d.ghost.remove();
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));

    if (d.targetValid && d.targetRow != null) {
      const items = [...this._items];
      const newItem = { type: d.type, row: d.targetRow, col: d.targetCol };
      if (TYPE_DEFAULT_ICONS[d.type]) newItem.icon = TYPE_DEFAULT_ICONS[d.type];
      const page = this._pageCount > 1 ? this._currentEditorPage : 0;
      if (page > 0) newItem.page = page;
      items.push(newItem);
      this._config = { ...this._config, items };
      this._fireConfigChanged();
    }
    this._addDragState = null;
  }

  _onAddDragCancel() {
    const d = this._addDragState;
    if (!d) return;
    d.ghost.remove();
    this.shadowRoot.querySelectorAll('.grid-bg-cell.highlight').forEach(c => c.classList.remove('highlight', 'valid', 'invalid'));
    this._addDragState = null;
  }

  _canPlaceAt(items, excludeIdx, size, row, col, cols, rows, excludeIdx2, page) {
    if (row < 0 || col < 0 || row + size.rows > rows || col + size.cols > cols) return false;
    for (let i = 0; i < items.length; i++) {
      if (i === excludeIdx || i === excludeIdx2) continue;
      const other = items[i];
      // If page filtering is active, skip items on different pages
      if (page !== undefined && (other.page || 0) !== page) continue;
      const os = _getItemSize(other);
      if (!(row + size.rows <= other.row || row >= other.row + os.rows ||
            col + size.cols <= other.col || col >= other.col + os.cols)) {
        return false;
      }
    }
    return true;
  }

  _canSwapWith(items, dragIdx, targetRow, targetCol, cols, rows, page) {
    const dragItem = items[dragIdx];
    const dragSize = _getItemSize(dragItem);
    // Bounds check for dragged item at target
    if (targetRow < 0 || targetCol < 0 || targetRow + dragSize.rows > rows || targetCol + dragSize.cols > cols) return null;
    // Find all items overlapping with the target position (excluding dragged item)
    const overlapping = [];
    for (let i = 0; i < items.length; i++) {
      if (i === dragIdx) continue;
      const other = items[i];
      if (page !== undefined && (other.page || 0) !== page) continue;
      const os = _getItemSize(other);
      if (!(targetRow + dragSize.rows <= other.row || targetRow >= other.row + os.rows ||
            targetCol + dragSize.cols <= other.col || targetCol >= other.col + os.cols)) {
        overlapping.push(i);
      }
    }
    if (overlapping.length === 0) return null;

    // Build set of freed cells (old position of dragged item)
    const freedCells = [];
    for (let r = dragItem.row; r < dragItem.row + dragSize.rows; r++) {
      for (let c = dragItem.col; c < dragItem.col + dragSize.cols; c++) {
        freedCells.push({ r, c });
      }
    }

    // Exclude dragged item + all overlapping items from collision checks
    const excludeSet = new Set([dragIdx, ...overlapping]);

    // Build occupancy grid of cells taken by non-excluded items (same page only)
    const occupied = new Set();
    for (let i = 0; i < items.length; i++) {
      if (excludeSet.has(i)) continue;
      const it = items[i];
      if (page !== undefined && (it.page || 0) !== page) continue;
      const sz = _getItemSize(it);
      for (let r = it.row; r < it.row + sz.rows; r++) {
        for (let c = it.col; c < it.col + sz.cols; c++) {
          occupied.add(`${r},${c}`);
        }
      }
    }
    // Also mark the target cells (where dragged item will go) as occupied
    for (let r = targetRow; r < targetRow + dragSize.rows; r++) {
      for (let c = targetCol; c < targetCol + dragSize.cols; c++) {
        occupied.add(`${r},${c}`);
      }
    }

    // Greedily place each overlapping item into the freed cells (larger items first)
    const sorted = [...overlapping].sort((a, b) => {
      const sa = _getItemSize(items[a]), sb = _getItemSize(items[b]);
      return (sb.rows * sb.cols) - (sa.rows * sa.cols);
    });

    const placements = [];
    for (const idx of sorted) {
      const sz = _getItemSize(items[idx]);
      let placed = false;
      // Try each freed cell as top-left corner
      for (const { r: fr, c: fc } of freedCells) {
        if (fr + sz.rows > rows || fc + sz.cols > cols) continue;
        // Check all cells this item would occupy are free
        let fits = true;
        for (let r = fr; r < fr + sz.rows && fits; r++) {
          for (let c = fc; c < fc + sz.cols && fits; c++) {
            if (occupied.has(`${r},${c}`)) fits = false;
          }
        }
        if (fits) {
          placements.push({ idx, row: fr, col: fc });
          // Mark cells as occupied
          for (let r = fr; r < fr + sz.rows; r++) {
            for (let c = fc; c < fc + sz.cols; c++) {
              occupied.add(`${r},${c}`);
            }
          }
          placed = true;
          break;
        }
      }
      if (!placed) return null;
    }
    return placements;
  }

  _addItem(type) {
    const cols = this._config.columns || 3;
    const rows = this._config.rows || 9;
    const items = [...this._items];
    const size = ITEM_SIZES[type];
    const page = this._pageCount > 1 ? this._currentEditorPage : 0;

    for (let r = 0; r <= rows - size.rows; r++) {
      for (let c = 0; c <= cols - size.cols; c++) {
        if (this._canPlaceAt(items, -1, size, r, c, cols, rows, -1, page)) {
          const newItem = { type, row: r, col: c };
          if (TYPE_DEFAULT_ICONS[type]) newItem.icon = TYPE_DEFAULT_ICONS[type];
          if (page > 0) newItem.page = page;
          items.push(newItem);
          this._config = { ...this._config, items };
          this._fireConfigChanged();
          return;
        }
      }
    }
  }

  _deleteItem(idx) {
    const items = this._items.filter((_, i) => i !== idx);
    if (this._openItemIdx === idx) this._openItemIdx = null;
    else if (this._openItemIdx != null && this._openItemIdx > idx) this._openItemIdx--;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _clearAllItems() {
    const event = new CustomEvent('show-dialog', {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: 'dialog-box',
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          title: t(this.hass, 'Confirmation'),
          text: this._pageCount > 1 ? t(this.hass, 'Remove all buttons from page {n}?', { n: this._currentEditorPage + 1 }) : t(this.hass, 'Remove all buttons from layout?'),
          confirmText: t(this.hass, 'Remove'),
          dismissText: t(this.hass, 'Cancel'),
          destructive: true,
          confirm: () => {
            this._openItemIdx = null;
            const page = this._currentEditorPage;
            const items = this._pageCount > 1
              ? this._items.filter(item => (item.page || 0) !== page)
              : [];
            this._config = { ...this._config, items };
            this._fireConfigChanged();
          },
        },
      },
    });
    this.dispatchEvent(event);
  }

  _renderDpadEditor(item, index) {
    return html`
      ${DPAD_DIRS.map(dir => {
        const isSubOpen = this._openSubButton === `${index}-${dir}`;
        const btnCfg = item.buttons?.[dir] || {};
        const defaults = DPAD_DEFAULTS[dir];
        const icon = btnCfg.icon || defaults.icon;
        return html`
          <div class="button-item" style="margin-left:8px;">
            <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
                 @click=${() => { this._openSubButton = isSubOpen ? null : `${index}-${dir}`; }}>
              <ha-icon class="button-item-icon" .icon="${icon}"></ha-icon>
              <span class="button-item-label">${t(this.hass, DPAD_LABELS[dir])}</span>
              <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
            </div>
            ${isSubOpen ? html`
              <div class="button-editor-slot">
                ${this._renderDpadBtnEditor(item, index, dir)}
              </div>
            ` : ''}
          </div>
        `;
      })}
    `;
  }

  _renderDpadBtnEditor(item, index, dir) {
    const btnCfg = item.buttons?.[dir] ?? {};
    const basisData = {
      icon: btnCfg.icon ?? '', text: btnCfg.text ?? '',
      icon_color: btnCfg.icon_color ?? '', text_color: btnCfg.text_color ?? '',
      background_color: btnCfg.background_color ?? '',
    };
    return html`
      ${this._renderCollapsible(`item-${index}-${dir}-basis`, t(this.hass, 'Basis'), true, html`
        <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_BUTTON_BASIS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onDpadBtnBasisChanged(e, index, dir)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-${dir}-actions`, t(this.hass, 'Actions'), false, html`
        ${this._renderDpadActionField(index, dir, 'tap_action')}
        ${this._renderDpadActionField(index, dir, 'double_tap_action')}
        ${this._renderDpadActionField(index, dir, 'hold_action')}
        <ha-form style="margin-top:8px;" .hass=${this.hass}
          .data=${{ hold_repeat: btnCfg.hold_repeat ?? false, hold_repeat_interval: btnCfg.hold_repeat_interval ?? '' }}
          .schema=${SCHEMA_HOLD_REPEAT}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onSubBtnRepeatChanged(e, index, dir)}
        ></ha-form>
      `)}
    `;
  }

  _renderColorButtonsEditor(item, index) {
    return html`
      ${COLOR_BUTTON_KEYS.map(key => {
        const isSubOpen = this._openSubButton === `${index}-${key}`;
        const btnCfg = item.buttons?.[key] || {};
        const defaults = COLOR_BUTTON_DEFAULTS[key];
        const color = btnCfg.color || defaults.color;
        return html`
          <div class="button-item" style="margin-left:8px;">
            <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
                 @click=${() => { this._openSubButton = isSubOpen ? null : `${index}-${key}`; }}>
              <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${color};flex-shrink:0;"></span>
              <span class="button-item-label">${t(this.hass, COLOR_BUTTON_LABELS[key])}</span>
              <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
            </div>
            ${isSubOpen ? html`
              <div class="button-editor-slot">
                ${this._renderColorBtnEditor(item, index, key)}
              </div>
            ` : ''}
          </div>
        `;
      })}
    `;
  }

  _renderColorBtnEditor(item, index, key) {
    const btnCfg = item.buttons?.[key] ?? {};
    const defaults = COLOR_BUTTON_DEFAULTS[key];
    const basisData = {
      color: btnCfg.color ?? defaults.color,
      icon: btnCfg.icon ?? '', text: btnCfg.text ?? '',
      icon_color: btnCfg.icon_color ?? '', text_color: btnCfg.text_color ?? '',
    };
    return html`
      ${this._renderCollapsible(`item-${index}-${key}-basis`, t(this.hass, 'Basis'), true, html`
        <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_COLOR_BTN_BASIS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onColorBtnBasisChanged(e, index, key)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-${key}-actions`, t(this.hass, 'Actions'), false, html`
        ${this._renderColorBtnActionField(index, key, 'tap_action')}
        ${this._renderColorBtnActionField(index, key, 'double_tap_action')}
        ${this._renderColorBtnActionField(index, key, 'hold_action')}
        <ha-form style="margin-top:8px;" .hass=${this.hass}
          .data=${{ hold_repeat: btnCfg.hold_repeat ?? false, hold_repeat_interval: btnCfg.hold_repeat_interval ?? '' }}
          .schema=${SCHEMA_HOLD_REPEAT}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onSubBtnRepeatChanged(e, index, key)}
        ></ha-form>
      `)}
    `;
  }

  _renderNumbersEditor(item, index) {
    const basisData = {
      icon: item.icon ?? '', text: item.text ?? '',
      icon_color: item.icon_color ?? '', text_color: item.text_color ?? '',
      background_color: item.background_color ?? '',
    };
    const variantEditor = html`
      <ha-form .hass=${this.hass} .data=${{ variant: item.variant || 'pill' }}
        .schema=${SCHEMA_VARIANT.map(s => s.name === 'variant' ? { ...s, selector: { select: { ...s.selector.select, options: s.selector.select.options.map(o => ({ ...o, label: t(this.hass, o.label) })) } } } : s)}
        .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
        @value-changed=${(e) => this._onItemVariantChanged(e, index)}
      ></ha-form>
    `;
    return html`
      ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
        ${variantEditor}
        <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_BUTTON_BASIS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemBasisChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-actions`, t(this.hass, 'Actions'), false, html`
        ${this._renderItemActionField(index, 'tap_action')}
        ${this._renderItemActionField(index, 'hold_action')}
        <ha-form style="margin-top:8px;" .hass=${this.hass}
          .data=${{ hold_repeat: item.hold_repeat ?? false, hold_repeat_interval: item.hold_repeat_interval ?? '' }}
          .schema=${SCHEMA_HOLD_REPEAT}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemRepeatChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-numpad-options`, t(this.hass, 'Options'), false, html`
        <ha-form .hass=${this.hass}
          .data=${{ hide_dash: item.hide_dash ?? false, hide_enter: item.hide_enter ?? false }}
          .schema=${SCHEMA_NUMPAD_OPTIONS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onNumpadOptionsChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-numpad-actions`, t(this.hass, 'Button actions'), false, html`
        ${NUMPAD_KEYS.map(key => {
          const hidden = (key === 'dash' && (item.hide_dash ?? false)) || (key === 'enter' && (item.hide_enter ?? false));
          if (hidden) return '';
          const isSubOpen = this._openSubButton === `${index}-${key}`;
          return html`
            <div class="button-item" style="margin-left:8px;">
              <div class="button-item-header ${isSubOpen ? 'editor-open' : ''}"
                   @click=${() => { this._openSubButton = isSubOpen ? null : `${index}-${key}`; }}>
                <span class="button-item-label">${NUMPAD_LABELS[key]}</span>
                <ha-icon class="button-item-chevron ${isSubOpen ? 'open' : ''}" icon="mdi:chevron-right"></ha-icon>
              </div>
              ${isSubOpen ? html`
                <div class="button-editor-slot">
                  ${this._renderNumpadKeyActionField(index, key)}
                </div>
              ` : ''}
            </div>
          `;
        })}
      `)}
    `;
  }

  _renderNumpadKeyActionField(index, key) {
    const item = this._items[index] || {};
    const actionData = item.buttons?.[key]?.tap_action ?? {};
    return html`
      <div class="action-field">
        <ha-form .hass=${this.hass}
          .data=${{ tap_action: actionData }}
          .schema=${_uiActionSchema('tap_action')}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onNumpadKeyActionChanged(e, index, key)}
        ></ha-form>
      </div>
    `;
  }

  _renderItemBasisEditor(item, index) {
    const basisData = {
      icon: item.icon ?? '', text: item.text ?? '',
      icon_color: item.icon_color ?? '', text_color: item.text_color ?? '',
      background_color: item.background_color ?? '',
    };
    const hasVariant = item.type === 'button' || item.type === 'source' || item.type === 'entity';
    const variantEditor = hasVariant ? html`
      <ha-form .hass=${this.hass} .data=${{ variant: item.variant || 'pill' }}
        .schema=${SCHEMA_VARIANT.map(s => s.name === 'variant' ? { ...s, selector: { select: { ...s.selector.select, options: s.selector.select.options.map(o => ({ ...o, label: t(this.hass, o.label) })) } } } : s)}
        .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
        @value-changed=${(e) => this._onItemVariantChanged(e, index)}
      ></ha-form>
    ` : '';

    if (item.type === 'source') {
      return html`
        ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
          ${variantEditor}
          <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_BUTTON_BASIS}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemBasisChanged(e, index)}
          ></ha-form>
        `)}
        ${this._renderCollapsible(`item-${index}-actions`, t(this.hass, 'Actions'), false, html`
          ${this._renderItemActionField(index, 'tap_action')}
          ${this._renderItemActionField(index, 'hold_action')}
          <ha-form style="margin-top:8px;" .hass=${this.hass}
            .data=${{ hold_repeat: item.hold_repeat ?? false, hold_repeat_interval: item.hold_repeat_interval ?? '' }}
            .schema=${SCHEMA_HOLD_REPEAT}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemRepeatChanged(e, index)}
          ></ha-form>
        `)}
        ${this._renderCollapsible(`item-${index}-source-popup`, t(this.hass, 'Source-Popup'), false, html`
          ${this._renderSourcePopupConfigForItem(item, index)}
        `)}
      `;
    }

    if (item.type === 'entity') {
      return html`
        ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
          ${variantEditor}
          <ha-form .hass=${this.hass} .data=${{ entity_id: item.entity_id ?? '' }}
            .schema=${SCHEMA_ENTITY}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemEntityChanged(e, index)}
          ></ha-form>
          <ha-form .hass=${this.hass} .data=${{ show_state_background: item.show_state_background ?? false }}
            .schema=${SCHEMA_ENTITY_TOGGLE}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemToggleChanged(e, index)}
          ></ha-form>
          <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_BUTTON_BASIS}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemBasisChanged(e, index)}
          ></ha-form>
        `)}
        ${this._renderCollapsible(`item-${index}-actions`, t(this.hass, 'Actions'), false, html`
          ${this._renderItemActionField(index, 'tap_action')}
          ${this._renderItemActionField(index, 'double_tap_action')}
          ${this._renderItemActionField(index, 'hold_action')}
          <ha-form style="margin-top:8px;" .hass=${this.hass}
            .data=${{ hold_repeat: item.hold_repeat ?? false, hold_repeat_interval: item.hold_repeat_interval ?? '' }}
            .schema=${SCHEMA_HOLD_REPEAT}
            .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
            @value-changed=${(e) => this._onItemRepeatChanged(e, index)}
          ></ha-form>
        `)}
      `;
    }

    return html`
      ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
        ${variantEditor}
        <ha-form .hass=${this.hass} .data=${basisData} .schema=${SCHEMA_BUTTON_BASIS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemBasisChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-actions`, t(this.hass, 'Actions'), false, html`
        ${this._renderItemActionField(index, 'tap_action')}
        ${this._renderItemActionField(index, 'double_tap_action')}
        ${this._renderItemActionField(index, 'hold_action')}
        <ha-form style="margin-top:8px;" .hass=${this.hass}
          .data=${{ hold_repeat: item.hold_repeat ?? false, hold_repeat_interval: item.hold_repeat_interval ?? '' }}
          .schema=${SCHEMA_HOLD_REPEAT}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemRepeatChanged(e, index)}
        ></ha-form>
      `)}
    `;
  }

  _renderSliderEditor(item, index) {
    const basisData = {
      icon: item.icon ?? '',
      icon_color: item.icon_color ?? '',
    };
    const sliderData = {
      variant: item.variant || 'pill',
      orientation: item.orientation || 'horizontal',
      attribute: item.attribute ?? '', min: item.min ?? '', max: item.max ?? '', step: item.step ?? '',
      show_icon: item.show_icon !== false, slider_live: item.slider_live ?? false,
    };
    return html`
      ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
        <ha-form .hass=${this.hass} .data=${{ entity_id: item.entity_id ?? '' }}
          .schema=${SCHEMA_ENTITY}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemEntityChanged(e, index)}
        ></ha-form>
        <ha-form .hass=${this.hass} .data=${basisData} .schema=${[
          { name: 'icon', selector: { icon: {} } },
          { name: 'icon_color', selector: { ui_color: {} } },
        ]}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onSliderBasisChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-slider-opts`, t(this.hass, 'Slider options'), false, html`
        <ha-form .hass=${this.hass} .data=${sliderData} .schema=${SCHEMA_SLIDER_OPTIONS.map(s => (s.name === 'orientation' || s.name === 'variant') ? { ...s, selector: { select: { ...s.selector.select, options: s.selector.select.options.map(o => ({ ...o, label: t(this.hass, o.label) })) } } } : s)}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onSliderOptionsChanged(e, index)}
        ></ha-form>
      `)}
    `;
  }

  _renderMediaEditor(item, index) {
    return html`
      ${this._renderCollapsible(`item-${index}-basis`, t(this.hass, 'Basis'), true, html`
        <ha-form .hass=${this.hass} .data=${{ entity_id: item.entity_id ?? '' }}
          .schema=${SCHEMA_MEDIA_ENTITY}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemEntityChanged(e, index)}
        ></ha-form>
        <ha-form .hass=${this.hass} .data=${{ show_info: item.show_info !== false, scroll_info: item.scroll_info ?? false, fallback_icon: item.fallback_icon ?? '' }}
          .schema=${SCHEMA_MEDIA_OPTIONS}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onMediaOptionsChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-actions`, t(this.hass, 'Actions'), false, html`
        ${this._renderItemActionField(index, 'tap_action')}
        ${this._renderItemActionField(index, 'hold_action')}
        <ha-form style="margin-top:8px;" .hass=${this.hass}
          .data=${{ hold_repeat: item.hold_repeat ?? false, hold_repeat_interval: item.hold_repeat_interval ?? '' }}
          .schema=${SCHEMA_HOLD_REPEAT}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemRepeatChanged(e, index)}
        ></ha-form>
      `)}
      ${this._renderCollapsible(`item-${index}-source-popup`, t(this.hass, 'Source-Popup'), false, html`
        ${this._renderSourcePopupConfigForItem(item, index)}
      `)}
    `;
  }

  _renderItemActionField(index, actionKey) {
    const item = this._items[index] || {};
    const actionData = item[actionKey] ?? {};
    return html`
      <div class="action-field">
        <ha-form .hass=${this.hass}
          .data=${{ [actionKey]: actionData }}
          .schema=${_uiActionSchema(actionKey)}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemActionChanged(e, index, actionKey)}
        ></ha-form>
      </div>
    `;
  }

  _renderDpadActionField(index, dir, actionKey) {
    const item = this._items[index] || {};
    const actionData = item.buttons?.[dir]?.[actionKey] ?? {};
    return html`
      <div class="action-field">
        <ha-form .hass=${this.hass}
          .data=${{ [actionKey]: actionData }}
          .schema=${_uiActionSchema(actionKey)}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onDpadBtnActionChanged(e, index, dir, actionKey)}
        ></ha-form>
      </div>
    `;
  }

  _renderColorBtnActionField(index, key, actionKey) {
    const item = this._items[index] || {};
    const actionData = item.buttons?.[key]?.[actionKey] ?? {};
    return html`
      <div class="action-field">
        <ha-form .hass=${this.hass}
          .data=${{ [actionKey]: actionData }}
          .schema=${_uiActionSchema(actionKey)}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onColorBtnActionChanged(e, index, key, actionKey)}
        ></ha-form>
      </div>
    `;
  }

  // -- Settings panel ---------------------------------------------------------

  _renderSettingsPanel() {
    const appearanceData = {
      card_background_color: this._config.card_background_color ?? '',
      icon_color: this._config.icon_color ?? '',
      text_color: this._config.text_color ?? '',
      button_background_color: this._config.button_background_color ?? '',
      scale: this._config.scale ?? 100,
    };
    const sizing = this._config.sizing || 'normal';
    const hapticData = {
      haptic_tap: this._config.haptic_tap ?? false,
      haptic_double_tap: this._config.haptic_double_tap ?? false,
      haptic_hold: this._config.haptic_hold ?? false,
      hold_repeat_interval: this._config.hold_repeat_interval ?? DEFAULT_REPEAT_INTERVAL_MS,
    };

    return html`
      ${this._renderCollapsible('settings-appearance', t(this.hass, 'Appearance'), true, html`
        <ha-form .hass=${this.hass} .data=${appearanceData} .schema=${SCHEMA_GLOBAL_APPEARANCE}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${this._onGlobalAppearanceChanged}
        ></ha-form>
        <div class="visual-selector-label">${t(this.hass, 'Size')}</div>
        <div class="visual-selector-row">
          ${this._renderVisualOption('sizing', 'normal', sizing, t(this.hass, 'Normal'), SVG_SIZING_NORMAL)}
          ${this._renderVisualOption('sizing', 'stretch', sizing, t(this.hass, 'Stretch'), SVG_SIZING_STRETCH)}
        </div>
      `)}
      ${this._renderCollapsible('settings-haptic', t(this.hass, 'Haptic & behavior'), false, html`
        <ha-form .hass=${this.hass} .data=${hapticData} .schema=${SCHEMA_GLOBAL_HAPTIC}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${this._onGlobalHapticChanged}
        ></ha-form>
      `)}
    `;
  }

  // -- Source popup config (per source item) -----------------------------------

  _getEditorSourcesForItem(itemIndex) {
    const item = this._items[itemIndex];
    if (!item) return [];
    const manualSources = item.sources ?? [];
    const entityId = item.source_entity || (item.type === 'media' ? item.entity_id : null);
    let autoOptions = [];
    if (entityId && this.hass) {
      const entity = this.hass.states[entityId];
      if (entity) {
        const domain = entityId.split('.')[0];
        if (domain === 'select') autoOptions = entity.attributes.options ?? [];
        else if (domain === 'media_player') autoOptions = entity.attributes.source_list ?? [];
      }
    }

    const manualByName = {};
    const usedManualIndices = new Set();
    for (let i = 0; i < manualSources.length; i++) {
      const m = manualSources[i];
      if (m.name && autoOptions.includes(m.name)) {
        manualByName[m.name] = i;
        usedManualIndices.add(i);
      }
    }

    const result = [];
    for (const option of autoOptions) {
      const manualIdx = manualByName[option] ?? null;
      const manual = manualIdx != null ? manualSources[manualIdx] : null;
      const merged = { name: option };
      if (manual) {
        if (manual.label) merged.label = manual.label;
        if (manual.icon) merged.icon = manual.icon;
        if (manual.image) merged.image = manual.image;
        if (manual.hidden) merged.hidden = true;
        if (manual.tap_action) merged.tap_action = manual.tap_action;
      }
      result.push({ ...merged, _auto: true, _manualIdx: manualIdx });
    }
    for (let i = 0; i < manualSources.length; i++) {
      if (usedManualIndices.has(i)) continue;
      result.push({ ...manualSources[i], _auto: false, _manualIdx: i });
    }

    const order = item.source_order;
    if (Array.isArray(order) && order.length > 0) {
      const orderMap = new Map(order.map((name, i) => [name, i]));
      result.sort((a, b) => {
        const ai = orderMap.has(a.name) ? orderMap.get(a.name) : order.length;
        const bi = orderMap.has(b.name) ? orderMap.get(b.name) : order.length;
        return ai - bi;
      });
    }
    return result;
  }

  _renderSourcePopupConfigForItem(item, itemIndex) {
    const editorSources = this._getEditorSourcesForItem(itemIndex);
    const hasEntity = !!item.source_entity;
    const autoCount = editorSources.filter(s => s._auto).length;

    return html`
      <div>
        <ha-form .hass=${this.hass}
          .data=${{ source_entity: item.source_entity ?? '' }}
          .schema=${SCHEMA_SOURCE_ENTITY}
          .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
          @value-changed=${(e) => this._onItemSourceEntityChanged(e, itemIndex)}
        ></ha-form>
        ${hasEntity && autoCount > 0 ? html`
          <p class="source-entity-hint">
            ${autoCount} Quellen aus Entitaet geladen.
            Aenderungen an automatischen Quellen werden als Ueberschreibungen gespeichert.
          </p>
        ` : ''}
        <div class="source-list">
          ${this._getReorderedSourcesForRender(editorSources).map((s, i) =>
            this._renderSourceItemEditorForItem(s, i, itemIndex))}
        </div>
        <button class="add-btn" @click=${() => this._addSourceToItem(itemIndex)}>+ Add source</button>
      </div>
    `;
  }

  _renderSourceItemEditorForItem(source, editorIndex, itemIndex) {
    const isOpen = this._openSourceIdx === editorIndex;
    const isAuto = source._auto;
    const hasOverride = isAuto && source._manualIdx != null;
    const isHidden = !!source.hidden;
    const displayName = source.label || source.name || `Source ${editorIndex + 1}`;
    const isDragging = this._dragFromIdx != null && source._renderIdx === this._dragFromIdx;

    return html`
      <div class="source-item-editor ${isDragging ? 'dragging' : ''} ${isHidden ? 'hidden-source' : ''}" data-sidx="${editorIndex}">
        <div class="source-item-header ${isOpen ? 'editor-open' : ''}">
          <div class="drag-handle" @pointerdown=${(e) => this._onSourceDragStart(e, editorIndex, itemIndex)}>
            <ha-icon icon="mdi:drag" style="--mdc-icon-size:18px;"></ha-icon>
          </div>
          <span class="source-item-label" @click=${() => { this._openSourceIdx = isOpen ? null : editorIndex; }} style="cursor:pointer;">
            ${displayName}
          </span>
          ${isAuto ? html`<span class="source-item-auto-badge">${hasOverride ? 'auto*' : 'auto'}</span>` : ''}
          ${isAuto ? html`
            <button class="icon-btn" title="${isHidden ? 'Show' : 'Hide'}"
                    @click=${() => this._toggleSourceHiddenForItem(source, itemIndex)}>
              <ha-icon icon="${isHidden ? 'mdi:eye-off' : 'mdi:eye'}" style="--mdc-icon-size:18px;"></ha-icon>
            </button>
          ` : ''}
          <button class="icon-btn" title="Edit"
                  @click=${() => { this._openSourceIdx = isOpen ? null : editorIndex; }}>
            <ha-icon icon="mdi:pencil" style="--mdc-icon-size:18px;"></ha-icon>
          </button>
          ${isAuto
            ? (hasOverride ? html`
                <button class="icon-btn delete-btn" title="Remove override"
                        @click=${() => this._deleteSourceFromItem(source._manualIdx, itemIndex)}>
                  <ha-icon icon="mdi:undo" style="--mdc-icon-size:18px;"></ha-icon>
                </button>
              ` : '')
            : html`
                <button class="icon-btn delete-btn" title="Remove"
                        @click=${() => this._deleteSourceFromItem(source._manualIdx, itemIndex)}>
                  <ha-icon icon="mdi:delete" style="--mdc-icon-size:18px;"></ha-icon>
                </button>
              `}
        </div>
        ${isOpen ? html`
          <div class="source-item-editor-slot">
            <ha-form .hass=${this.hass}
              .data=${isAuto
                ? { label: source.label ?? '', icon: source.icon ?? '', image: source.image ?? '' }
                : { name: source.name ?? '', icon: source.icon ?? '', image: source.image ?? '' }}
              .schema=${isAuto ? SCHEMA_AUTO_SOURCE_ITEM : SCHEMA_SOURCE_ITEM}
              .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
              @value-changed=${(e) => this._onEditorSourceChangedForItem(e, source, itemIndex)}
            ></ha-form>
            ${!isAuto ? html`
              <div class="action-field">
                <ha-form .hass=${this.hass}
                  .data=${{ tap_action: source.tap_action ?? {} }}
                  .schema=${_uiActionSchema('tap_action')}
                  .computeLabel=${(s) => _label(this.hass, s)} .computeHelper=${(s) => _helper(this.hass, s)}
                  @value-changed=${(e) => this._onEditorSourceActionChangedForItem(e, source, itemIndex)}
                ></ha-form>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  // -- Collapsible helper -----------------------------------------------------

  _renderCollapsible(key, title, defaultOpen, content) {
    const ICONS = {
      span: 'mdi:resize', basis: 'mdi:tune', actions: 'mdi:gesture-tap',
      options: 'mdi:cog-outline', 'numpad-actions': 'mdi:gesture-tap-button',
      'source-popup': 'mdi:menu', 'slider-opts': 'mdi:tune-vertical',
      appearance: 'mdi:palette-outline', haptic: 'mdi:vibrate',
    };
    const parts = key.split('-');
    const icon = ICONS[parts.slice(-2).join('-')] || ICONS[parts[parts.length - 1]] || '';
    return html`
      <ha-expansion-panel .header=${title} leftChevron outlined ?expanded=${defaultOpen}>
        ${icon ? html`<ha-icon slot="leading-icon" icon="${icon}"></ha-icon>` : ''}
        ${content}
      </ha-expansion-panel>
    `;
  }

  // -- Event handlers (item config) -------------------------------------------

  _onItemVariantChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value.variant;
    const items = [...this._items];
    items[index] = { ...items[index], variant: val || 'pill' };
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemEntityChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value.entity_id;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val) item.entity_id = val;
    else delete item.entity_id;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemBasisChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    for (const key of ['icon', 'text', 'icon_color', 'text_color', 'background_color']) {
      if (val[key]) item[key] = val[key];
      else delete item[key];
    }
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemActionChanged(e, index, actionKey) {
    e.stopPropagation();
    const val = e.detail.value[actionKey];
    const items = [...this._items];
    const item = { ...items[index] };
    if (val && val.action && val.action !== 'none') item[actionKey] = val;
    else delete item[actionKey];
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemRepeatChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val.hold_repeat) item.hold_repeat = true;
    else delete item.hold_repeat;
    if (val.hold_repeat_interval != null && val.hold_repeat_interval !== '') {
      item.hold_repeat_interval = val.hold_repeat_interval;
    } else {
      delete item.hold_repeat_interval;
    }
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onSubBtnRepeatChanged(e, index, key) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const btnCfg = { ...(buttons[key] || {}) };
    if (val.hold_repeat) btnCfg.hold_repeat = true;
    else delete btnCfg.hold_repeat;
    if (val.hold_repeat_interval != null && val.hold_repeat_interval !== '') {
      btnCfg.hold_repeat_interval = val.hold_repeat_interval;
    } else {
      delete btnCfg.hold_repeat_interval;
    }
    if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
    else delete buttons[key];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemToggleChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val.show_state_background) item.show_state_background = true;
    else delete item.show_state_background;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onSliderBasisChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    for (const key of ['icon', 'icon_color']) {
      if (val[key]) item[key] = val[key];
      else delete item[key];
    }
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onSliderOptionsChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val.variant && val.variant !== 'pill') item.variant = val.variant;
    else delete item.variant;
    if (val.orientation === 'vertical') item.orientation = 'vertical';
    else delete item.orientation;
    for (const key of ['attribute', 'min', 'max', 'step']) {
      if (val[key] != null && val[key] !== '') item[key] = val[key];
      else delete item[key];
    }
    if (val.show_icon === false) item.show_icon = false;
    else delete item.show_icon;
    if (val.slider_live) item.slider_live = true;
    else delete item.slider_live;
    // Reset span when orientation changes (vertical=height only, horizontal=width only)
    if (val.orientation === 'vertical') { delete item.col_span; }
    else { delete item.row_span; }
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onMediaOptionsChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val.show_info === false) item.show_info = false;
    else delete item.show_info;
    if (val.scroll_info) item.scroll_info = true;
    else delete item.scroll_info;
    if (val.fallback_icon) item.fallback_icon = val.fallback_icon;
    else delete item.fallback_icon;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onDpadBtnBasisChanged(e, index, dir) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const btnCfg = { ...(buttons[dir] || {}), ...val };
    for (const key of ['icon', 'text', 'icon_color', 'text_color', 'background_color']) {
      if (!btnCfg[key]) delete btnCfg[key];
    }
    if (Object.keys(btnCfg).length > 0) buttons[dir] = btnCfg;
    else delete buttons[dir];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onDpadBtnActionChanged(e, index, dir, actionKey) {
    e.stopPropagation();
    const val = e.detail.value[actionKey];
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const btnCfg = { ...(buttons[dir] || {}) };
    if (val && val.action && val.action !== 'none') btnCfg[actionKey] = val;
    else delete btnCfg[actionKey];
    if (Object.keys(btnCfg).length > 0) buttons[dir] = btnCfg;
    else delete buttons[dir];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onNumpadOptionsChanged(e, index) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    if (val.hide_dash) item.hide_dash = true; else delete item.hide_dash;
    if (val.hide_enter) item.hide_enter = true; else delete item.hide_enter;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onNumpadKeyActionChanged(e, index, key) {
    e.stopPropagation();
    const val = e.detail.value.tap_action;
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const btnCfg = { ...(buttons[key] || {}) };
    if (val && val.action && val.action !== 'none') btnCfg.tap_action = val;
    else delete btnCfg.tap_action;
    if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
    else delete buttons[key];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onColorBtnBasisChanged(e, index, key) {
    e.stopPropagation();
    const val = e.detail.value;
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const defaults = COLOR_BUTTON_DEFAULTS[key];
    const btnCfg = { ...(buttons[key] || {}), ...val };
    for (const k of ['icon', 'text', 'icon_color', 'text_color']) {
      if (!btnCfg[k]) delete btnCfg[k];
    }
    if (btnCfg.color === defaults.color) delete btnCfg.color;
    if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
    else delete buttons[key];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onColorBtnActionChanged(e, index, key, actionKey) {
    e.stopPropagation();
    const val = e.detail.value[actionKey];
    const items = [...this._items];
    const item = { ...items[index] };
    const buttons = { ...(item.buttons || {}) };
    const btnCfg = { ...(buttons[key] || {}) };
    if (val && val.action && val.action !== 'none') btnCfg[actionKey] = val;
    else delete btnCfg[actionKey];
    if (Object.keys(btnCfg).length > 0) buttons[key] = btnCfg;
    else delete buttons[key];
    if (Object.keys(buttons).length > 0) item.buttons = buttons;
    else delete item.buttons;
    items[index] = item;
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  // -- Event handlers (global settings) ---------------------------------------

  _getMinGridSize() {
    const items = this._items;
    let minCols = 1;
    let minRows = 1;
    for (const item of items) {
      if (!ITEM_SIZES[item.type]) continue;
      const size = _getItemSize(item);
      minCols = Math.max(minCols, item.col + size.cols);
      minRows = Math.max(minRows, item.row + size.rows);
    }
    return { minCols, minRows };
  }

  _renderSliderInput(name, value, sliderMin, sliderMax, label, helper) {
    const { minCols, minRows } = this._getMinGridSize();
    const effectiveMin = name === 'columns' ? minCols : minRows;
    const clampedSliderMin = Math.max(sliderMin, effectiveMin);
    return html`
      <div class="slider-input-row">
        <div class="slider-input-label">${label}</div>
        <div class="slider-input-controls">
          <ha-slider
            .min=${clampedSliderMin} .max=${sliderMax} .step=${1}
            .value=${Math.max(Math.min(value, sliderMax), clampedSliderMin)}
            pin
            @change=${(e) => this._onGridSliderChanged(name, Number(e.target.value))}
          ></ha-slider>
          <ha-textfield
            .value=${String(value)}
            type="number" .min=${String(effectiveMin)} step="1"
            style="width:5em;"
            @change=${(e) => this._onGridSliderChanged(name, parseInt(e.target.value) || effectiveMin)}
          ></ha-textfield>
        </div>
        <div class="slider-input-helper">${helper}</div>
      </div>
    `;
  }

  _onGridSliderChanged(name, value) {
    const { minCols, minRows } = this._getMinGridSize();
    const effectiveMin = name === 'columns' ? minCols : minRows;
    value = Math.max(value, effectiveMin);
    const updated = { ...this._config, [name]: value };
    this._config = updated;
    this._fireConfigChanged();
  }

  _onGlobalAppearanceChanged(e) {
    e.stopPropagation();
    const val = e.detail.value;
    const updated = { ...this._config };
    for (const key of ['card_background_color', 'icon_color', 'text_color', 'button_background_color']) {
      if (val[key]) updated[key] = val[key];
      else delete updated[key];
    }
    if (val.scale != null && val.scale !== 100) updated.scale = val.scale;
    else delete updated.scale;
    this._config = updated;
    this._fireConfigChanged();
  }

  _renderVisualOption(name, value, current, label, svgTemplate) {
    const selected = value === current;
    return html`
      <label class="visual-option ${selected ? 'selected' : ''}"
             @click=${() => this._setVisualOption(name, value)}>
        <input type="radio" name="${name}" value="${value}" .checked=${selected}>
        <div class="visual-preview">${svgTemplate}</div>
        <span class="visual-option-label">${label}</span>
      </label>
    `;
  }

  _setVisualOption(name, value) {
    const updated = { ...this._config };
    if (name === 'sizing') {
      delete updated.width;
      delete updated.height;
      if (value === 'stretch') updated.sizing = 'stretch';
      else delete updated.sizing;
    }
    this._config = updated;
    this._fireConfigChanged();
  }

  _onGlobalHapticChanged(e) {
    e.stopPropagation();
    const val = e.detail.value;
    const updated = { ...this._config, ...val };
    if (val.hold_repeat_interval == null || val.hold_repeat_interval === DEFAULT_REPEAT_INTERVAL_MS) {
      delete updated.hold_repeat_interval;
    }
    this._config = updated;
    this._fireConfigChanged();
  }

  // -- Event handlers (per-item source config) --------------------------------

  _updateItemField(itemIndex, updater) {
    const items = [...this._items];
    items[itemIndex] = updater({ ...items[itemIndex] });
    this._config = { ...this._config, items };
    this._fireConfigChanged();
  }

  _onItemSourceEntityChanged(e, itemIndex) {
    e.stopPropagation();
    const val = e.detail.value.source_entity;
    this._updateItemField(itemIndex, (item) => {
      if (val) item.source_entity = val;
      else delete item.source_entity;
      return item;
    });
  }

  _onEditorSourceChangedForItem(e, editorSource, itemIndex) {
    e.stopPropagation();
    const val = e.detail.value;
    this._updateItemField(itemIndex, (item) => {
      const sources = [...(item.sources ?? [])];
      if (editorSource._auto) {
        const overrideData = { name: editorSource.name };
        if (val.label) overrideData.label = val.label;
        if (val.icon) overrideData.icon = val.icon;
        if (val.image) overrideData.image = val.image;
        if (editorSource._manualIdx != null) {
          sources[editorSource._manualIdx] = { ...sources[editorSource._manualIdx], ...overrideData };
          for (const key of ['label', 'icon', 'image']) {
            if (!sources[editorSource._manualIdx][key]) delete sources[editorSource._manualIdx][key];
          }
        } else {
          if (val.label || val.icon || val.image) sources.push(overrideData);
        }
      } else {
        const idx = editorSource._manualIdx;
        if (idx != null) {
          sources[idx] = { ...sources[idx], ...val };
          for (const key of ['icon', 'image']) {
            if (!sources[idx][key]) delete sources[idx][key];
          }
        }
      }
      if (sources.length > 0) item.sources = sources;
      else delete item.sources;
      return item;
    });
  }

  _onEditorSourceActionChangedForItem(e, editorSource, itemIndex) {
    e.stopPropagation();
    const val = e.detail.value.tap_action;
    const idx = editorSource._manualIdx;
    if (idx != null) {
      this._updateItemField(itemIndex, (item) => {
        const sources = [...(item.sources ?? [])];
        sources[idx] = { ...sources[idx], tap_action: val };
        item.sources = sources;
        return item;
      });
    }
  }

  _toggleSourceHiddenForItem(editorSource, itemIndex) {
    this._updateItemField(itemIndex, (item) => {
      const sources = [...(item.sources ?? [])];
      const newHidden = !editorSource.hidden;
      if (editorSource._manualIdx != null) {
        sources[editorSource._manualIdx] = { ...sources[editorSource._manualIdx], name: editorSource.name };
        if (newHidden) sources[editorSource._manualIdx].hidden = true;
        else delete sources[editorSource._manualIdx].hidden;
      } else {
        sources.push({ name: editorSource.name, hidden: true });
      }
      item.sources = sources;
      return item;
    });
  }

  _addSourceToItem(itemIndex) {
    this._updateItemField(itemIndex, (item) => {
      const sources = [...(item.sources ?? [])];
      sources.push({ name: '', icon: 'mdi:video-input-hdmi' });
      item.sources = sources;
      this._openSourceIdx = sources.length - 1;
      return item;
    });
  }

  _deleteSourceFromItem(sourceIndex, itemIndex) {
    if (this._openSourceIdx === sourceIndex) this._openSourceIdx = null;
    else if (this._openSourceIdx != null && this._openSourceIdx > sourceIndex) this._openSourceIdx--;
    this._updateItemField(itemIndex, (item) => {
      const sources = (item.sources ?? []).filter((_, i) => i !== sourceIndex);
      if (sources.length > 0) item.sources = sources;
      else delete item.sources;
      return item;
    });
  }

  // -- Source drag-and-drop ---------------------------------------------------

  _getReorderedSourcesForRender(sources) {
    const tagged = sources.map((s, i) => ({ ...s, _renderIdx: i }));
    if (this._dragFromIdx == null || this._dragToIdx == null || this._dragFromIdx === this._dragToIdx) {
      return tagged;
    }
    const result = [...tagged];
    const [item] = result.splice(this._dragFromIdx, 1);
    result.splice(this._dragToIdx, 0, item);
    return result;
  }

  _onSourceDragStart(e, editorIndex, itemIndex) {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    this._dragFromIdx = editorIndex;
    this._dragToIdx = editorIndex;
    this._sourceDragPointerId = e.pointerId;
    this._sourceDragItemIdx = itemIndex;

    handle.addEventListener('pointermove', this._onSourceDragMoveBound ??= (ev) => this._onSourceDragMove(ev), { passive: true });
    handle.addEventListener('pointerup', this._onSourceDragEndBound ??= (ev) => this._onSourceDragEnd(ev));
    handle.addEventListener('pointercancel', this._onSourceDragCancelBound ??= (ev) => this._onSourceDragCancelEvt(ev));
  }

  _onSourceDragMove(e) {
    if (this._dragFromIdx == null) return;
    const list = this.shadowRoot?.querySelector('.source-list');
    if (!list) return;
    const items = [...list.querySelectorAll('.source-item-editor')];
    const y = e.clientY;
    const current = this._dragToIdx;
    let newIdx = current;
    for (let i = current - 1; i >= 0; i--) {
      if (y < items[i].getBoundingClientRect().bottom) newIdx = i;
      else break;
    }
    if (newIdx === current) {
      for (let i = current + 1; i < items.length; i++) {
        if (y > items[i].getBoundingClientRect().top) newIdx = i;
        else break;
      }
    }
    if (newIdx !== this._dragToIdx) this._dragToIdx = newIdx;
  }

  _onSourceDragEnd(e) {
    if (this._dragFromIdx == null) return;
    const from = this._dragFromIdx;
    const to = this._dragToIdx;
    const itemIdx = this._sourceDragItemIdx;
    this._sourceDragCleanup(e);
    if (from !== to) this._commitSourceMove(from, to, itemIdx);
  }

  _onSourceDragCancelEvt(e) {
    this._sourceDragCleanup(e);
  }

  _sourceDragCleanup(e) {
    const handle = e?.currentTarget;
    if (handle) {
      handle.releasePointerCapture?.(this._sourceDragPointerId);
      if (this._onSourceDragMoveBound) handle.removeEventListener('pointermove', this._onSourceDragMoveBound);
      if (this._onSourceDragEndBound) handle.removeEventListener('pointerup', this._onSourceDragEndBound);
      if (this._onSourceDragCancelBound) handle.removeEventListener('pointercancel', this._onSourceDragCancelBound);
    }
    this._dragFromIdx = null;
    this._dragToIdx = null;
    this._sourceDragPointerId = null;
    this._sourceDragItemIdx = null;
  }

  _commitSourceMove(fromIdx, toIdx, itemIndex) {
    if (itemIndex == null) return;
    const editorSources = this._getEditorSourcesForItem(itemIndex);
    const order = editorSources.map(s => s.name);
    const [name] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, name);
    if (this._openSourceIdx === fromIdx) this._openSourceIdx = toIdx;
    else if (this._openSourceIdx != null) {
      if (fromIdx < this._openSourceIdx && toIdx >= this._openSourceIdx) this._openSourceIdx--;
      else if (fromIdx > this._openSourceIdx && toIdx <= this._openSourceIdx) this._openSourceIdx++;
    }
    this._updateItemField(itemIndex, (item) => {
      item.source_order = order;
      return item;
    });
  }
}

// -- Registration -------------------------------------------------------------

customElements.define('grid-remote-card-editor', GridRemoteCardEditor);
customElements.define('grid-remote-card', GridRemoteCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'grid-remote-card',
  name: 'Grid Remote Card',
  description: 'Customizable TV remote with configurable grid layout, drag-and-drop, various button layouts, and source popup.',
  preview: true,
});

console.info(`%c CUSTOMIZABLE-REMOTE-CARD %c ${VERSION} `, 'color:#fff;background:#555;font-weight:bold;', 'color:#fff;background:#007acc;font-weight:bold;');
