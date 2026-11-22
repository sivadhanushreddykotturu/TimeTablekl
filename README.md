# announcements

This branch only holds `announcements.json`, which the TimeTable app reads
(no redeploy needed). Edit it in GitHub's web editor and commit.

- `active`: `true` shows it, `false` hides it
- `type`: `info`, `warning`, `critical` or `success`
- `title`, `message`: the text (new lines are kept in the message)

Changes reach users within a few minutes (GitHub caches the file).
