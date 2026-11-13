// menubar-widgets StaleExtensionCleanup.swift (design-pro-max)
// Call from the host app at launch, after an install or self-update: stops extension processes left over from the
// replaced copy, re-registers the installed extension and reloads every timeline. Needs a host app outside the App
// Sandbox; a sandboxed app cannot list or signal other processes.

import Darwin
import Foundation
import WidgetKit

enum StaleExtensionCleanup {
    static func run(extensionNamed executable: String) {
        guard let plugIns = Bundle.main.builtInPlugInsURL else { return }
        let appex = plugIns.appendingPathComponent("\(executable).appex")
        let binary = appex.appendingPathComponent("Contents/MacOS/\(executable)").resolvingSymlinksInPath()
        let installed = (try? binary.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
        for pid in processIDs() where pid != getpid() {
            guard let path = executablePath(of: pid), (path as NSString).lastPathComponent == executable else { continue }
            let started = startDate(of: pid) ?? .distantFuture
            if path != binary.path || started < installed.addingTimeInterval(-1) {
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

    private static func processIDs() -> [pid_t] {
        let count = proc_listallpids(nil, 0)
        guard count > 0 else { return [] }
        var pids = [pid_t](repeating: 0, count: Int(count) * 2)
        let filled = proc_listallpids(&pids, Int32(pids.count * MemoryLayout<pid_t>.size))
        return Array(pids.prefix(Int(max(filled, 0))))
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
        return Date(timeIntervalSince1970: TimeInterval(info.pbi_start_tvsec))
    }
}
