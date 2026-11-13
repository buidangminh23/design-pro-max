import AppKit

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var observation: NSKeyValueObservation?
    private var lastIsDark: Bool?

    init() {
        observation = item.button?.observe(\.effectiveAppearance, options: [.new]) { [weak self] button, _ in
            MainActor.assumeIsolated {
                self?.restyle(button)
            }
        }
    }

    private func restyle(_ button: NSStatusBarButton) {
        button.needsDisplay = true
        let isDark = button.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        guard isDark != lastIsDark else { return }
        lastIsDark = isDark
    }
}
