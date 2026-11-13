import AppKit

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var observation: NSKeyValueObservation?

    init() {
        observation = item.button?.observe(\NSStatusBarButton.effectiveAppearance, options: [.new]) { button, _ in
            MainActor.assumeIsolated {
                button.needsDisplay = true
            }
        }
    }
}
