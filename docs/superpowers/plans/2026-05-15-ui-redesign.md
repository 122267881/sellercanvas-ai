# SellerCanvas AI UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade SellerCanvas AI from a plain demo-like interface into a premium commercial AI product studio and developer command center.

**Architecture:** Keep the current vanilla HTML/CSS/JS architecture and preserve all API contracts. Apply a premium design-system layer in `styles.css`, with only small semantic markup additions in `app.js` and `admin.js` where necessary. Validate with existing commercial flow checks plus frontend content checks.

**Tech Stack:** Node.js HTTP server, vanilla JavaScript SPA, CSS design system, existing validation scripts.

---

### Task 1: Protect Brainstorm Artifacts

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore visual companion files**

Add `.superpowers/` to `.gitignore` so mockup sessions are not committed.

- [ ] **Step 2: Verify ignored status**

Run: `git status --ignored --short .superpowers`

Expected: `.superpowers/` appears only as ignored output.

### Task 2: Add Premium Design System Layer

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add premium root tokens**

Append a final CSS layer that defines stronger background, text, surface, rail, accent, and shadow tokens. This layer must override the current simple white-card style without deleting working layout rules.

- [ ] **Step 2: Upgrade core shells**

Style `.auth-shell`, `.sidebar`, `.main-shell`, `.topbar`, `.panel`, `.metric-card`, `.row-card`, `.prompt-card`, `.pricing-card`, `.asset-card`, forms, buttons, tables, timelines, and responsive states.

- [ ] **Step 3: Separate admin visual language**

Style `.admin-sidebar-clean` and admin pages as a command center with darker navigation and dense management panels.

### Task 3: Add Semantic UI Hooks

**Files:**
- Modify: `app.js`
- Modify: `admin.js`

- [ ] **Step 1: Add customer shell hooks**

Add classes such as `customer-shell`, `studio-hero`, `studio-panel`, or equivalent only when CSS needs page-level targeting.

- [ ] **Step 2: Add admin shell hooks**

Add classes such as `admin-command`, `admin-command-card`, or equivalent only when CSS needs page-level targeting.

- [ ] **Step 3: Preserve business actions**

Do not rename existing `data-action`, `data-upload`, route hashes, API paths, or auth forms unless the matching handler is updated in the same change.

### Task 4: Extend Frontend Checks

**Files:**
- Modify: `scripts/check-frontend-content.js`

- [ ] **Step 1: Require premium markers**

Add checks for CSS markers that prove the premium layer exists, such as `Premium AI workbench visual system`, `.main-shell::before`, `.admin-sidebar-clean`, and `.pricing-card.featured`.

- [ ] **Step 2: Re-run content check**

Run: `node scripts/check-frontend-content.js`

Expected: `Frontend content OK`.

### Task 5: Verify, Commit, Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run validation**

Run:

```powershell
npm.cmd run check
npm.cmd run check:commercial
npm.cmd run check:architecture
node scripts/check-frontend-content.js
```

Expected: all commands pass.

- [ ] **Step 2: Run secret scan**

Run the repository secret scan for OpenAI, Stripe, GitHub, webhook, and SSH private-key patterns.

Expected: no matches.

- [ ] **Step 3: Commit and push**

Run:

```powershell
git add .
git commit -m "Upgrade premium UI design system"
git push origin main
```

Expected: remote `main` matches local `HEAD`.
