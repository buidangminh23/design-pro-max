import AppKit
import Combine

@MainActor
final class TimerItem {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    private var subscriptions = Set<AnyCancellable>()
    private var seconds = 0

    init() {
        item.button?.publisher(for: \.effectiveAppearance)
            .sink(receiveValue: apply)
            .store(in: &subscriptions)
    }

    func tick() {
        seconds += 1
    }

    private func apply(_ appearance: NSAppearance) {
        let dark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        item.button?.image = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { rect in
            (dark ? NSColor.white : NSColor.black).setFill()
            NSBezierPath(ovalIn: rect.insetBy(dx: 3, dy: 3)).fill()
            return true
        }
    }
}
