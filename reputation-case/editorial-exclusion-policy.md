# Editorial Exclusion Policy (Hard Block)

Date: 2026-03-04
Status: active

## Objective
Prevent accidental amplification of hostile or reputation-harming trope clusters in positive multilingual scaling.

## Hard-excluded trope cluster
- Current Time appointment trope
- Kyiv Post framing tied to that trope

## Hard-excluded URLs for positive publishing
1. https://www.kyivpost.com/post/15197
2. https://detector.media/infospace/article/209625/2023-03-31-conflict-in-current-time-tv-over-possible-appointment-of-propagandist-ilya-klishin/

## Operational rule
1. Keep these URLs only for monitoring/removal workflows.
2. Do not use these URLs in:
- digest batches,
- public digest cards,
- multilingual scaling packs,
- social distribution snippets.

## Allowed use
- Legal/removal dossiers and evidence logs.
- Internal monitoring only.

## Enforcement markers
- `translation_route = no_scale_monitor_only`
- `scaling_priority = EXCLUDE`
- `status = excluded_do_not_publish`
