# Design QA

Source: reference/selected-design.png (user selected direction 1).
Target viewport: 1440 × 1024, source normalized from 1487 × 1058.

## Initial review

result: blocked

- P2: implementation typography was visibly smaller than the source in result rows and the answer body.
- P2: a full-width example banner shifted the workbench down and increased vertical scrolling.
- P2: the first expected AI tool-use answer did not rank first for the selected reference query.
- P2: the textarea resize handle and broad scrollbars added unnecessary visual noise.

Evidence: reference/implementation-before.png and reference/comparison-before.png.

## Corrections

- Increased desktop navigation, result and answer font sizes; tightened row padding.
- Moved the desktop example notice to the sidebar; retained a compact notice on narrow screens.
- Added limited tool-use phrase normalization and regression tests.
- Disabled preview resizing and used thin scrollbars.
- Added explicit accessible input names and limited keyboard trapping to the foremost dialog.

## Final review

result: passed

Compared the selected source and implementation side by side at 1440 × 1024, then inspected the full-size implementation and narrow-screen screenshots. No remaining actionable P0, P1 or P2 visual issues.

- Column widths, panel boundaries, text scale, answer whitespace and blue primary actions match the selected direction.
- Adjusted navigation row height and action sizing after the first comparison.
- Labels, dates and character count reflect live data. The original-question match indicator and ranking reflect the approved local retrieval rules.
- Added template entry, theme management and a small example notice support the approved flow.
- At 820px and 390px the sidebar collapses and results/detail switch correctly. The 390px document has equal client and scroll width (390px), so no horizontal overflow. Long body and template lists remain scrollable, with actions and close control accessible.
- Checked template modal, import/backup validation, unsaved changes and deletion confirmation through the browser.

Evidence: reference/comparison-final.png, reference/implementation-final.png, reference/narrow-list-820.png, reference/narrow-detail-820.png, reference/narrow-detail-390.png, reference/narrow-templates-390.png.

Clipboard paste and browser download-completion limits are documented separately in 验收记录.md; they are not claims of completed manual acceptance.
