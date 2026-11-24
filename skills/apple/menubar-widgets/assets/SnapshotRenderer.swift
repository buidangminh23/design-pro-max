// menubar-widgets SnapshotRenderer.swift (design-pro-max)
// Built by scripts/snapshot-widgets.mjs together with the project's view sources and a catalog:
//   enum SnapshotCatalog { @MainActor static func entries() -> [SnapshotEntry] }
// Arguments: --list | --out <folder> [--from <n>] [--to <n>] [--scale <n>] [--fonts <folder>]
// --list prints the entries' names and file names as one JSON line. Each rendered entry prints one JSON line on
// stdout, written unbuffered so a crash keeps the lines of the entries before it.
// width and height are the family's outer size. contentMargins (16 points by default, the standard widget margin)
// insets the view on every side, as WidgetKit's default content margins do; pass 0 for a view that draws its own
// margins. Locale, time zone and calendar are pinned per entry so the bytes do not follow the machine's settings.
// The container background is not drawn.

import AppKit
import CoreText
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

struct SnapshotEntry {
    let name: String
    let width: CGFloat
    let height: CGFloat
    let colorScheme: ColorScheme
    let contentMargins: CGFloat
    let locale: Locale
    let timeZone: TimeZone
    let calendar: Calendar
    let view: AnyView

    init<Content: View>(
        _ name: String,
        width: CGFloat,
        height: CGFloat,
        colorScheme: ColorScheme = .light,
        contentMargins: CGFloat = 16,
        locale: Locale = Locale(identifier: "en_US"),
        timeZone: TimeZone = .gmt,
        calendar: Calendar = Calendar(identifier: .gregorian),
        @ViewBuilder content: () -> Content
    ) {
        self.name = name
        self.width = width
        self.height = height
        self.colorScheme = colorScheme
        self.contentMargins = contentMargins
        self.locale = locale
        self.timeZone = timeZone
        self.calendar = calendar
        self.view = AnyView(content())
    }
}

struct SnapshotResult: Encodable {
    let name: String
    let width: Double
    let height: Double
    let contentMargins: Double
    let neededWidth: Double
    let neededHeight: Double
    let pixels: [Int]
    let file: String?
    let problem: String?
}

struct SnapshotListing: Encodable {
    let name: String
    let file: String
}

@MainActor
enum SnapshotRendering {
    static let overflowTolerance: CGFloat = 0.5
    static let measureLimit: CGFloat = 4

    static func styled(_ entry: SnapshotEntry) -> some View {
        entry.view
            .padding(entry.contentMargins)
            .environment(\.colorScheme, entry.colorScheme)
            .environment(\.locale, entry.locale)
            .environment(\.timeZone, entry.timeZone)
            .environment(\.calendar, entry.calendar)
    }

    static func neededSize(of entry: SnapshotEntry) -> CGSize {
        let probe = styled(entry).fixedSize(horizontal: false, vertical: true)
        let controller = NSHostingController(rootView: probe)
        return controller.sizeThatFits(in: CGSize(width: entry.width, height: entry.height * measureLimit * 4))
    }

    static func render(_ entry: SnapshotEntry, scale: CGFloat, folder: URL) -> SnapshotResult {
        let needed = neededSize(of: entry)
        let base = { (file: String?, pixels: [Int], problem: String?) in
            SnapshotResult(name: entry.name, width: entry.width, height: entry.height, contentMargins: entry.contentMargins, neededWidth: needed.width, neededHeight: needed.height, pixels: pixels, file: file, problem: problem)
        }
        if !needed.height.isFinite || needed.height > entry.height * measureLimit {
            return base(nil, [], "the content has no bounded height at this width; cap it before rendering")
        }
        if needed.width > entry.width + overflowTolerance {
            return base(nil, [], "the content needs \(Int(needed.width.rounded(.up))) pt of width with \(Int(entry.contentMargins)) pt margins and the widget clips it")
        }
        if needed.height > entry.height + overflowTolerance {
            return base(nil, [], "the content needs \(Int(needed.height.rounded(.up))) pt of height with \(Int(entry.contentMargins)) pt margins and the widget clips it")
        }
        let content = styled(entry).frame(width: entry.width, height: entry.height)
        let renderer = ImageRenderer(content: content)
        renderer.scale = scale
        renderer.proposedSize = ProposedViewSize(width: entry.width, height: entry.height)
        guard let image = renderer.cgImage else {
            return base(nil, [], "ImageRenderer returned no image")
        }
        let url = folder.appendingPathComponent(fileName(for: entry.name))
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            return base(nil, [image.width, image.height], "could not create \(url.lastPathComponent)")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            return base(nil, [image.width, image.height], "could not write \(url.lastPathComponent)")
        }
        return base(url.lastPathComponent, [image.width, image.height], nil)
    }

    static func fileName(for name: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
        let safe = String(name.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
        return "\(safe).png"
    }

    static func registerFonts(in folder: URL) {
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        for file in files where ["ttf", "otf", "ttc"].contains(file.pathExtension.lowercased()) {
            CTFontManagerRegisterFontsForURL(file as CFURL, .process, nil)
        }
    }

    static func emit<Value: Encodable>(_ value: Value) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(value) else { return }
        FileHandle.standardOutput.write(data + Data("\n".utf8))
    }
}

@main
struct SnapshotRendererMain {
    @MainActor
    static func main() {
        let arguments = CommandLine.arguments
        let value = { (flag: String) -> String? in
            guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else { return nil }
            return arguments[index + 1]
        }
        _ = NSApplication.shared
        if let fonts = value("--fonts") {
            SnapshotRendering.registerFonts(in: URL(fileURLWithPath: fonts))
        }
        let entries = SnapshotCatalog.entries()
        if arguments.contains("--list") {
            SnapshotRendering.emit(entries.map { SnapshotListing(name: $0.name, file: SnapshotRendering.fileName(for: $0.name)) })
            return
        }
        guard let out = value("--out") else {
            FileHandle.standardError.write(Data("usage: --list | --out <folder> [--from n] [--to n] [--scale n] [--fonts folder]\n".utf8))
            exit(2)
        }
        let folder = URL(fileURLWithPath: out)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let from = max(0, Int(value("--from") ?? "") ?? 0)
        let to = min(entries.count, Int(value("--to") ?? "") ?? entries.count)
        let scale = CGFloat(Double(value("--scale") ?? "") ?? 2)
        for entry in entries[from..<max(from, to)] {
            SnapshotRendering.emit(SnapshotRendering.render(entry, scale: scale, folder: folder))
        }
    }
}
