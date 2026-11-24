import AppKit

@MainActor
final class TimerItems {
    private let tinted = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let layered = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private let displayed = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private var observations: [NSKeyValueObservation] = []

    init() {
        if let button = tinted.button {
            observations.append(button.observe(\.effectiveAppearance, options: [.new]) { button, _ in
                MainActor.assumeIsolated {
                    button.contentTintColor = .labelColor
                }
            })
        }
        if let button = layered.button {
            observations.append(button.observe(\.effectiveAppearance, options: [.new]) { button, _ in
                MainActor.assumeIsolated {
                    button.layer?.contents = NSImage(named: NSImage.statusAvailableName)
                }
            })
        }
        if let button = displayed.button {
            observations.append(button.observe(\.effectiveAppearance, options: [.new]) { button, _ in
                MainActor.assumeIsolated {
                    button.displayIfNeeded()
                }
            })
        }
    }
}
