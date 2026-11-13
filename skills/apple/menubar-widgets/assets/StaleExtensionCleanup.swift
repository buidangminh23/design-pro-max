// menubar-widgets StaleExtensionCleanup.swift (design-pro-max)
// Call from the host app at launch, after an install or self-update: stops extension processes left over from the
// replaced copy, re-registers the installed extension and reloads every timeline. Needs a host app outside the App
// Sandbox; a sandboxed app cannot list or signal other processes.
// A process counts as this app's extension only when its argv[0] ends in <App>.app/Contents/PlugIns/<X>.appex/
// Contents/MacOS/<X> with this app's name, and its bundle has this extension's identifier or no longer exists. It is
// stale when it runs another copy, or started before the installed copy was written (the later of its ctime and
// birthtime, since updaters keep the modification time).

import Darwin
import Foundation
import WidgetKit

enum StaleExtensionCleanup {
    static func run(extensionNamed executable: String) {
        guard let plugIns = Bundle.main.builtInPlugInsURL else { return }
        let appex = plugIns.appendingPathComponent("\(executable).appex")
        let binary = appex.appendingPathComponent("Contents/MacOS/\(executable)").resolvingSymlinksInPath()
        guard let identifier = Bundle(url: appex)?.bundleIdentifier else { return }
        let installed = installDate(of: [appex, binary])
        let tail = "/\(Bundle.main.bundleURL.lastPathComponent)/Contents/PlugIns/\(executable).appex/Contents/MacOS/\(executable)"
        for pid in processIDs() where pid != getpid() {
            guard let argument = firstArgument(of: pid), argument.hasPrefix("/"), argument.hasSuffix(tail) else { continue }
            let launched = URL(fileURLWithPath: argument)
            guard belongs(launched, identifier: identifier) else { continue }
            let current = executablePath(of: pid).map { URL(fileURLWithPath: $0).resolvingSymlinksInPath().path == binary.path } ?? false
            let started = startDate(of: pid) ?? .distantFuture
            if !current || started < installed.addingTimeInterval(-1) {
                kill(pid, SIGTERM)
            }
        }
        let register = Process()
        register.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
        register.arguments = ["-a", appex.path]
        try? register.run()
        register.waitUntilExit()
        WidgetCenter.shared.reloadAllTimelines()
    }

    private static func belongs(_ launched: URL, identifier: String) -> Bool {
        let otherAppex = launched.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        guard FileManager.default.fileExists(atPath: otherAppex.appendingPathComponent("Contents/Info.plist").path) else { return true }
        return Bundle(url: otherAppex)?.bundleIdentifier == identifier
    }

    private static func installDate(of urls: [URL]) -> Date {
        let dates = urls.compactMap { url -> Date? in
            var info = stat()
            guard stat(url.path, &info) == 0 else { return nil }
            return [info.st_ctimespec, info.st_birthtimespec].map(date).max()
        }
        return dates.max() ?? .distantPast
    }

    private static func date(_ time: timespec) -> Date {
        Date(timeIntervalSince1970: TimeInterval(time.tv_sec) + TimeInterval(time.tv_nsec) / 1_000_000_000)
    }

    private static func processIDs() -> [pid_t] {
        let count = proc_listallpids(nil, 0)
        guard count > 0 else { return [] }
        var pids = [pid_t](repeating: 0, count: Int(count) * 2)
        let filled = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size))
        return Array(pids.prefix(Int(max(filled, 0))))
    }

    private static func firstArgument(of pid: pid_t) -> String? {
        var mib: [Int32] = [CTL_KERN, KERN_PROCARGS2, pid]
        var size = 0
        guard sysctl(&mib, 3, nil, &size, nil, 0) == 0, size > MemoryLayout<Int32>.size else { return nil }
        var buffer = [UInt8](repeating: 0, count: size)
        guard sysctl(&mib, 3, &buffer, &size, nil, 0) == 0 else { return nil }
        var index = MemoryLayout<Int32>.size
        while index < size, buffer[index] != 0 { index += 1 }
        while index < size, buffer[index] == 0 { index += 1 }
        let start = index
        while index < size, buffer[index] != 0 { index += 1 }
        return index > start ? String(decoding: buffer[start..<index], as: UTF8.self) : nil
    }

    private static func executablePath(of pid: pid_t) -> String? {
        var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
        guard proc_pidpath(pid, &buffer, UInt32(buffer.count)) > 0 else { return nil }
        return String(decoding: buffer.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }, as: UTF8.self)
    }

    private static func startDate(of pid: pid_t) -> Date? {
        var info = proc_bsdinfo()
        let size = Int32(MemoryLayout<proc_bsdinfo>.size)
        guard proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, size) == size else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(info.pbi_start_tvsec) + TimeInterval(info.pbi_start_tvusec) / 1_000_000)
    }
}
