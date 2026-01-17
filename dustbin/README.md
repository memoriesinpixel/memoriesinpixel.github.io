# Jekyll Photography Site

This repository hosts a Jekyll-powered photography website for GitHub Pages. It renders a responsive, lazy-loaded gallery from images placed in the `images/` folder.

## How it works

- The homepage uses the `home` layout to enumerate static files under `images/` via Jekyll's `site.static_files`.
- Layouts and includes live in `_layouts/` and `_includes/`.
- Styles are in `assets/css/style.css`.
- Site configuration is in `_config.yml`.

## Add photos

1. Place images (JPG/PNG/WebP) into `images/` at the repo root.
2. Commit and push — GitHub Pages will rebuild your site automatically.

Captions are derived from the filename (without extension), with `-` and `_` converted to spaces.

## Local development (optional)

You'll need Ruby and Bundler. On Windows, install Ruby+DevKit from https://rubyinstaller.org.

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.

## Customization

- Update `_config.yml` for `title`, `description`, `email`, and `url`.
- Adjust styles in `assets/css/style.css`.
- Create pages like `about.md`, `contact.md`, or `portfolio.md` with front matter and content.
