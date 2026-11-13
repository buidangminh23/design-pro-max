# Testing and builds

## Contents

- Order of checks
- The static scan
- Offscreen widget snapshots
- The stale-extension probe
- Test builds beside the installed copy
- Seeing the menu bar and the desktop

## Order of checks

1. `scripts/scan-swift.mjs` on the sources: seconds, no build, runs anywhere.
2. `scripts/snapshot-widgets.mjs` on the widget views: a swiftc build and an offscreen render, macOS only.
3. A debug build of the app under its own bundle identifier, run beside the installed copy [MW-WARN-TESTCOPY].
4. `scripts/probe-extension.mjs` after any install or update of the real app.
5. A look by hand: the menu bar, the popover, the placed widget and Edit Widget, in light and dark.

## The static scan

```
node <part folder>/scripts/scan-swift.mjs [--configurable] <file or folder> [...]
```

It reads `.swift` files (skipping build folders), follows calls from an appearance handler into functions of the same file, and reports [MW-APPEAR-01], [MW-CONFIG-01], [MW-WARN-KIND] and [MW-WARN-PARAMS]. Pass `--configurable` when the person asked for widget options, so a `StaticConfiguration` fails even with no intent declared yet. A handler in another file is beyond it; it says so in its proof boundary.

## Offscreen widget snapshots

The runner compiles `assets/SnapshotRenderer.swift` with the view sources and a catalog, renders each entry with `ImageRenderer`, writes one PNG per entry and compares the bytes with a baseline (IL-16).

The catalog is one Swift file in the project's snapshot folder:

```swift
import SwiftUI

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-light", width: 170, height: 170) { StepsView(entry: .preview) },
            SnapshotEntry("small-dark", width: 170, height: 170, colorScheme: .dark) { StepsView(entry: .preview) },
            SnapshotEntry("medium-light", width: 364, height: 170) { StepsView(entry: .preview) },
        ]
    }
}
```

Use the family sizes of the devices the widget ships on; `../hig/PART.md` lists them. The views must compile on their own with SwiftUI and WidgetKit: pass the view files and the model types they use, and give previews fixed data instead of reading the app group.

```
node <part folder>/scripts/snapshot-widgets.mjs --out build/snapshots --baseline Snapshots/baseline --update Sources/WidgetViews Snapshots/Catalog.swift
node <part folder>/scripts/snapshot-widgets.mjs --out build/snapshots --baseline Snapshots/baseline Sources/WidgetViews Snapshots/Catalog.swift
```

- [MW-SNAP-01] fails an entry whose content needs more height than the entry has, measured at the entry's width; the renderer stops measuring at four times the height, so an unbounded view fails fast instead of exhausting memory. Cap or shorten the content (IL-16).
- [MW-SNAP-02] fails a PNG whose bytes differ from the baseline. Look at both images; when the change is intended, rerun with `--update`. Rendering the same sources twice gave byte-equal PNGs on the Mac this part was built on, so a difference means the pixels changed.
- Links and controls that AppKit draws show a placeholder in offscreen renders (IL-16); this part's own fixture saw the same for `ProgressView`. Draw progress with shapes, and check links on the placed widget.
- Very many renders in one process can abort, so the runner splits the catalog over several processes, 40 entries each by default, `--batch` at most 60 [MW-WARN-BATCH].
- A command-line renderer finds bundled fonts beside its own binary, not in the app (IL-16): pass `--fonts <folder>` to register the app's custom fonts first.
- Keep baselines with the project's tests, outside the app bundle.

## The stale-extension probe

```
node <part folder>/scripts/probe-extension.mjs --app "/Applications/<App>.app"
```

It reads each extension's executable name from its Info.plist, lists the running processes with `ps -axww -o pid=,lstart=,args=` and their executables with `lsof -a -p <pids> -d txt -Fpn`, and fails [MW-STALE-01] for a process that started before the bundle was installed or runs an executable outside it (IL-14). It never stops anything: it prints the fix for the person to run. Inside an agent sandbox the process table is hidden and the probe exits 3. To judge another machine, record both commands there and pass `--ps <file> --lsof <file>`, with `--installed <date and time>` when the bundle's modification time is not the install time.

## Test builds beside the installed copy

A packaged release registers its login item and signals the installed widget process, so testing one disturbs the person's real app (IL-17). Instead [MW-WARN-TESTCOPY]:

- Run a debug build with its own bundle identifier (a `.debug` suffix) and its own data folder or app group.
- Never stop processes by name, replace the installed app or re-register its extension during a test; stop only the processes your test started, by their process identifier.

## Seeing the menu bar and the desktop

A screen capture over SSH sees no windows (IL-17). Capture from inside the logged-in session, one window at a time, by its window number (IL-17):

```
screencapture -x -o -l <window number> menu.png
```

The capture needs Screen Recording permission for the process that runs it, and an agent sandbox may block it; ask the person to run it, or to look, when it does.
