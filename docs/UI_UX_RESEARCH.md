# UI/UX research and redesign plan

Research date: 2026-10-24 (UTC). Application reviewed: commit `7656326`.

## Recommendation

Improve readability and the daily workflow before adding more product features. Keep the dark/light theme, but give the application a readable type scale, stronger contrast, clearer charts and tables, and a simpler arrangement of frequent actions.

The findings below describe the baseline at commit `7656326`, before the readability implementation. They combine the user's screenshot, a source inspection, calculated CSS color contrasts, and public documentation of comparable products. Competitor features are documented features, not hands-on testing inside paid or authenticated accounts. Proposed changes are our recommendations, not claims that the reference products implement every detail. The first delivery has now been implemented locally; see section 6 and the verification report for its scope and checks.

## 1. What is wrong in the current version

| Finding | Evidence in our source | Effect | Priority |
| --- | --- | --- | --- |
| Essential text is too small | `app/globals.css` sets the body to 13px, table headers to 8px, and mobile table headers to 7px. Many controls and supporting labels use 8–12px. | The page is difficult to scan even when it technically fits the screen. | Immediate |
| Mobile styling reduces readability further | Small-screen rules reduce many text sizes rather than reorganizing the layout. | A layout can pass an overflow check and still be hard to use. | Immediate |
| Chart labels shrink with the chart | `app/activity-dashboard.tsx` uses an 800-unit-wide SVG and text sizes of 12/13 units. At a displayed chart width of 320 CSS pixels, those labels are approximately 4.8/5.2 CSS pixels. This is a sizing calculation, not a fresh browser measurement. | Increasing a CSS body size alone will not fix the chart. | Immediate |
| Important table labels have low contrast | Dark headings use `#676873` on `#1b1c21`, approximately 3.08:1. Light-theme dim text on white is approximately 3.35:1. | Information needed to interpret the numbers is faint. | Immediate |
| The chart can suggest the wrong total | The supplied screenshot stacks 12 saved-job events and 6 application events into a height of 18. | That is 18 activities, not 18 applications or necessarily 18 different jobs. | Immediate |
| The exact-values table inherits generic table styling | Global `th` styling, letter spacing, and small fonts apply to the analytics table; its container also has a fixed 350px maximum height. | The data view is compressed and adds a nested vertical scroll area. | Immediate |
| Chart interaction mainly depends on hover | Individual bars contain native SVG titles. | Precise values are inconvenient for touch users and are not exposed through a dedicated keyboard-operable chart control. | Next |
| Too many controls have equal visual weight | Date preset, grouping, company, activity type, work arrangement, custom date fields, and action buttons appear together. | The user must understand the whole reporting interface before answering a simple question. | Next |
| Some controls are physically small | Row icon buttons are styled down to 18px wide on mobile. | Touching the intended action is harder; actual target size and surrounding spacing need browser testing. | Immediate |

Contrast values above were calculated from declared foreground/background colors using the sRGB relative-luminance formula. They are not a complete accessibility audit. Muted text is not uniformly defective: `#95959f` on the dark panel is approximately 5.98:1. Fix particular failing color combinations rather than making every label equally bright.

The existing functional/browser tests verify actions, ownership, and layout overflow. Those checks do not establish comfortable text size, contrast, chart comprehension, or successful keyboard/touch use.

## 2. What the design research supports

### Readable typography

