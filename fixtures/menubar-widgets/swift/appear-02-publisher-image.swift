import AppKit
import Combine

@MainActor
final class BatteryItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private var subscriptions = Set<AnyCancellable>()

    init() {
        guard let button = item.button else { return }
        button.publisher(for: \.effectiveAppearance)
            .sink { [weak self] appearance in
                self?.item.button?.image = BatteryItem.icon(for: appearance)
            }
            .store(in: &subscriptions)
    }

    static func icon(for appearance: NSAppearance) -> NSImage {
        let dark = appearance.name == .darkAqua
        return NSImage(size: NSSize(width: 18, height: 18), flipped: false) { rect in
            (dark ? NSColor.white : NSColor.black).setFill()
            NSBezierPath(ovalIn: rect.insetBy(dx: 3, dy: 3)).fill()
            return true
        }
    }
}
