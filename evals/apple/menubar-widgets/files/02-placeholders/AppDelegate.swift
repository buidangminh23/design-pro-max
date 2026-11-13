import AppKit
import WidgetKit

@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let updater = SelfUpdater()

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem?.button?.image = NSImage(systemSymbolName: "gauge.medium", accessibilityDescription: "Usage")
        updater.checkInBackground()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

final class SelfUpdater {
    func checkInBackground() {
        Task.detached {
            guard let update = await Self.fetchNewerBuild() else { return }
            await Self.replaceRunningApp(with: update)
        }
    }

    static func fetchNewerBuild() async -> URL? { nil }

    static func replaceRunningApp(with archive: URL) async {
        let installed = Bundle.main.bundleURL
        let backup = FileManager.default.temporaryDirectory.appendingPathComponent("previous-\(UUID().uuidString).app")
        try? FileManager.default.moveItem(at: installed, to: backup)
        try? FileManager.default.copyItem(at: archive, to: installed)
        try? FileManager.default.removeItem(at: backup)
        let relaunch = Process()
        relaunch.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        relaunch.arguments = ["-n", installed.path]
        try? relaunch.run()
        await MainActor.run { NSApp.terminate(nil) }
    }
}
