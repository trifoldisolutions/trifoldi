# Project Overview

> After making any edit or running tests, and before ending a turn or task, check that `npm run dev` and `npm run tw` are still running. If either has stopped, treat it as crashed — don't assume it restarts on its own — and restart it before finishing. This check is silent: don't tell the user the services are still running, and don't mention a restart either. Only bring them up if one won't stay running after a restart.

## Stack
- Node.js (Express)
- Mongoose (MongoDB)
- EJS (Templating)
- Tailwind CSS (Styling)
- Nodemon (Development)

## Scripts
- `npm run dev`: Starts the server with nodemon.
- `npm run tw`: Starts Tailwind CSS watch mode.
- `npm run dev:all`: Runs both in one terminal pane.

## Script Notes

There are no test, lint, or build scripts. What the list above doesn't say:

- **`npm run tw` uses `--watch=always`** because Tailwind v4's plain `--watch` stops when stdin closes (agent shells, CI, Dispatch's Run button). Keep the flag. `npm run tw` is also how to restart it per the note at the top of this file.
- `.vscode/tasks.json` auto-starts both `tw` and `dev` on folder open (`trifoldi.vbs` launches VS Code to trigger this). Check whether they're already running before starting either; a second `npm run dev` fails with `EADDRINUSE`.
- nodemon only watches `js,mjs,cjs,json`. EJS and CSS edits don't restart the server.

## Configuration

- `.env` is gitignored. `PORT` is the port Dispatch's registry assigns `trifoldi` (see the dashboard at http://localhost:3000, or `GET /api/registry`), and Dispatch writes it into `.env` when it starts the project. Look it up there rather than choosing one.
- `server.js` passes `dbName: 'trifoldi'` explicitly to `mongoose.connect()`. Keep it. The connection is non-blocking, so the server starts even if Mongo is down.
- `SESSION_SECRET` is blank and no session middleware is installed yet.
- `init_prompt.md` is the one-time scaffold spec and has already been applied. It isn't a description of current state. Two deliberate deviations: `server.js` falls back to port 3001, not the spec's 3008, which is registered to another project (`storiesbyshews`). And there is no App facade (`/app`), which the spec calls for. The project isn't using one for now, and the initial commit still has the removed scaffold if it's needed later.

## Architecture

Server-rendered Express 5 + EJS, split into **facades**. Each is one route module plus one view folder:

| Facade | Mount    | Router              | Views          |
|--------|----------|---------------------|----------------|
| Public | `/`      | `routes/public.js`  | `views/public/`|
| Admin  | `/admin` | `routes/admin.js`   | `views/admin/` |

Conventions that span several files:

