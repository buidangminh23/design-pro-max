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
node <part folder>/scripts/scan-swift.mjs [--configurable <kind>[,<kind>...]] <file or folder> [...]
```

It reads `.swift` files (skipping build folders), follows calls from an appearance handler into functions of the same file, and reports [MW-APPEAR-01], [MW-CONFIG-01], [MW-WARN-KIND] and [MW-WARN-PARAMS]. A handler in another file is beyond it; it says so in its proof boundary.

- Appearance: it finds `observe(\.effectiveAppearance)` (also with a root type, `\NSStatusBarButton.effectiveAppearance`) with a trailing closure or a `changeHandler:` function, a `publisher(for:)` chain up to its `sink` closure, its `receiveValue:` function or an `assign(to:on:)`, and `observeValue(forKeyPath:)`. A redraw (display, needs display, image, title, tint, layer contents) passes only after a `guard` comparing a value with a stored property with `!=`, inside an `if` that does, after an `if ... == <stored> { return }`, or behind `removeDuplicates()` in the chain. A comparison after the redraw, or one that guards something else, does not count. A file that observes something and mentions `effectiveAppearance` with no observation the scan can follow gets a warning.
- Options: pass `--configurable <kind>[,<kind>...]` with the widgets the person asked to make configurable, by kind string, constant (`Kinds.city`) or constant name, so their `StaticConfiguration` fails even with no intent declared yet; other widgets in the folder stay static. A kind that matches no configuration in the files is a warning.

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

Use the family sizes of the devices the widget ships on; `../hig/PART.md` lists them. The views must compile on their own with SwiftUI and WidgetKit: pass the view files and the model types they use, and give previews fixed data instead of reading the app group. Leave out the file with the `@main` widget bundle (`assets/WidgetBundle.swift` keeps it alone for this reason); two `@main` types fail the link with a duplicate `_main`.

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

It reads each extension's executable name and bundle identifier from its Info.plist, lists the running processes with `ps -axww -o pid=,lstart=,args=` and their executables with `lsof -a -p <pids> -d txt -Fpn`, and fails [MW-STALE-01] for a process that started before the bundle was installed or runs an executable outside it (IL-14). It never stops anything: it prints the fix for the person to run. Inside an agent sandbox the process table is hidden and the probe exits 3.

- Which processes count: the extension's executable inside a bundle with the installed extension's identifier, or inside a removed or temporary copy of an app with the same name. Another app's extension with the same executable name, and a debug copy under its own identifier, are left out.
- The install time is the later of the change time and the birth time of the extension and its executable. Updaters keep the modification time when they copy or unpack a bundle, so the modification time can predate the install by weeks. A change of metadata alone (permissions, extended attributes) also moves the change time; at worst that marks a fresh process stale and the fix restarts it once.
- Without an lsof mapping (lsof missing or blocked), the executable path comes from the process's arguments; a process with neither is a warning, not a pass.
- To judge another machine, record both commands there, ps in the C locale so the start times are in English: `LC_ALL=C ps -axww -o pid=,lstart=,args= > ps.txt`. Pass `--ps ps.txt --lsof lsof.txt --tz <offset>`, where the offset (`Z` or `+07:00`) is that machine's, since `lstart` has none; a recording with no readable line, or without `--tz`, is a usage error (exit 2). `--installed <YYYY-MM-DDTHH:MM:SS>` overrides the install time; without an offset it is read in the `--tz` zone.

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
