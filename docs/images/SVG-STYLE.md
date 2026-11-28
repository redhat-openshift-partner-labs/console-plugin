# SVG style guide

This guide defines how the hand-written diagrams in `docs/images/` are built, for anyone adding or editing one.

- Canonical template: [`contribution-workflow.svg`](contribution-workflow.svg). Copy its `<style>` and `<defs>` blocks and its structure when starting a new diagram. Every diagram carries the same `<style>` and `<defs>` blocks, byte for byte. The blocks are reproduced in the next section.
- Content source: the Mermaid block that follows the SVG in the Markdown file that embeds it (`README.md`, `CONTRIBUTING.md`). The SVG must match that block.
- Origin: the `<style>` and `<defs>` blocks come from `sno.svg` in the `aci-assessment` checkout, SHA-256 `f1f88aa189229f90b0d703cab50ee253a4ea1ad7ac72452363d6de0376ec082b`.

## Shared `<style>` and `<defs>` blocks

```xml
  <style>
    .bg { fill: #ffffff; stroke: #d0d7de; }
    .frame { fill: #f6f8fa; stroke: #d0d7de; }
    .t { fill: #1f2328; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    .m { fill: #59636e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    .c { fill: #1f2328; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .h1 { font-size: 24px; font-weight: 700; }
    .h2 { font-size: 14px; font-weight: 650; }
    .lbl { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; }
    .b { font-size: 12px; }
    .s { font-size: 11px; }
    .k { font-weight: 650; }

    .src  { fill: #e6f6f4; stroke: #1f8f84; }
    .gate { fill: #fff4e0; stroke: #c27c0e; }
    .core { fill: #ecf2ff; stroke: #3b6fd8; }
    .out  { fill: #f3ecff; stroke: #7a4fd6; }
    .store{ fill: #eaf7ec; stroke: #2e8b46; }
    .deny { fill: #fdecec; stroke: #d1242f; }
    .user { fill: #f6f8fa; stroke: #6e7781; }

    /* badge fills are darker than card strokes so the white digit reaches 4.5:1 */
    .badge-src  { fill: #1c8278; }
    .badge-gate { fill: #a3680c; }
    .badge-core { fill: #3b6fd8; }
    .badge-out  { fill: #7a4fd6; }
    .badge-store{ fill: #2c8543; }
    .badge-t    { fill: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; }

    .flow  { stroke: #57606a; stroke-width: 1.8; fill: none; }
    .ctl   { stroke: #6e7781; stroke-width: 1.5; fill: none; stroke-dasharray: 5 4; }
    .link  { stroke: #6e7781; stroke-width: 1.6; fill: none; }
    .rule  { stroke: #d0d7de; stroke-width: 1; }
    .ah-flow { fill: #57606a; }
    .ah-ctl  { fill: #6e7781; }
    .x { stroke: #d1242f; stroke-width: 2; }

    @media (prefers-color-scheme: dark) {
      .bg { fill: #0d1117; stroke: #30363d; }
      .frame { fill: #151b23; stroke: #30363d; }
      .t, .c { fill: #e6edf3; }
      .m { fill: #9198a1; }
      .src  { fill: #0f2a28; stroke: #3fb8a9; }
      .gate { fill: #2e2310; stroke: #e3a33b; }
      .core { fill: #14213d; stroke: #6d9bff; }
      .out  { fill: #251a40; stroke: #a888ff; }
      .store{ fill: #112a19; stroke: #4cc06a; }
      .deny { fill: #3a1417; stroke: #ff6b6b; }
      .user { fill: #161b22; stroke: #6e7681; }
      .badge-src  { fill: #3fb8a9; }
      .badge-gate { fill: #e3a33b; }
      .badge-core { fill: #6d9bff; }
      .badge-out  { fill: #a888ff; }
      .badge-store{ fill: #4cc06a; }
      .badge-t    { fill: #0d1117; }
      .flow  { stroke: #8b949e; }
      .ctl   { stroke: #768390; }
      .link  { stroke: #768390; }
      .rule  { stroke: #30363d; }
      .ah-flow { fill: #8b949e; }
      .ah-ctl  { fill: #768390; }
      .x { stroke: #ff6b6b; }
    }
  </style>

  <defs>
    <marker id="a-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah-flow" d="M0 0 L10 5 L0 10 z"/></marker>
    <marker id="a-ctl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah-ctl" d="M0 0 L10 5 L0 10 z"/></marker>
  </defs>
```

