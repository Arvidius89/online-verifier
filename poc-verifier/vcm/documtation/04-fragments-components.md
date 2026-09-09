# Fragments UI Components

Fragment UI is consumed as the `@fragment_ui/ui` package
(components) with `@fragment_ui/tokens` (CSS variable design tokens).

Use the following components where applicable.

## Header

- Avatar
- Button

## Dashboard

- Card
- Badge (wrapped by `StatusBadge` for status colors)
- Progress
- MetricCard (design-doc "Stat")

## Lists

- Table
- List (semantic list markup)
- Empty State

## Actions

- Button
- Dropdown

## Feedback

- Alert
- Toast

## Layout

- Layout is composed with Tailwind grid/flex utilities
  (design-doc "Grid / Stack / Container")
- Separator (design-doc "Divider")

## Custom wrappers

If a required Fragment UI component does not exist, create a
lightweight wrapper under `src/components/ui`:

- `StatusBadge` — Badge + semantic status colors

Keep component usage simple.

Avoid custom components when a Fragment UI component exists.