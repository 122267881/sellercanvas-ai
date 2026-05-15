# SellerCanvas AI UI Redesign Design

## Approved Direction

The approved visual direction is **A: 高级 AI 商业工作台**.

The customer website should feel like an AI product studio for cross-border sellers: premium, focused, trustworthy, and conversion-oriented. The developer admin should feel like a command center: dense, calm, professional, and clearly separated from the customer experience.

## Design Goals

- Make both sites feel commercially credible instead of like a simple demo.
- Keep customer and admin surfaces visually related but operationally distinct.
- Improve hierarchy, spacing, typography, background treatment, cards, tables, forms, buttons, pricing, generated assets, and responsive layouts.
- Keep all existing business flows intact: auth, projects, image upload, analysis, generation, copy, export, billing, provider config, API keys, usage, and admin management.
- Do not expose developer API/provider configuration in the customer site.

## Visual System

- Use a premium dark navigation rail with warm orange and electric blue accents.
- Use a light, quiet work canvas for customer operations.
- Use a darker admin command style for the management backend.
- Use strong typography hierarchy, tighter operational panels, richer metric cards, and more polished table/list rows.
- Avoid cheap one-color gradients, oversized decorative blobs, or marketing-only hero layouts.
- Keep repeated UI cards at restrained radius and focus on spacing, borders, contrast, and shadow quality.

## Implementation Scope

- `styles.css`: Add a premium design-system layer that overrides the current basic shell.
- `app.js`: Add lightweight semantic classes and richer workflow/hero surfaces only where CSS cannot express the design.
- `admin.js`: Add lightweight semantic classes for admin command-center treatment only where needed.
- `scripts/check-frontend-content.js`: Extend checks if the redesign introduces new required visual markers.
- `README.md`: Update if new checks or visual-system notes are useful.

## Acceptance Criteria

- Customer login page feels like a premium AI commerce studio.
- Customer dashboard has clear workbench hierarchy, polished metrics, project workflow, platform specs, prompt cards, asset cards, copy panel, pricing, and exports.
- Admin login and dashboard feel like a separate developer management product.
- Admin provider configuration and API Key pages clearly say they are developer-only.
- Existing checks still pass:
  - `npm.cmd run check`
  - `npm.cmd run check:commercial`
  - `npm.cmd run check:architecture`
  - `node scripts/check-frontend-content.js`
- No secrets or runtime data are committed.
