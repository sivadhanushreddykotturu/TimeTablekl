# announcements

This branch holds **data only**. The TimeTable app reads these files straight from GitHub
(no redeploy needed); changes reach users within a few minutes (GitHub caches the files).
Easiest way to change them: the **TimeTable Admin** app (branch `admin-pwa`), or GitHub's web editor.

## announcements.json

The notice under the Today header.

- `active`: `true` shows it, `false` hides it
- `type`: `info`, `warning`, `critical` or `success` (only tints the small icon)
- `title`, `message`: the text (new lines are kept in the message)

## theme.json

The "event background": a subtle picture behind the Today header (new movie, event week, ...).

- `active`: `true` shows it, `false` hides it
- `image`: file in this branch, for example `theme/event-1700000000000.jpg`, or a full https link
- `version`: change it when you swap the picture (it busts caches)
- `strength`: `0.1` to `0.9`, how visible the picture is
- `focus`: which part of the picture stays in view, for example `"55% 12%"` (left/right, top/bottom)
- `glow`: `true` keeps the coloured glow behind the picture (off by default)
- `devices`: where it shows, any of `"mobile"`, `"tablet"`, `"desktop"`. Other devices never download the picture
- `expires`: optional last day, `"YYYY-MM-DD"`; it switches itself off after that
- `accent`: optional `"#rrggbb"` tint

Pictures live in `theme/`. Keep them around 1080 px wide and under about 250 KB.
