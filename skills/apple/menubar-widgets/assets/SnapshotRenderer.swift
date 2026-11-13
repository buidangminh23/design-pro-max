// menubar-widgets SnapshotRenderer.swift (design-pro-max)
// Built by scripts/snapshot-widgets.mjs together with the project's view sources and a catalog:
//   enum SnapshotCatalog { @MainActor static func entries() -> [SnapshotEntry] }
// Arguments: --count | --out <folder> [--from <n>] [--to <n>] [--scale <n>] [--fonts <folder>]
// Each rendered entry prints one JSON line on stdout.

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
    let view: AnyView

    init<Content: View>(_ name: String, width: CGFloat, height: CGFloat, colorScheme: ColorScheme = .light, @ViewBuilder content: () -> Content) {
        self.name = name
        self.width = width
        self.height = height
        self.colorScheme = colorScheme
        self.view = AnyView(content())
    }
}

struct SnapshotResult: Encodable {
    let name: String
    let width: Double
    let height: Double
    let neededHeight: Double
    let pixels: [Int]
    let file: String?
    let problem: String?
}

@MainActor
enum SnapshotRendering {
    static let overflowTolerance: CGFloat = 0.5
    static let measureLimit: CGFloat = 4

    static func neededHeight(of entry: SnapshotEntry) -> CGFloat {
        let probe = entry.view
            .environment(\.colorScheme, entry.colorScheme)
            .frame(width: entry.width)
            .fixedSize(horizontal: false, vertical: true)
        let host = NSHostingView(rootView: probe)
        return host.fittingSize.height
    }

    static func render(_ entry: SnapshotEntry, scale: CGFloat, folder: URL) -> SnapshotResult {
        let needed = neededHeight(of: entry)
        let base = { (file: String?, pixels: [Int], problem: String?) in
            SnapshotResult(name: entry.name, width: entry.width, height: entry.height, neededHeight: needed, pixels: pixels, file: file, problem: problem)
        }
        if !needed.isFinite || needed > entry.height * measureLimit {
            return base(nil, [], "the content has no bounded height at this width; cap it before rendering")
        }
        if needed > entry.height + overflowTolerance {
            return base(nil, [], "the content needs \(Int(needed.rounded(.up))) pt of height and the widget clips it")
        }
        let content = entry.view
            .environment(\.colorScheme, entry.colorScheme)
            .frame(width: entry.width, height: entry.height)
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
        if arguments.contains("--count") {
            print(entries.count)
            return
        }
        guard let out = value("--out") else {
            FileHandle.standardError.write(Data("usage: --count | --out <folder> [--from n] [--to n] [--scale n] [--fonts folder]\n".utf8))
            exit(2)
        }
        let folder = URL(fileURLWithPath: out)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let from = max(0, Int(value("--from") ?? "") ?? 0)
        let to = min(entries.count, Int(value("--to") ?? "") ?? entries.count)
        let scale = CGFloat(Double(value("--scale") ?? "") ?? 2)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        for entry in entries[from..<max(from, to)] {
            let result = SnapshotRendering.render(entry, scale: scale, folder: folder)
            if let data = try? encoder.encode(result), let line = String(data: data, encoding: .utf8) {
                print(line)
            }
        }
    }
}