## 1. Source and content rules

1. Every node, edge, edge label, and subgraph in the Mermaid block appears in the SVG. Do not drop or merge nodes.
2. Every `%%` comment line in the Mermaid block appears in the CONSTRAINTS panel (section 6.6).
3. Do not add facts that are not in the Mermaid block. Rewording is allowed; restating an edge in card text is allowed.
4. When the Mermaid block changes, edit the SVG by hand to match. The SVG is not regenerated.
5. Mermaid `subgraph` targets (`A --> SubgraphName`) end on the frame edge.

## 2. Writing rules

- Each text line states a fact: a component, a value, a port, a limit, or a requirement.
- Subtitle: one plain sentence that says what the diagram shows.
- Do not use taglines, slogans, rhythmic lists of three, "not X, but Y" framings, value claims (robust, seamless, powerful), metaphors, or em dashes.
- Do not mention models, assistants, or automated generation in any file. Product names such as vLLM are allowed.

## 3. Canvas

| Item | Value |
|---|---|
| Root element | `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1262 H" width="1262" height="H" role="img" aria-labelledby="title desc">` |
| Width | 1262. Increase only when the diagram cannot be laid out legibly at 1262. |
| Height `H` | Grows to fit all content. Prefer more height over more width. |
| Accessible text | `<title id="title">` is the diagram name. `<desc id="desc">` states the full content, including every constraint, in plain sentences. |
| Background | `<rect class="bg" x="0.5" y="0.5" width="1261" height="H-1" rx="16"/>` |
| Content margin | x = 40 to 1222 (1182 wide). Frames extend 16 px further: x = 24 to 1238. |

## 4. Typography

All sans text uses `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`. Monospace text uses `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Class | Size / weight | Use |
|---|---|---|
| `.h1` | 24 px / 700 | Diagram title |
| `.h2` | 14 px / 650 | Card titles, actor names, deny-row text |
| `.b` | 12 px | Card body lines, constraint keys and values |
| `.s` | 11 px | Card footnotes, edge labels, legend text, monospace values |
| `.lbl` | 11 px / 700, letter-spacing 1.2 px, uppercase | Band labels and frame tag pills |
| `.k` | weight 650 | Constraint keys (`class="t b k"`) |

| Color class | Light | Dark | Use |
|---|---|---|---|
| `.t` | `#1f2328` | `#e6edf3` | Primary text |
| `.m` | `#59636e` | `#9198a1` | Secondary text, labels, person glyph |
| `.c` | `#1f2328` | `#e6edf3` | Monospace: resource names, ports, CRs, flags, CIDRs |

## 5. Color roles

Each card's role sets its fill, stroke, and badge color. Use one role per card. Pick the closest role when none fits exactly, and keep the mapping consistent across diagrams.

| Class | Light fill / stroke | Dark fill / stroke | Badge class (light / dark) | Use for |
|---|---|---|---|---|
| `.user` | `#f6f8fa` / `#6e7781` | `#161b22` / `#6e7681` | none | People: developer, Console user, reviewer |
| `.gate` | `#fff4e0` / `#c27c0e` | `#2e2310` / `#e3a33b` | `.badge-gate` `#a3680c` / `#e3a33b` | Entry and routing: URLs, routes, navigation links, `Service`, ports 9000, 9001, 9443, issue tracker |
| `.core` | `#ecf2ff` / `#3b6fd8` | `#14213d` / `#6d9bff` | `.badge-core` `#3b6fd8` / `#6d9bff` | Plugin component and platform: `DemosPage`, OpenShift Console, cluster API server, `ConsolePlugin`, console operator, GitHub |
| `.src` | `#e6f6f4` / `#1f8f84` | `#0f2a28` / `#3fb8a9` | `.badge-src` `#1c8278` / `#3fb8a9` | Definitions and tools: `cards.yaml`, `console-extensions.json`, `package.json`, `values.yaml`, `make`, `helm`, `oc`, `git`, webpack dev server |
| `.out` | `#f3ecff` / `#7a4fd6` | `#251a40` / `#a888ff` | `.badge-out` `#7a4fd6` / `#a888ff` | Running results: plugin page, Quick Start drawer, `Deployment`, `Job`, a release |
| `.store` | `#eaf7ec` / `#2e8b46` | `#112a19` / `#4cc06a` | `.badge-store` `#2c8543` / `#4cc06a` | Stored content: image registry, `ConsoleQuickStart` resources, `dist/`, the `main` branch |
| `.deny` | `#fdecec` / `#d1242f` | `#3a1417` / `#ff6b6b` | none | "Does not work" and "must not" conditions in the CONSTRAINTS panel |

