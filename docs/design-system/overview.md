# SGE Design System

The SGE uses a restrained institutional SaaS language built from Tailwind CSS v4 and the existing shadcn/Radix primitives. Shared composition belongs in `src/components/ui`; domain-specific behavior remains with its module.

## Foundation

- Typography: `Aptos, "Segoe UI", sans-serif` from the operating system. No font files are bundled.
- Page rhythm: `gap-6` between major sections and `gap-4` inside sections.
- Content width: one responsive application container, capped at 1600px.
- Color: semantic tokens only for application UI. Printed institutional documents may use configured brand colors.
- Themes: every application primitive must support light and dark modes.
- Motion: `prefers-reduced-motion` disables nonessential transitions and animation.

## Tokens

Core tokens are defined in `src/app/globals.css`: background, foreground, card, primary, secondary, muted, border, destructive, success, warning, and info. Feature code must not recreate semantic status colors.

## Migration rule

Modernize one bounded module at a time. Preserve routes, permissions, tenant context, data contracts, and workflows while replacing duplicated presentation.
