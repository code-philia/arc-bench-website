# Task Data Sources

This directory contains task documents and tests only. Reusable starter
projects live in the sibling `arc-template` submodule.

## Layout

```text
data/
  arc-bench/
    web/<task-id>/
    mobile/<task-id>/
  playground/
    web/<task-id>/
  competition/
    <competition-id>/<task-id>/
```

Each task directory contains:

```text
<task-id>/
  requirements/
  tests/
```

Template files are resolved from:

- Web and playground tasks: `arc-template/templates/website-app/files`
- Mobile tasks: `arc-template/templates/mobile-app/files`