Neutral surfaces:

| Class | Light fill / stroke | Dark fill / stroke | Use |
|---|---|---|---|
| `.bg` | `#ffffff` / `#d0d7de` | `#0d1117` / `#30363d` | Canvas, tag pills, nested inner frames |
| `.frame` | `#f6f8fa` / `#d0d7de` | `#151b23` / `#30363d` | Subgraph frames, CONSTRAINTS panel |
| `.rule` | stroke `#d0d7de`, 1 px | stroke `#30363d` | Card title separators, constraint row separators, legend separator |
| `.x` | stroke `#d1242f`, 2 px | stroke `#ff6b6b` | Deny-row icon |
| `.badge-t` | `#ffffff`, 11 px / 700 | `#0d1117` | Badge digit |

In light mode the `.badge-gate`, `.badge-src`, and `.badge-store` fills are darker than the matching card strokes so that the white digit reaches 4.5:1 (section 10).

Every class that sets a color has a matching rule inside `@media (prefers-color-scheme: dark) { ... }`. Add new classes to both blocks.


## 6. Components

All coordinates are relative to the component's top-left corner `(x, y)`, with width `w` and height `h`.

### 6.1 Title block

```xml
<text class="t h1" x="40" y="46">Single Node OpenShift</text>
<text class="m b" x="40" y="68">One node holds the master and worker roles: ...</text>
```

### 6.2 Band label

Uppercase `.m .lbl` text placed 8 px above the band it names, aligned with the band's left edge. Examples: `CLIENTS · ENTRY`, `CONSTRAINTS`.

### 6.3 Card

```xml
<rect class="core" x="X" y="Y" width="W" height="H" rx="12"/>
<circle class="badge-core" cx="X+18" cy="Y+20" r="10"/>
<text class="badge-t" x="X+18" y="Y+24" text-anchor="middle">1</text>
<text class="t h2" x="X+34" y="Y+25">Control plane</text>
<line class="rule" x1="X+12" y1="Y+40" x2="X+W-12" y2="Y+40"/>
<text class="t b" x="X+12" y="Y+62">etcd</text>              <!-- body: 18 px line pitch -->
<text class="m s" x="X+12" y="Y+H-18">single etcd member</text>  <!-- footnote: bottom-aligned -->
```

- Badges number the main cards in reading order, top to bottom and then left to right. Actor and entry cards may omit the badge, as in `sno.svg`.
- A card whose Mermaid node has no body text keeps the badge and title and drops the rule and body lines.
- When a row of cards has an uneven amount of text, give the whole row one height.
- Leave at least 26 px between cards. `sno.svg` uses 42 px.

### 6.4 Actor card

```xml
<rect class="user" x="X" y="Y" width="180" height="64" rx="12"/>
<circle class="m" cx="X+24" cy="Y+24" r="7"/>
<path class="m" d="M(X+12) (Y+45) q12 -16 24 0 z"/>
<text class="t h2" x="X+46" y="Y+37">Admins</text>
```

### 6.5 Frame (subgraph)

```xml
<rect class="frame" x="24" y="Y" width="1214" height="H" rx="14"/>
<rect class="bg" x="PX" y="Y-10" width="PW" height="20" rx="10"/>
<text class="m lbl" x="PX+12" y="Y+4">SINGLE NODE · MASTER + WORKER ROLES</text>
```

- The pill width `PW` is about 8.2 px per character plus 24 px.
- Place the pill where no edge crosses the frame's top edge.
- If the subgraph title does not fit, abbreviate it in the pill and spell it out in `<desc>` or in a `.m s` caption inside the frame.
- Nested subgraphs become nested frames. Give the inner frame `class="bg"` so it contrasts with the outer `.frame`, and give its pill `class="frame"`.
- Keep 16 px between a frame's edge and the cards inside it.

