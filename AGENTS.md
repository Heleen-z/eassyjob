# Prototype Instructions

## Confirmed product direction

- Use the first selected visual reference: reference/selected-design.png. Preserve its light three-column topic / results / full-answer workbench and blue primary actions.
- This is a local browser application, fixed at http://127.0.0.1:4173, using IndexedDB. Do not add cloud synchronization, model calls, or automatic application submission.
- Content includes generic information and job-specific answers. Edit updates the current record; save-as-new preserves it and records its source.
- Provide Chinese editable templates with public career-guidance references and a preview-before-save bulk text workflow. Real applicant data must remain outside source/test fixtures.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
