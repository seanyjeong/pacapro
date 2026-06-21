# Design

## Direction

P-ACA should move from a generic card-based admin UI to a premium operating console. The first redesign pass explores three viable shell directions before choosing one system.

## Selected System

The selected base is **Other A / Operations Desk**. Keep the compact rail, command topbar, left work queue, KPI strip, and table-first hierarchy as the master shell. Page work should change details only after checking the API contract and the real operator task flow.

## Design Tokens

- Font: Pretendard Variable, system-ui fallback.
- Radius: 6px for controls and panels, 8px maximum for repeated items.
- Color model: OKLCH tokens for new prototypes.
- Motion: 150-220ms state feedback only, no page choreography.

## Candidate Directions

### Direction A: Operations Desk

Calm light console with a compact rail, command bar, dense work queue, and table-first hierarchy. Best for PC-heavy desk work.

### Direction B: Branch Control

Warm-neutral workspace with a stronger branch/day header and split panels for today's schedule, 상담, and money tasks. Best for managers who scan the day.

### Direction C: Field Console

Sharper, higher-contrast shell with large touch-safe controls, action rail, and schedule-first layout. Best for tablet/desk hybrid operations.

## Component Rules

- Primary actions are solid and rare.
- Secondary actions are quiet outline/text controls.
- Tables get sticky headers, clear row actions, and compact status badges.
- Empty states explain the next action in Korean.
- Cards are used only for repeated records or real panels, not nested decoration.
- Error states use plain Korean and never expose server codes, network policy names, call traces, or storage terms.
