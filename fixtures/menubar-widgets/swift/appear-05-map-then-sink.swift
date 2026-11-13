import AppKit
import Combine

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private var subscriptions = Set<AnyCancellable>()

    init() {
        guard let button = item.button else { return }
        button.publisher(for: \.effectiveAppearance)
            .map { $0.name }
            .sink { [weak self] _ in
                self?.item.button?.needsDisplay = true
            }
            .store(in: &subscriptions)
    }
}
