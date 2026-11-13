import AppKit

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var observation: NSKeyValueObservation?
    private var lastIsDark: Bool?
    private var changes = 0

    init() {
        observation = item.button?.observe(\.effectiveAppearance, options: [.new]) { [weak self] button, _ in
            MainActor.assumeIsolated {
                self?.restyle(button)
            }
        }
    }

    private func restyle(_ button: NSStatusBarButton) {
        let isDark = button.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        if isDark != lastIsDark {
            changes += 1
        }
        lastIsDark = isDark
        button.needsDisplay = true
    }
}
