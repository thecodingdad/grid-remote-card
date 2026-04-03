# Grid Remote Card

A fully customizable TV/media remote control card with drag-and-drop grid layout, multiple button types, source popup, and a visual editor.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/thecodingdad/grid-remote-card)](https://github.com/thecodingdad/grid-remote-card/releases)

## Screenshots

![Card Editor](screenshots/screenshot.png)
![Examples](screenshots/screenshot2.png)

## Features

- Multiple button types: D-Pad, Color Buttons, Slider, Media Info, Button, Source Button, Number Pad, Entity Button
- Configurable grid size and button size
- Buttons can be arranged with drag-and-drop in visual editor
- Multiple button designs: round, pill (4 directions), square, rounded
- Tap, double-tap, and hold action with support with repeat support (configurable intervals)
- Multi-page layout with automatic page switch (configurable conditions per page)
- Haptic feedback (configurable)
- Fully configurable colors (global and per button)
- Two default presets and multiple device/entity specific preset with predefined actions
- Full UI configuration (no exclusive YAML features)
- EN/DE multilanguage support

## Prerequisites

- Home Assistant 2026.3.0 or newer
- HACS (recommended for installation)

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=thecodingdad&repository=grid-remote-card&category=plugin)

Or add manually:
1. Open HACS in your Home Assistant instance
2. Click the three dots in the top right corner and select **Custom repositories**
3. Enter `https://github.com/thecodingdad/grid-remote-card` and select **Dashboard** as the category
4. Click **Add**, then search for "Grid Remote Card" and download it
5. Reload your browser / clear cache

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/thecodingdad/grid-remote-card/releases)
2. Copy the `dist/` contents to `config/www/community/grid-remote-card/`
3. Add the resource in **Settings** → **Dashboards** → **Resources**:
   - URL: `/local/community/grid-remote-card/grid-remote-card.js`
   - Type: JavaScript Module
4. Reload your browser

## Usage

```yaml
type: custom:grid-remote-card
columns: 3
items:
  - type: button
    icon: mdi:power
    tap_action:
      action: call-service
      service: remote.send_command
      data:
        command: power
  - type: dpad
    size: 3x3
  - type: slider
    entity: media_player.tv
```

## Configuration

### Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `items` | array | preset | Grid items configuration |
| `columns` | number | 3 | Number of grid columns (1-12) |
| `rows` | number | 9 | Number of grid rows (1-20) |
| `scale` | number | 100 | Card scale in percent (50-200) |
| `sizing` | string | `normal` | Sizing mode: `normal` (fit content) or `stretch` (fill container) |
| `page_count` | number | 1 | Number of pages for multi-page layouts |
| `page_conditions` | array | — | Conditions for automatic page switching |
| `card_background_color` | string | — | Card background color (CSS or HA variable) |
| `icon_color` | string | — | Global default icon color |
| `text_color` | string | — | Global default text color |
| `button_background_color` | string | — | Global default button background color |
| `haptic_tap` | boolean | false | Haptic feedback on tap |
| `haptic_double_tap` | boolean | false | Haptic feedback on double-tap |
| `haptic_hold` | boolean | false | Haptic feedback on hold |
| `hold_repeat_interval` | number | 200 | Hold repeat interval in ms (50-1000) |

### Item Types

| Type | Size | Description |
|------|------|-------------|
| `button` | 1x1 | Generic action button with icon or text |
| `dpad` | 3x3 | Directional pad with up/down/left/right/center actions |
| `color_buttons` | 3x1 | Colored button row (red, green, yellow, blue) |
| `slider` | 3x1 | Volume/brightness/position slider control |
| `media` | 3x2 | Media player info with album art |
| `source` | 1x1 | Source selection popup button |
| `numbers` | 1x1 | Numeric keypad popup (0-9) |
| `entity` | 1x1 | Entity state toggle button with optional state background |

### Common Item Options

All item types support:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | required | Item type (see above) |
| `row` | number | required | Grid row position (0-based) |
| `col` | number | required | Grid column position (0-based) |
| `page` | number | 0 | Page number for multi-page layouts |

### Button Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `variant` | string | `round` | Button shape: `round`, `pill_top`, `pill_bottom`, `pill_left`, `pill_right`, `square`, `rounded` |
| `icon` | string | `mdi:radiobox-blank` | MDI icon |
| `text` | string | — | Text label (replaces icon) |
| `icon_color` | string | — | Icon color (CSS) |
| `text_color` | string | — | Text color (CSS) |
| `background_color` | string | — | Background color (CSS) |
| `tap_action` | object | — | Action on tap |
| `hold_action` | object | — | Action on hold |
| `double_tap_action` | object | — | Action on double-tap |
| `hold_repeat` | boolean | false | Repeat tap_action while held |
| `hold_repeat_interval` | number | — | Override global repeat interval (ms) |

### D-Pad Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `col_span` | number | 3 | Width in columns (always square) |
| `buttons` | object | — | Per-direction config (keys: `up`, `down`, `left`, `right`, `ok`) |

Each direction in `buttons` supports: `icon`, `text`, `icon_color`, `text_color`, `background_color`, `tap_action`, `hold_action`, `double_tap_action`, `hold_repeat`, `hold_repeat_interval`.

### Slider Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity_id` | string | required | Entity to control |
| `orientation` | string | `horizontal` | `horizontal` or `vertical` |
| `col_span` | number | 3 | Width for horizontal slider |
| `row_span` | number | 3 | Height for vertical slider |
| `attribute` | string | auto | Attribute to control (auto-detected from domain) |
| `min` | number | auto | Minimum value |
| `max` | number | auto | Maximum value |
| `step` | number | auto | Step size |
| `icon` | string | auto | Slider icon (auto-detected from domain) |
| `icon_color` | string | — | Icon color |
| `show_icon` | boolean | true | Show icon next to slider |
| `slider_live` | boolean | false | Send value while dragging |

Auto-detection by domain: light (brightness 0-255), media_player (volume 0-1), cover (position 0-100), fan (percentage 0-100), input_number/number (from entity attributes).

### Entity Button Options

Supports all [Button Options](#button-options), plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity_id` | string | required | Entity to control |
| `show_state_background` | boolean | false | Tint background when entity is active |

## Multilanguage Support

This card supports English and German.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
