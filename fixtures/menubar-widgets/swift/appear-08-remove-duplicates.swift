import AppKit
import Combine

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private var subscriptions = Set<AnyCancellable>()

    init() {
        item.button?.publisher(for: \.effectiveAppearance)
            .map(\.name)
            .removeDuplicates()
            .sink { [weak self] _ in
                self?.item.button?.needsDisplay = true
            }
            .store(in: &subscriptions)
    }
}