- **`router.routes` is hand-maintained.** Each router has a `router.routes = [{ method, path, label }]` array at the bottom. `server.js` reads it to print the clickable route map on every startup. It is not derived from the router, so update it whenever a route is added, removed or renamed.
- **Every `res.render` must pass `facade` and `title`.** Each route file defines a `facade` object (`name`, `home`, `nav`). `views/partials/head.ejs` uses it to render the header and nav, and throws if either is missing. An optional `documentTitle` replaces the whole `<title>` (the landing page uses it); otherwise it is `title · facade · Trifoldi`. Views call `include('../partials/head')` with no arguments because EJS includes inherit the parent's locals.
- **Task board (`/dev-resources/tasks`)** is internal tooling. It is mounted from `server.js`'s separate `internal` list, not `facades`, and must not be linked from any facade. Its view is `dev_resources/tasks.ejs` (outside `views/`), rendered by absolute path from `routes/tasks.js`. It uses plain HTML forms only (`POST /:id/update`, `POST /:id/delete`) and `models/Task.js`. It checks `mongoose.connection.readyState` itself so a down DB shows a banner instead of hanging on Mongoose's 10s buffering.
- **Tailwind v4 has no `tailwind.config`.** Classes are auto-detected from every non-gitignored file (including `dev_resources/*.ejs`), and theme customization lives in `src/input.css`. `public/output.css` is generated and gitignored.
- **Fonts:** Supreme and Bevellier (Fontshare, ITF Free Font License) are self-hosted as variable WOFF2 files in `public/fonts/`, so nothing loads from Fontshare's CDN at runtime. `src/input.css` declares the `@font-face` rules (upright and italic) and registers them as theme tokens, which gives the `font-supreme` and `font-bevellier` utilities. Supreme is the site-wide default (`--font-sans` points at it) and Bevellier is applied to every `h1` and `h2` by a base-layer rule in that file, so new pages get both without per-element classes.
- **Icons:** IconMind (Iconify, MIT) is used through the Iconify web component, with the name exactly as Iconify's "Copy name" gives it: `<iconify-icon icon="iconmind:a-record-outline-thin"></iconify-icon>`. Names are `{name}-{outline|duotone}-{thin|regular|bold}`. The icons are monochrome (`currentColor`), so colour them with `text-*`. Size them with `text-*` (default is 1em) or `width`/`height` attributes; `size-*`, `w-*` and `h-*` only resize the empty box and leave the glyph at 1em. The `iconify-icon` package is an npm dependency served at `/vendor/iconify-icon.min.js` and loaded in `views/partials/head.ejs`, but icon data is fetched on demand from Iconify's public API in the browser. The pack has 31,722 icons, too many to ship or bundle whole.
- **Animation:** GSAP (npm dependency; free under GSAP's standard license, plugins included) is served from `/vendor/gsap/`, and `views/partials/head.ejs` loads its core, `gsap.min.js`, on every page as the browser global `gsap`. Plugins such as `SplitText` (text) and `ScrollTrigger` (scroll-driven effects) are served from the same folder but not loaded yet. Add e.g. `<script src="/vendor/gsap/SplitText.min.js" defer></script>` after the core script where needed. Loaded that way they worked without `gsap.registerPlugin()`.


---

## Agent Instructions for this Project

**Direct File Manipulation via Internal Tools**

When interacting with this project, you are equipped with internal tools (such as `python` and `terminal`) that have direct access to the project directory: `F:\trifoldi\projects\trifoldi`.

**Guidelines:**

1. **Prefer Tools over Manual Copy-Paste:** Do not ask the user to copy, paste, or run long code blocks in their terminal if you can accomplish the task using your internal tools.
2. **File Management:** Use your tools to:
   - **Create** new files (e.g., using `python` to write content).
   - **Update/Edit** existing files by overwriting them with the full updated content.
   - **Read** files to understand the current project state.
   - **Delete** files or directories when requested.
3. **Path Management:** Always ensure you are targeting the correct directory (`F:\trifoldi\projects\trifoldi`) when executing commands to avoid creating files in the wrong workspace.
4. **Directory Restriction (hard rule):** You may not create, edit, or delete files at any path outside `F:\trifoldi\projects\trifoldi`. This holds even if the harness/tool defaults to a different working directory — redirect every file operation back to this project's directory rather than letting it fall through to the default. If a requested change would require touching a path outside this directory, stop and ask instead of proceeding.

**Goal:** Minimize friction for the user by performing file-system operations directly through your interface rather than requesting manual input.

5. **Screenshot Restriction (hard rule):** For the following projects — ozsdiaries, storiesbyshews, jarumiristudios, wapdooz, whimish, allthingsaprons — you are not allowed, under any circumstances, to take screenshots of the UI while working. If a screenshot seems necessary to verify or debug something, stop and explicitly request permission from the user before taking it.

6. **Journal Entries (hard rule):** When adding a new entry to this project's journal (`dev_resources/journal.md`, via the Dispatch dashboard's Journal tab), each individual entry must not exceed 150 characters. Write one entry per feature or change, not one per part of it: a feature with its settings, prompts and tests is a single entry. If it doesn't fit in 150 characters, describe it at a higher level instead of splitting it up; the details belong in the commit message. Only log what will be useful to someone reading the journal later: what changed, why, and any decision or gotcha that isn't obvious from the code. Leave out word lists, examples, test counts, lists of files (the file report covers those) and steps that were undone or redone in the same session. Before adding an entry, read today's entries and skip anything one of them already covers.

7. **Push Commit Message (hard rule):** Every time you add an entry to this project's journal, also create or update `dev_resources/commit_message.txt` before ending the turn. The Dispatch dashboard's Push button commits with this file's text, so it must cover everything done since the last push, not just your latest change. If the file doesn't exist, create it. If it does, keep what's already in it and add the new work. Write it as a git commit message: a summary line of 72 characters or fewer that covers all of the work in the file, then a blank line, then one `- ` bullet per change saying what changed and why in plain words. Rewrite the summary line whenever it no longer covers everything. Never stage, commit or push this file yourself: the dashboard leaves it out of every commit and deletes it once a push has used it, so the next journal entry starts a fresh one.

8. **Journal File Reports (hard rule):** Every journal entry you add must also report the files its work created, modified or deleted, as paths relative to this project's folder with forward slashes. The Dispatch dashboard lists each day's files under that day's entries, so this is what keeps a day's changes traceable. With the dashboard running, send them with the entry: `POST http://localhost:3000/api/project-folders/trifoldi/journal` with JSON `{ "content": "...", "files": { "created": ["..."], "modified": ["..."], "deleted": ["..."] } }`, leaving out any list that would be empty. When the `CLAUDE_CODE_SESSION_ID` environment variable is set, also send it as the `X-Agent-Session` header, so the entry's record keeps which Claude Code session wrote it. When writing the journal by hand, put them under the entry as sub-bullets indented two spaces, one line per kind: ``- Created: `path/one.js`, `path/two.js` ``, then ``- Modified: ...`` and ``- Deleted: ...``. List each file under the entry for the change that touched it. The 150-character limit is for the entry's text, not its file list.
