# Prompt For Another LLM

Use this prompt to ask another model for PACA redesign directions.

```text
You are a senior product designer and frontend engineer. Design 3 distinct UI shell directions for P-ACA, a Korean 체대입시 학원 operations console.

Context:
- Product: P-ACA manages students, 상담, schedules, attendance, instructors, payments, reports, notifications, and tablet/mobile attendance flows.
- Primary users: academy owner, desk staff, instructors, 상담 operators.
- Current problem: the UI feels like a dated admin template. It has too many generic cards, repeated gray panels, weak hierarchy, rounded/shadow-heavy SaaS styling, and screens where important tasks compete with every other table cell.
- Goal: premium operations console, not marketing page. Dense, fast, composed, trustworthy, Korean-first.
- Surfaces to represent in the demo: sidebar or rail, top command/search area, today's work queue, KPI/status strip, student/payment/schedule table, 상담 follow-ups, and empty/error copy examples.

Design constraints:
- Product UI, not landing page.
- Preserve operational density.
- Avoid gradient text, decorative blobs, glassmorphism, hero-metric templates, emoji buttons, and nested cards.
- Use familiar symbols/icons for actions.
- Cards max 8px radius.
- No one-note purple, beige, dark-blue, or orange/brown palette.
- Use Korean interface copy.
- Make desktop first, but show how the shell adapts to tablet.
- Include empty, loading, and error states with clear Korean plain-language messages.

Deliverables:
1. Three named design directions with a short positioning statement.
2. For each direction, describe layout, navigation, color strategy, typography, table treatment, status/badge language, and mobile/tablet adaptation.
3. Provide a compact HTML/CSS prototype or implementable React/Tailwind component sketch for each direction.
4. Recommend one direction for P-ACA and explain tradeoffs.
```
