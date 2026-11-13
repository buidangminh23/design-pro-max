import AppKit

@MainActor
final class MeterItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var observation: NSKeyValueObservation?

    init() {
        observation = item.button?.observe(\.effectiveAppearance, options: [.new]) { [weak self] button, _ in
            MainActor.assumeIsolated {
                self?.restyle(button)
            }
        }
    }

    private func restyle(_ button: NSStatusBarButton) {
        let isDark = button.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        button.contentTintColor = isDark ? .white : .black
        button.needsDisplay = true
    }
}
