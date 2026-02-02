# FPL League Tracker - Complete Project Documentation

## Overview
A comprehensive Fantasy Premier League (FPL) mini-league tracker that provides live scoring, predictions, and historical analysis. Built as a single-file HTML application with no build process required.

## Deployment & Development

### How to Run
- **No build process** - simply open `index.html` in any browser
- Can be served via any static file server (Python's `http.server`, VS Code Live Server, nginx, etc.)
- File location: `c:\Users\Dominic.Mackie\Repo\fpl-tracker\index.html`

### Testing Changes
- Hard refresh required after code changes: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Test in incognito/private window to bypass cache
- Test both desktop and mobile viewports (use browser dev tools)

### No Dependencies to Install
- All libraries loaded via CDN:
  - Chart.js: `https://cdn.jsdelivr.net/npm/chart.js`
  - Chart.js Datalabels plugin: `https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2`

## Tech Stack
- **Frontend:** Pure HTML/CSS/JavaScript (no framework)
- **Charts:** Chart.js with datalabels plugin
- **Data:** FPL Official API (proxied through fpl-proxy worker)
- **Storage:** localStorage for caching team data, goal scorers, settings

## Architecture

### Single File Structure
The entire app is in `index.html` (~4500+ lines):
- Lines 1-1200: CSS styles (including media queries)
- Lines 1200-1400: HTML structure
- Lines 1400+: JavaScript application logic

### Key JavaScript Components
- **Data Fetching:** `fetchWithRetry()`, `throttledFetch()` for rate-limited API calls
- **Live Data:** `fetchLiveData()`, `calculateLivePoints()`, `predictAutoSubs()`
- **Charts:** `renderChart()`, `setChartType()`, `updateWeekRange()`
- **UI Updates:** `updateTableView()`, `updateSidebar()`, `renderTicker()`

### State Management
Global variables store application state:
- `currentLeagueId` - selected league
- `currentGameweek` - current GW number
- `leagueData` - array of league standings
- `liveDataCache` - live points/picks per team
- `playerData` - FPL player database (from bootstrap-static)
- `cachedGoalScorers` - goal scorer data per team

## FPL API Endpoints Used

All requests go through proxy: `https://fpl-proxy.dominicmackie91.workers.dev`

| Endpoint | Purpose |
|----------|---------|
| `/api/bootstrap-static/` | All players, teams, gameweek info |
| `/api/fixtures/` | Match fixtures and results |
| `/api/event/{gw}/live/` | Live player points for gameweek |
| `/api/entry/{id}/` | Team basic info |
| `/api/entry/{id}/history/` | Team's historical GW scores |
| `/api/entry/{id}/event/{gw}/picks/` | Team's picks for a gameweek |
| `/api/leagues-classic/{id}/standings/` | League standings |

## Features

### Live View (Table Mode)
- **League standings** with live points
- **Movement indicators** (up/down arrows)
- **Captain display** with VC fallback detection
- **Chip indicators** (BB, TC, FH, WC)
- **Auto-sub predictions** - calculates likely auto-subs and points gained
- **BPS (Bonus Points)** - shows confirmed/provisional bonus
- **DEFCON points** - defenders/goalkeepers clean sheet points at risk
- **Status column** - players playing/yet to play
- **Overall Rank (OR)** - world ranking

### Expanded Row Details (tap row on mobile)
Shows detailed breakdown:
- GW Points (gross)
- Captain (name + points × multiplier)
- Hit Taken (transfer cost)
- Net GW Points
- Auto-subs (Out → In format with points gained)
- Bonus Points (total + per player)
- DEFCON (total + per player)
- VC Active (if captain blanked)
- Players status (X playing, X to play)
- Chip active
- Total points
- Overall Rank
- GW Rank

### Charts View
Three chart types:
1. **Total** - cumulative points over season
2. **Weekly** - points per gameweek
3. **Position** - league position over time

Features:
- Toggle individual players on/off
- Week range selector
- Search/filter players
- Top 10 / All / Clear buttons

### Goal Ticker
Scrolling ticker showing live/recent goals:
- Color coded: cyan (home team), yellow (away team)
- Shows scorer, minute, and assister
- Data from API-Football Worker + hardcoded fallback

### Settings & Persistence
- Default league saved to localStorage
- Team ID remembered
- Goal scorer cache
- Auto-subs toggle state

## CSS Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| `max-width: 1200px` | Tablet landscape - columns hidden |
| `max-width: 768px` | Tablet portrait - compact layout |
| `max-width: 600px` | Mobile portrait - stacked, truncated |
| `max-height: 500px` + landscape | Mobile landscape - show manager names |

## Key CSS Classes

### Layout
- `.container` - max-width wrapper
- `.controls` - fixed header with league/mode selection
- `.controls-spacer` - pushes content below fixed header
- `.table-view` - live table container
- `.main-content` - charts view container

### Table
- `.league-table` - main standings table
- `.col-*` - column classes (rank, name, gw, total, gap, captain, chip, autosub, bps, defcon, status, or)
- `.team-name` - team name display
- `.manager-name` - manager name (small, below team)
- `.row-details` - expandable detail row

### Status Indicators
- `.move-up` / `.move-down` - position change arrows
- `.chip-badge` - chip indicator (BB, TC, etc.)
- `.status-playing` - red, players currently playing
- `.status-toplay` - grey, players yet to play
- `.status-done` - finished

## Hardcoded Data

### HARDCODED_GOALS
Located around line 1400+. Contains goal scorer data when API unavailable:
```javascript
const HARDCODED_GOALS = {
    24: {  // Gameweek 24
        'brighton': [{ player: { name: 'Groß' }, time: { elapsed: 73 }, assist: { name: 'Ayari' } }],
        // ... more teams
    }
};
```

### Team Name Normalization
`normalizeTeamName()` function handles variations:
- "Man City" → "manchester city"
- "Spurs" → "tottenham"
- etc.

## Known Issues & Workarounds

1. **Sticky positioning doesn't work** - Using `position: fixed` instead with spacer element
2. **API rate limiting** - Throttled fetches with delays between requests
3. **Goal data inconsistency** - Hardcoded fallback for when API-Football doesn't match FPL fixtures
4. **Cache issues** - Users need hard refresh to see changes

## File Structure
```
fpl-tracker/
├── index.html          # Main application (single file)
├── CLAUDE.md           # This documentation
├── elite-managers.json # Elite manager tracking data
├── league_data.json    # Cached league data
└── league_data2.json   # Additional league cache
```

## Future Enhancements (Discussed)
- Gap to #1 overall (show "-127 to 1st" in expanded details)
- Fetch top overall player's total from FPL API
- Better team color coding for goal ticker

## Common Tasks

### Adding a new column to the table
1. Add `<th>` in the table header (~line 1316)
2. Add `.col-*` CSS class with width
3. Add `<td>` in `updateTableView()` return template
4. Add to mobile media query column hiding if needed

### Adding to expanded details
1. Find `mobileDetailsHtml` building section (~line 2310)
2. Add new `detail-item` div with label and value
3. Ensure data is available in `live` object

### Modifying the ticker
1. Goal data: `cachedGoalScorers` object
2. Rendering: `renderTicker()` function
3. Styling: `.fixture-ticker`, `.goal-item` classes
