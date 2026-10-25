# Design

The HUD has its own look: glass slabs with dichroic edges, gradients and glows, and an accent
color per dock button. The concepts it grew from are in `glass-concepts/`, the layout studies in
`ux-proposals/`. The general `huepattl-rams-design` rules do not apply to this project; new UI
matches the existing HUD (`packages/app/src/hud/hud.css`) instead.

What still holds: every control has a visible focus ring and an accessible name, and motion
honors the system's reduced-motion setting.