### 6.6 CONSTRAINTS panel

The panel holds the Mermaid block's `%%` notes as key/value rows.

| Placement | When | Geometry |
|---|---|---|
| Top-right panel | At most 5 short rows, and the client and entry cards fit in x = 40 to 560 | `<rect class="frame" x="600" y="98" width="622" height="..." rx="12"/>`, label at (600, 90) |
| Full-width band | All other cases | `<rect class="frame" x="40" y="98" width="1182" height="..." rx="12"/>`, label at (40, 90) |

Rows:

```xml
<!-- deny row: one per availability or support risk, listed first -->
<rect class="deny" x="PX+16" y="RY" width="PW-32" height="30" rx="8" stroke-dasharray="6 4"/>
<circle cx="PX+34" cy="RY+15" r="8" fill="none" class="x"/>
<line x1="PX+28.5" y1="RY+20.5" x2="PX+39.5" y2="RY+9.5" class="x"/>
<text class="t h2" x="PX+52" y="RY+20">No HA: a node reboot, including an upgrade, is a full outage</text>

<!-- key/value row: 32 px pitch, rule 14 px below the baseline -->
<text class="t b k" x="PX+16" y="BY">Minimum size</text>
<text class="c s" x="VX" y="BY">8 vCPU · 16 GB RAM · 120 GB disk</text>
<line class="rule" x1="PX+16" y1="BY+14" x2="PX+PW-16" y2="BY+14"/>
```

- Deny rows are stacked at a 38 px pitch. Use them only for availability risks (no HA, no live migration), support status (Tech Preview, demo only), and "must not" or "does not work" conditions. Other requirements are ordinary rows.
- Values are `.m b`, or `.c s` for literal values such as versions, CIDRs, CRs, and flags.
- The value column `VX` is the same for every row in a panel, at least 24 px to the right of the longest key.
- A long value wraps onto extra lines at an 18 px pitch, and the row grows by 18 px per extra line.

### 6.7 Legend

```xml
<line class="rule" x1="40" y1="H-66" x2="1222" y2="H-66"/>
<path class="flow" d="M40 H-38 H76" marker-end="url(#a-flow)"/>
<text class="m s" x="86" y="H-34">request path</text>
<rect class="core" x="LX" y="H-46" width="22" height="16" rx="4"/>
<text class="m s" x="LX+30" y="H-34">control plane</text>
```

- List one entry per edge style and per color role used in the diagram, and nothing else. Edge styles come first.
- The `.deny` swatch carries `stroke-dasharray="4 3"`.
- Leave at least 30 px between entries. When the entries do not fit on one row, add a second row 28 px lower and increase `H` to match.

## 7. Edges

| Mermaid | Class | Light / dark stroke | Width / dash | Marker |
|---|---|---|---|---|
| `-->` | `.flow` | `#57606a` / `#8b949e` | 1.8 / solid | `#a-flow` |
| `-.->` | `.ctl` | `#6e7781` / `#768390` | 1.5 / `5 4` | `#a-ctl` |
| `---` | `.link` | `#6e7781` / `#768390` | 1.6 / solid | none |
| `-.-` | `.ctl` | as above | 1.5 / `5 4` | none |
| `<-->`, `<-.->` | `.flow` / `.ctl` | as above | as above | `marker-start` and `marker-end` |

Markers:

```xml
<marker id="a-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah-flow" d="M0 0 L10 5 L0 10 z"/></marker>
<marker id="a-ctl"  viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah-ctl"  d="M0 0 L10 5 L0 10 z"/></marker>
```

Routing:

1. Draw paths with `H` and `V` segments only.
2. Start a path on the source's edge. End it 2 px before the target's edge so the arrow tip touches the border, for example `V368` for a card whose top is at `y=370`.
3. Do not route a path through a card or a text line. Reorder or move cards to remove crossings before adding detours.
4. Fan-out edges that share a label may share one bus segment. Place the label next to the branch the Mermaid block labels.
5. Put each edge label in `.m s`, 6 to 8 px beside the segment it labels. A label never sits on a line or box. Split long labels onto two lines at a 14 px pitch.

## 8. Drawing order

SVG paints in document order. Write the file in this order so frames never cover arrowheads:

