# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

The scripts (`dev`, `tw`, `dev:all`) are listed in AGENTS.md. There are no test, lint, or build scripts. What AGENTS.md doesn't say:

- **`npm run tw` exits immediately when stdin isn't a TTY** (agent shells, CI): Tailwind v4's `--watch` stops when stdin closes. VS Code terminals are fine. From a non-interactive shell run `npm run tw -- --watch=always`.
- `.vscode/tasks.json` auto-starts both `tw` and `dev` on folder open (`trifoldi.vbs` launches VS Code to trigger this). Check whether they're already running before starting either; a second `npm run dev` fails with `EADDRINUSE`.
- nodemon only watches `js,mjs,cjs,json`. EJS and CSS edits don't restart the server.

## Configuration

- `.env` is gitignored. `PORT` is 3001, reserved for `trifoldi` in the shared registry `F:\trifoldi\projects\project-ports.json`. Look ports up there rather than choosing one.
- `server.js` passes `dbName: 'trifoldi'` explicitly to `mongoose.connect()`. Keep it. The connection is non-blocking, so the server starts even if Mongo is down.
- `SESSION_SECRET` is blank and no session middleware is installed yet.
- `init_prompt.md` is the one-time scaffold spec and has already been applied. It isn't a description of current state. One deliberate deviation: `server.js` falls back to port 3001, not the spec's 3008, which is registered to another project (`storiesbyshews`).

## Architecture

Server-rendered Express 5 + EJS, split into three **facades**. Each is one route module plus one view folder:

| Facade | Mount    | Router              | Views          |
|--------|----------|---------------------|----------------|
| Public | `/`      | `routes/public.js`  | `views/public/`|
| App    | `/app`   | `routes/app.js`     | `views/app/`   |
| Admin  | `/admin` | `routes/admin.js`   | `views/admin/` |

Conventions that span several files:

- **`router.routes` is hand-maintained.** Each router has a `router.routes = [{ method, path, label }]` array at the bottom. `server.js` reads it to print the clickable route map on every startup. It is not derived from the router, so update it whenever a route is added, removed or renamed.
- **Every `res.render` must pass `facade` and `title`.** Each route file defines a `facade` object (`name`, `home`, `nav`). `views/partials/head.ejs` uses it to render the header and nav, and throws if either is missing. Views call `include('../partials/head')` with no arguments because EJS includes inherit the parent's locals.
- **Task board (`/dev-resources/tasks`)** is internal tooling. It is mounted from `server.js`'s separate `internal` list, not `facades`, and must not be linked from any facade. Its view is `dev_resources/tasks.ejs` (outside `views/`), rendered by absolute path from `routes/tasks.js`. It uses plain HTML forms only (`POST /:id/update`, `POST /:id/delete`) and `models/Task.js`. It checks `mongoose.connection.readyState` itself so a down DB shows a banner instead of hanging on Mongoose's 10s buffering.
- App facade pages (`items`, `item`, `auth`) are placeholder shells. "Items" stands in for the real entities, which aren't defined yet.
- **Tailwind v4 has no `tailwind.config`.** Classes are auto-detected from every non-gitignored file (including `dev_resources/*.ejs`), and `src/input.css` is just `@import "tailwindcss"`. `public/output.css` is generated and gitignored.
