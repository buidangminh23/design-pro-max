// menubar-widgets StatusItemController.swift (design-pro-max)
// A status item that draws a coloured image and redraws only when the light or dark match changes.
// A monochrome icon needs none of this: set image.isTemplate = true and the menu bar tints it.

import AppKit

@MainActor
final class StatusItemController {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var appearanceObservation: NSKeyValueObservation?
    private var lastIsDark: Bool?
    private var value: Double = 0

    init() {
        guard let button = item.button else { return }
        button.setAccessibilityLabel("Usage")
        appearanceChanged(button)
        appearanceObservation = button.observe(\.effectiveAppearance, options: [.new]) { [weak self] button, _ in
            MainActor.assumeIsolated {
                self?.appearanceChanged(button)
            }
        }
    }

    func update(value newValue: Double) {
        guard newValue != value else { return }
        value = newValue
        if let isDark = lastIsDark {
            draw(isDark: isDark)
        }
    }

    private func appearanceChanged(_ button: NSStatusBarButton) {
        let isDark = Self.isDark(button.effectiveAppearance)
        guard isDark != lastIsDark else { return }
        lastIsDark = isDark
        draw(isDark: isDark)
    }

    private func draw(isDark: Bool) {
        guard let button = item.button else { return }
        let size = NSSize(width: 22, height: 16)
        let fraction = min(max(value, 0), 1)
        let image = NSImage(size: size, flipped: false) { rect in
            let track = NSBezierPath(roundedRect: rect.insetBy(dx: 1, dy: 5), xRadius: 3, yRadius: 3)
            (isDark ? NSColor.white : NSColor.black).withAlphaComponent(0.3).setFill()
            track.fill()
            var filled = rect.insetBy(dx: 1, dy: 5)
            filled.size.width *= fraction
            let bar = NSBezierPath(roundedRect: filled, xRadius: 3, yRadius: 3)
            (fraction > 0.8 ? NSColor.systemOrange : (isDark ? NSColor.white : NSColor.black)).setFill()
            bar.fill()
            return true
        }
        image.isTemplate = false
        button.image = image
    }

    static func isDark(_ appearance: NSAppearance) -> Bool {
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    }
}