1. `<title>`, `<desc>`, `<style>`, `<defs>`
2. Canvas background
3. Title block
4. CONSTRAINTS panel
5. Frames and their pills, outer frames before inner frames
6. Cards
7. Edges and edge labels
8. Legend

## 9. Text handling

- SVG collapses repeated spaces. Separate items with ` · ` and do not rely on alignment spaces.
- Escape `&`, `<`, and `>` in text and in `<desc>`.
- Mixing `.m` and `.c` text on one line needs two `<text>` elements at fixed x positions. These can misalign when a viewer substitutes fonts, so prefer one class per line.
- Each text line must fit inside its card with at least 12 px on the right. Wrap the line, or widen the card.

## 10. Accessibility

Contrast ratios for the defined pairs:

| Pair | Ratio | WCAG |
|---|---|---|
| `.m` on `.bg` / `.frame`, light | 6.11 / 5.74 | AA text |
| `.m` on `.frame`, dark | 5.94 | AA text |
| `.m` on `.deny`, light / dark | 5.35 / 5.58 | AA text |
| `.ctl` / `.link` `#6e7781` on `.frame`, light | 4.27 | 1.4.11 non-text (3:1) |
| `.ctl` / `.link` `#768390` on `.frame`, dark | 4.47 | 1.4.11 non-text (3:1) |
| `.user` stroke `#6e7781` on `.bg` / `.frame`, light | 4.55 / 4.27 | 1.4.11 non-text (3:1) |
| `.user` stroke `#6e7681` on `.bg` / `.frame`, dark | 4.12 / 3.77 | 1.4.11 non-text (3:1) |
| Role card strokes on `.bg`, light (lowest: `.gate` `#c27c0e`) | 3.40 | 1.4.11 non-text (3:1) |
| Role card strokes on `.bg`, dark (lowest: `.out` `#a888ff`) | 6.88 | 1.4.11 non-text (3:1) |
| `.badge-t` white on `.badge-gate` / `.badge-src` / `.badge-store` / `.badge-core` / `.badge-out`, light | 4.62 / 4.65 / 4.62 / 4.72 / 5.36 | AA text |
| `.badge-t` `#0d1117` on dark badges (lowest: `.badge-out` `#a888ff`) | 6.88 | AA text |
| `.m` on any role fill, light / dark (lowest) | 5.31 / 5.22 | AA text |

Ratios use the WCAG 2.x relative-luminance formula. Recompute them for any new color pair before adding it.

The SVGs are embedded with Markdown image syntax, which renders as `<img>`. `<title>` and `<desc>` are not exposed to assistive technology through `<img>`, so the Markdown `alt` text states what the diagram shows, and the Mermaid block under the image carries the full content.

## 11. Verification

### 11.1 Automated check

The checker is not in this repository. It is `tools/svgcheck.cjs` in the sibling `aci-assessment` checkout, with `puppeteer` installed under `tools/node_modules` there. It needs Node.js 22.12 or later. Run it from this repository's root:

```bash
node ../aci-assessment/tools/svgcheck.cjs --out docs/plans/svg-renders docs/images/*.svg
```

| Check | Fails when |
|---|---|
| XML | The file is not well-formed. |
| Root element | `viewBox` is missing, `width`/`height` differ from it, `<title id="title">` or `<desc id="desc">` is missing, or `aria-labelledby` is not `title desc` (section 3). |
| Shared style | The `<style>` and `<defs>` blocks differ from the checker's template, which equals the blocks reproduced at the top of this guide. |
| Text placement | Text extends past the canvas or past the right edge of its enclosing box minus 2 px, or two text elements overlap. |

Expected output: one line per file, `<name>: OK` or `<name>: FAIL` followed by the issues, then a summary line. The command exits 0 when every file passes, 1 when any file fails, and 2 when the browser cannot start. PNGs are written as `<name>-light.png` and `<name>-dark.png` to the `--out` directory; `docs/plans/` is ignored by Git.

### 11.2 Manual review

This review is required for every new or edited file. Open both PNGs:

1. Both renders show every element.
2. Arrow tips touch borders, no edge crosses a card, and no label sits on a line (section 7).
3. Every node, edge, label, subgraph, and `%%` note in the Mermaid block is present.
4. On GitHub, read every `.s` text line at README column width without zooming.
