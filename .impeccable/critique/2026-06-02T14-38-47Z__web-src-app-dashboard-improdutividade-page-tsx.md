---
target: improdutividade page
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-06-02T14-38-47Z
slug: web-src-app-dashboard-improdutividade-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading spinner exists, but no feedback on sort/expand; no skeleton states |
| 2 | Match System / Real World | 3 | Domain terms well used; minor jargon (N-Planej) |
| 3 | User Control and Freedom | 2 | No filters; no dismiss expanded except re-click |
| 4 | Consistency and Standards | 3 | Card patterns consistent; help panel style differs |
| 5 | Error Prevention | 1 | No error handling; no empty state; CSV with no data breaks |
| 6 | Recognition Rather Than Recall | 2 | Color legend only in fleet bar; abbreviations need recall |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts; no search/filter; no bulk compare |
| 8 | Aesthetic and Minimalist Design | 2 | Expanded section repeats data; crowded top; AI-generic palette |
| 9 | Error Recovery | 1 | No error messages; API failure = blank page |
| 10 | Help and Documentation | 3 | Help panel excellent; only covers categories |
| **Total** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict
Detector: 1 finding — ai-color-palette at line 459 (violet text-violet-700). Emerald/amber/violet/red = generic AI palette.

## Priority Issues
- [P1] No error handling or real data path
- [P1] No filtering (operator, machine, frente)
- [P2] Expanded section redundant
- [P2] Color palette flags as AI-generated
- [P2] No actionable outcomes from data

## Persona Red Flags
- Alex: No keyboard nav, no compare, no filtered export
- Jordan: Abbreviations cryptic, help hidden, color-only meaning
- Sam: Bars color-only, no aria-labels, no focus indicators
