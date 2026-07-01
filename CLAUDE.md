# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Jekyll-based personal portfolio/blog site (`heisguyy.github.io`), deployed via GitHub Pages. It has no build tooling beyond Jekyll/Sass — no JS bundler, no package.json, no test suite.

## Commands

```bash
bundle install          # install gems (Jekyll 4.3.2, minima theme, jekyll-feed)
bundle exec jekyll serve   # run local dev server with live reload (default: http://localhost:4000)
bundle exec jekyll build   # build static site into _site/
```

There is no lint or test command configured.

## Architecture

- **`_config.yml`** — global site settings (title, email, social handles, theme `minima`, plugins). Not reloaded on `jekyll serve`; restart the server after editing.
- **Pages are plain HTML files with Liquid front matter** (`index.html`, `blog.html`, `project.html`, `404.html`) rather than Markdown — each declares a `layout:` in its front matter and the actual markup lives inline in the file (not just in the layout).
- **`_layouts/`** — page shells (`home.html`, `blog.html`, `post.html`, `projects.html`, `random.html`). Each layout independently duplicates the same `<nav>`/hamburger-menu/footer boilerplate rather than sharing a common include, so navigation changes (e.g. adding a link) must be repeated across every layout file in `_layouts/`.
- **`_posts/`** — blog posts in Jekyll's `YYYY-MM-DD-title.markdown` naming convention, rendered through the `post` layout and listed on `blog.html` (grouped by year via `group_by_exp`).
- **`project.html`** — hand-written list of projects grouped by year (not data-driven from `_data/` or front matter), each entry with inline SVG social icons (GitHub, etc.) — new projects are added by copying an existing entry's markup block.
- **`assets/`** — `css/style.css` (hand-written, no Sass partials/preprocessing pipeline beyond Jekyll's built-in Sass support with `quiet_deps: true`), `js/main.js` (hamburger nav toggle), `images/`, `gif/`.
- No component/include system (`_includes/`) is currently used — shared markup is copy-pasted across layouts.