The GOV.UK type scale uses relative units and explicitly keeps its 16px scale point at that size on smaller screens. The Home Office guidance uses 19px body text on large screens and 16px on small screens, with 16px as the minimum recommended desktop size for complex caseworking services. These are useful design references, not a universal WCAG minimum font size. [GOV.UK type scale](https://design-system.service.gov.uk/styles/type-scale/), [Home Office typography](https://design.homeoffice.gov.uk/design-system/styles/typography).

**Our proposed type scale:**

| Element | Proposed default | Treatment |
| --- | --- | --- |
| Body, forms, navigation, buttons | 16px / 1rem | Normal or medium weight; body line height around 1.5 |
| Table headers and data | 16px / 1rem | Sentence-case headings; semibold headers; tabular numerals |
| Secondary metadata and chart labels | 14–16px | Only genuinely secondary content at 14px; essential instructions stay 16px |
| Section titles | 20–24px | Clear spacing before the section |
| Page titles | 28–32px | Responsive wrapping |
| Primary metric values | 32–40px | Short, readable labels and explicit units |
| Main control height | At least 44px | Comfortable pointer/touch target; visible focus |

Use semantic `rem` tokens and shared components. Keep the existing Inter/system-font approach; a new font will not solve the size and hierarchy problems. On mobile, reduce the number of columns and wrap controls instead of shrinking meaningful text.

### Contrast, zoom, and controls

Use at least 4.5:1 for normal text and the applicable 3:1 threshold for qualifying large text. Check the theme-specific colors actually used behind each label. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Important graphical information and visual control indicators require appropriate 3:1 non-text contrast against adjacent colors. Our chart palette needs separate light-theme checks: the current blue against white is approximately 2.33:1 and amber approximately 1.86:1. Color must be supplemented by labels, values, or other useful cues. [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Support text enlargement to 200% without lost functionality. Check layout reflow at 320 CSS pixels; wide data tables may use a localized horizontal scroll area rather than forcing the whole page to scroll sideways. [W3C text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [W3C reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow).

Our 44px control target is a comfort recommendation. WCAG 2.2 AA's Target Size (Minimum) criterion specifies 24×24 CSS pixels with defined exceptions, including spacing; an 18px-wide control is a reason to inspect the actual layout, not sufficient evidence by itself to declare a failure. [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Dashboard hierarchy

ONS recommends placing the most important insights prominently and making charts understandable across devices. Its chart-text guidance calls for visible, concise labels and clear titles. [ONS dashboards](https://service-manual.ons.gov.uk/data-visualisation/guidance/dashboards), [ONS chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text).

Keep frequent controls visible and place less frequent options behind an obvious, clearly named control. This follows progressive disclosure; it does not mean hiding the user's main task. [Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/).

## 3. Similar systems and what we should learn

| Reference | What its official material shows | Useful update for this application |
| --- | --- | --- |
| [Teal Job Tracker](https://www.tealhq.com/tools/job-tracker) | Stage-based organization, job-specific checklists, follow-up support, and contacts linked to jobs. | Present a clear next action for each opportunity; later add a preparation checklist and follow-up date. |
| [Huntr Job Board](https://help.huntr.co/en/articles/13413245-the-job-board) | Jobs organized in stage columns, with drag/drop and an alternative Move action. | Offer an optional Board view alongside the existing List view; keep a button/menu alternative for status changes. |
| [Huntr Activities](https://help.huntr.co/en/articles/10042702-activities) and [Job Search Metrics](https://huntr.co/product/job-search-metrics) | Dated activity, tasks, categories, application/interview statistics, and funnel insights. | Separate what needs action from completed activity; make counts lead to the relevant job records. |
| [Simplify Job Tracker](https://help.simplify.jobs/help/articles/2140179-using-the-job-tracker) | List/column views, saved filters, favorites, archiving, and CSV import/export. | Add saved views and archiving after readability is fixed; keep the 10/20/50 list and visible opportunity IDs. |
| [Simplify Flow Chart Insights](https://help.simplify.jobs/help/articles/6486416-flow-chart-insights) | A separate view of applications progressing through stages. | Treat a future funnel as a distinct view, with explicit counting rules, rather than interpreting stacked activity totals as conversion. |

These references support workflow decisions. They do not establish that a competitor's typography or accessibility is superior without measuring its actual rendered interface.

## 4. Recommended redesign, in implementation order

### Phase 1 — Readability across the application

1. Replace scattered tiny font rules with the shared type scale above, covering sign-in, navigation, job lists/details, profile, manager views, and analytics.
2. Increase label contrast, especially table headers and secondary metadata. Use theme-specific chart colors.
3. Enlarge buttons, form controls, pagination, and icon targets; add clear focus styles.
4. Remove aggressive uppercase/letter spacing from data-table headings.
5. Give larger text appropriate spacing, wrapping, and row heights. Do not add a final CSS override that leaves conflicting rules throughout the application.

Typography and presentation fixes can normally ship without changing business data or a database migration. Persisting a new reading-size or density preference would require a separate settings change and reviewed migration.

### Phase 2 — Progress dashboard and job workspace

**Dashboard layout:**

1. Page title and short current-range summary.
2. Frequent range choices: Today, This week, This month, and Custom.
3. Three prominent cards: applications submitted, interview rounds completed, and offers recorded. Keep the other metrics available in a secondary row or expandable section.
4. Daily/weekly/monthly trend chart, defaulting to separately identifiable applications and interview rounds. An optional All activity mode can retain stacked events with an explicit activity-count axis.
5. Exact values and activity records, followed by brief definitions and data-coverage notes.

Move company, work arrangement, and less frequent filtering into a clearly visible More filters control. Show active-filter chips and a Reset action. Only show editable From/Through inputs when custom dates are requested; retain the chosen date range in the summary.

**Charts:** keep axis/legend text at a readable rendered size as the viewport changes. Use container-aware dimensions rather than shrinking the whole 800-unit SVG. Provide touch and keyboard access to a date's values, a short text summary, and the existing exact-values fallback. Avoid dependence on hovering over a narrow colored bar.

**Exact-values table:** use 16px text, wrapped readable headers, tabular/right-aligned numbers, a sticky header, and a clear date column. Replace the fixed-height nested vertical scroller with a suitable paginated table. Keep horizontal scrolling local to wide tables on small screens. Do not hide metrics or zero-activity dates without an explicit, labeled user control.

**Application workspace:** show the opportunity ID, title/company, status, and next action clearly. Put common actions where they are easy to find: open posting, mark applied, export JD, attach resume, and log interview. Consider a desktop detail panel that retains list position, with an accessible dialog or dedicated detail page on mobile. Preserve manual application behavior.

**Profile:** retain the full career history while making navigation easier through section links, clear section headings, and visible saved/unsaved state. Collapsing optional sections must not hide validation errors or make content look lost.

### Phase 3 — Optional functional improvements

| Improvement | Why it helps | Data/logic implications |
| --- | --- | --- |
| Board/List toggle | Different ways to scan the same pipeline | Preserve stable IDs and existing ownership/status rules; provide keyboard/button alternatives to dragging |
| Follow-up date and next-action list | Shows what to do next | New task/date storage and a migration; define UTC or an explicit user time zone |
| Saved filters and reading/density settings | Avoids repeatedly configuring the workspace | Per-account PostgreSQL preferences; compact mode must still be readable |
| Archive | Declutters lists while retaining history | Add an archive state and explicitly define whether archived records remain in reports |
| CSV export | Supports personal analysis and backups of selected application data | Owner-scoped export; protect spreadsheet users from formula-like cell values |
| Period comparisons and goals | Gives counts context | Compare equivalent elapsed periods; store goals if introduced |
| Application-to-interview funnel | Helps understand progress through the search | Requires unique-job/cohort calculations and clearly stated historical coverage |

For a future funnel, define the application cohort first. For example: unique jobs applied to in a chosen period that have at least one completed interview by the reporting cutoff, divided by all jobs in that application cohort. Two interview rounds for one application must not be reported as a 200% job conversion rate. The current dashboard's round totals should remain distinct from job-level funnel counts.

The reference products contain automation and AI features, but those are separate product decisions. The immediate redesign should focus on the user's manual workflow, existing local exports, and private PostgreSQL application.

## 5. Acceptance checks for the redesign

- Readable defaults at 100% browser zoom: 16px body/forms/table data, 14–16px secondary/chart labels, and clear headings.
- Correct effective chart-label sizes after responsive layout; a source `fontSize` value alone is insufficient.
- Check normal text contrast in both themes, plus required graph/control cues. Use computed browser colors for the final audit.
- Test 100%, 125%, 150%, and 200% browser zoom and a 320 CSS-pixel layout. Allow an isolated wide-table exception where justified.
- Test desktop/tablet/mobile widths without solving overflow by making text smaller.
- Operate filters, chart values, tables, dialogs, and Board alternatives using a keyboard and touch.
- Distinguish unique jobs, application events, completed interview rounds, and total activities in every label.
- Verify date grouping, filters, pagination totals, and historical-coverage messages retain their existing meaning.
- Re-run ownership, manager read-only, profile, export-folder, status, and interview regression checks.
- Review representative screenshots with the user. Passing automated tests is not a substitute for that readability check.

## 6. Proposed first delivery

Start with Phase 1 and the chart/table/filter parts of Phase 2. They directly address the supplied screenshot and improve existing functionality. Treat Board view, follow-ups, saved views, archiving, and funnel calculations as later work with their own requirements and migrations.

Implemented first delivery: shared readable typography and theme colors; larger controls and focus styles; simplified dashboard filters with active filters; primary/secondary metric hierarchy; responsive side-by-side bars in both chart modes; keyboard/touch period selection and persistent exact values; 10/20/50-row exact-values pagination; opportunity section navigation and earlier JD export; clearer profile saved state and section navigation; accessible mobile navigation. No database migration or new dependency was added. The application remains a standalone VPS app. The implementation was verified locally; publishing it to GitHub does not update the production VPS.

The All activity mode uses grouped bars as well, avoiding the need to interpret combined event heights. Long ranges display a labeled window around the selected date while retaining every period in the selector and table. A desktop detail side panel, Board view, follow-ups, saved views, archiving, and funnel calculations remain future work.
