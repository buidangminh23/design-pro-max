import AppKit

enum Scheme: Equatable {
    case light
    case dark

    init(_ appearance: NSAppearance) {
        self = appearance.name.rawValue.contains("Dark") ? .dark : .light
    }
}

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var observation: NSKeyValueObservation?
    private var lastScheme: Scheme?

    init() {
        observation = item.button?.observe(\.effectiveAppearance, options: [.new]) { [weak self] button, _ in
            MainActor.assumeIsolated {
                self?.restyle(button)
            }
        }
    }

    private func restyle(_ button: NSStatusBarButton) {
        let scheme = Scheme(button.effectiveAppearance)
        guard scheme != self.lastScheme else { return }
        lastScheme = scheme
        button.needsDisplay = true
    }
}
