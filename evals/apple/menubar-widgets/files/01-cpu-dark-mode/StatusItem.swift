import AppKit

@MainActor
final class StatusItem: NSObject {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var progress = 0.0

    override init() {
        super.init()
        item.button?.addObserver(self, forKeyPath: "effectiveAppearance", options: [.new], context: nil)
        refresh()
    }

    func setProgress(_ value: Double) {
        progress = value
        refresh()
    }

    override nonisolated func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {
        MainActor.assumeIsolated {
            refresh()
        }
    }

    private func refresh() {
        guard let button = item.button else { return }
        let dark = button.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        let title = NSAttributedString(string: "\(Int(progress * 100))%", attributes: [
            .foregroundColor: progress > 0.8 ? NSColor.systemOrange : (dark ? NSColor.white : NSColor.black),
            .font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium),
        ])
        button.attributedTitle = title
        button.needsDisplay = true
    }
}
