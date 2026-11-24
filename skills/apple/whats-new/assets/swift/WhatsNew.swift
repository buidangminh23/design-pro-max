// whats-new WhatsNew.swift (design-pro-max). Copy into the app target with WhatsNewVideo.swift; it needs only SwiftUI.
// WhatsNewStore decides once per CFBundleShortVersionString: no stored version is a first install (store it silently,
// show nothing), a different one is an update (show), and markSeen() runs when the sheet is dismissed, not when it
// opens. WhatsNewSheet is one card for one feature and a pager with arrows and dots for several; every page sits in one
// ZStack, so the card keeps one size. Attach .whatsNew(store:features:) to the root view and WhatsNewCommands to the
// scene for the "What's New…" menu item.

import SwiftUI

public struct WhatsNewFeature: Identifiable, Sendable {
    public enum Media: Sendable {
        case image(String)
        case video(URL, poster: String? = nil)
        case none
    }

    public let id: String
    public let badge: String?
    public let title: String
    public let body: String
    public let media: Media
    public let mediaLabel: String?

    public init(id: String? = nil, badge: String? = nil, title: String, body: String, media: Media = .none, mediaLabel: String? = nil) {
        self.id = id ?? title
        self.badge = badge
        self.title = title
        self.body = body
        self.media = media
        self.mediaLabel = mediaLabel
    }
}

public struct WhatsNewLabels: Sendable {
    public var close = "Close"
    public var previous = "Previous feature"
    public var next = "Next feature"
    public var nextButton = "Next"
    public var done = "Got it"
    public var pageOf = "Feature %d of %d"
    public var region = "What's new"
    public var pause = "Pause video"
    public var play = "Play video"
    public var menuItem = "What's New…"

    public init() {}

    public static let vietnamese: WhatsNewLabels = {
        var labels = WhatsNewLabels()
        labels.close = "Đóng"
        labels.previous = "Tính năng trước"
        labels.next = "Tính năng sau"
        labels.nextButton = "Tiếp"
        labels.done = "Hiểu rồi"
        labels.pageOf = "Tính năng %d trên %d"
        labels.region = "Có gì mới"
        labels.pause = "Tạm dừng video"
        labels.play = "Phát video"
        labels.menuItem = "Có gì mới…"
        return labels
    }()

    func page(_ number: Int, of count: Int) -> String {
        String(format: pageOf, number, count)
    }
}

@MainActor
public final class WhatsNewStore: ObservableObject {
    public enum Decision: Equatable, Sendable {
        case firstInstall
        case update
        case seen
    }

    @Published public var isPresented = false
    public let currentVersion: String
    private let key: String
    private let defaults: UserDefaults

    public init(key: String = "whatsNew.lastSeenVersion", defaults: UserDefaults = .standard, currentVersion: String? = nil) {
        self.key = key
        self.defaults = defaults
        self.currentVersion = currentVersion
            ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            ?? "0"
    }

    public var decision: Decision {
        guard let stored = defaults.string(forKey: key), !stored.isEmpty else { return .firstInstall }
        return stored == currentVersion ? .seen : .update
    }

    @discardableResult
    public func presentIfUpdated() -> Bool {
        switch decision {
        case .firstInstall:
            markSeen()
            return false
        case .seen:
            return false
        case .update:
            isPresented = true
            return true
        }
    }

    public func present() {
        isPresented = true
    }

    public func markSeen() {
        defaults.set(currentVersion, forKey: key)
    }
}

public struct WhatsNewSheet: View {
    private let features: [WhatsNewFeature]
    private let labels: WhatsNewLabels
    private let aspectRatio: CGFloat
    private let onDone: () -> Void

    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    public init(features: [WhatsNewFeature], labels: WhatsNewLabels = WhatsNewLabels(), aspectRatio: CGFloat = 16.0 / 9.0, onDone: @escaping () -> Void = {}) {
        self.features = features
        self.labels = labels
        self.aspectRatio = aspectRatio
        self.onDone = onDone
    }

    private var count: Int { features.count }
    private var isPager: Bool { count > 1 }
    private var isLast: Bool { index >= count - 1 }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            mediaStack
            if isPager {
                navigationRow
                    .padding(.top, 16)
            }
            HStack(alignment: .bottom, spacing: 24) {
                textStack
                primaryButton
            }
            .padding(.top, 24)
        }
        .padding(32)
        .overlay(alignment: .topTrailing) { closeButton.padding(12) }
        .frame(maxWidth: 620)
        #if os(macOS)
        .frame(width: 620)
        #endif
        .modifier(ArrowKeyPaging(isEnabled: isPager, step: step))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(features.indices.contains(index) ? features[index].title : labels.region)
    }

    private var mediaStack: some View {
        ZStack {
            ForEach(Array(features.enumerated()), id: \.element.id) { position, feature in
                MediaFrame(media: feature.media, label: feature.mediaLabel, isActive: position == index, labels: labels)
                    .modifier(PageVisibility(position: position, index: index, reduceMotion: reduceMotion))
            }
        }
        .aspectRatio(aspectRatio, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .background(Color.secondary.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var textStack: some View {
        ZStack(alignment: .bottomLeading) {
            ForEach(Array(features.enumerated()), id: \.element.id) { position, feature in
                VStack(alignment: .leading, spacing: 8) {
                    if let badge = feature.badge {
                        Text(badge.uppercased())
                            .font(.system(size: 13, weight: .semibold))
                            .kerning(0.78)
                            .foregroundStyle(Color.accentColor)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.accentColor.opacity(colorScheme == .dark ? 0.24 : 0.12)))
                            .padding(.bottom, 4)
                    }
                    Text(feature.title)
                        .font(.system(size: 24, weight: .bold))
                        .accessibilityAddTraits(.isHeader)
                    Text(feature.body)
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                        .lineLimit(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .modifier(PageVisibility(position: position, index: index, reduceMotion: reduceMotion))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var navigationRow: some View {
        HStack(spacing: 8) {
            RoundIconButton(systemName: "chevron.left", label: labels.previous, isDisabled: index == 0) { step(-1) }
            HStack(spacing: 0) {
                ForEach(0..<count, id: \.self) { position in
                    Button { show(position) } label: {
                        Circle()
                            .fill(position == index ? Color.primary : Color.secondary.opacity(0.7))
                            .frame(width: 8, height: 8)
                            .frame(width: 24, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(labels.region)
            .accessibilityValue(labels.page(index + 1, of: count))
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: step(1)
                case .decrement: step(-1)
                @unknown default: break
                }
            }
            RoundIconButton(systemName: "chevron.right", label: labels.next, isDisabled: isLast) { step(1) }
        }
        .frame(maxWidth: .infinity)
    }

    private var primaryButton: some View {
        Button {
            if isLast { finish() } else { step(1) }
        } label: {
            ZStack {
                Text(labels.done).opacity(isLast ? 1 : 0)
                Text(labels.nextButton).opacity(isLast ? 0 : 1)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(isLast ? labels.done : labels.nextButton)
        }
        .keyboardShortcut(.defaultAction)
        .buttonStyle(PillButtonStyle())
    }

    private var closeButton: some View {
        RoundIconButton(systemName: "xmark", label: labels.close, isDisabled: false) { finish() }
            .keyboardShortcut(.cancelAction)
    }

    private func step(_ delta: Int) {
        show(index + delta)
    }

    private func show(_ target: Int) {
        let clamped = min(max(target, 0), count - 1)
        guard clamped != index else { return }
        if reduceMotion {
            index = clamped
        } else {
            withAnimation(.easeOut(duration: 0.22)) { index = clamped }
        }
    }

    private func finish() {
        onDone()
        dismiss()
    }
}

private struct PageVisibility: ViewModifier {
    let position: Int
    let index: Int
    let reduceMotion: Bool

    func body(content: Content) -> some View {
        let isCurrent = position == index
        let shift: CGFloat = reduceMotion || isCurrent ? 0 : (position < index ? -24 : 24)
        content
            .opacity(isCurrent ? 1 : 0)
            .offset(x: shift)
            .allowsHitTesting(isCurrent)
            .accessibilityHidden(!isCurrent)
    }
}

private struct ArrowKeyPaging: ViewModifier {
    let isEnabled: Bool
    let step: (Int) -> Void

    func body(content: Content) -> some View {
        if #available(macOS 14, iOS 17, *), isEnabled {
            content
                .focusable()
                .focusEffectDisabled()
                .onKeyPress(.leftArrow) {
                    step(-1)
                    return .handled
                }
                .onKeyPress(.rightArrow) {
                    step(1)
                    return .handled
                }
        } else {
            content
        }
    }
}

private struct RoundIconButton: View {
    let systemName: String
    let label: String
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.primary)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Color.secondary.opacity(0.16)))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
                .opacity(isDisabled ? 0.4 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(label)
        .help(label)
    }
}

private struct PillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 22)
            .frame(minWidth: 96, minHeight: 44)
            .background(Capsule().fill(Color.accentColor))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .contentShape(Capsule())
    }
}

private struct MediaFrame: View {
    let media: WhatsNewFeature.Media
    let label: String?
    let isActive: Bool
    let labels: WhatsNewLabels

    var body: some View {
        switch media {
        case .image(let name):
            Color.clear
                .overlay {
                    Image(name)
                        .resizable()
                        .scaledToFill()
                }
                .clipped()
                .modifier(MediaLabel(label: label))
        case .video(let url, let poster):
            WhatsNewVideo(url: url, poster: poster, isActive: isActive, labels: labels)
                .modifier(MediaLabel(label: label))
        case .none:
            Color.clear
                .accessibilityHidden(true)
        }
    }
}

private struct MediaLabel: ViewModifier {
    let label: String?

    func body(content: Content) -> some View {
        if let label {
            content.accessibilityElement(children: .contain).accessibilityLabel(label)
        } else {
            content
        }
    }
}

public extension View {
    func whatsNew(store: WhatsNewStore, features: [WhatsNewFeature], labels: WhatsNewLabels = WhatsNewLabels()) -> some View {
        modifier(WhatsNewPresenter(store: store, features: features, labels: labels))
    }
}

private struct WhatsNewPresenter: ViewModifier {
    @ObservedObject var store: WhatsNewStore
    let features: [WhatsNewFeature]
    let labels: WhatsNewLabels

    func body(content: Content) -> some View {
        content
            .task {
                guard !features.isEmpty else {
                    store.markSeen()
                    return
                }
                try? await Task.sleep(for: .milliseconds(400))
                store.presentIfUpdated()
            }
            .sheet(isPresented: $store.isPresented, onDismiss: store.markSeen) {
                WhatsNewSheet(features: features, labels: labels)
            }
    }
}

public struct WhatsNewCommands: Commands {
    private let store: WhatsNewStore
    private let title: String

    public init(store: WhatsNewStore, title: String = WhatsNewLabels().menuItem) {
        self.store = store
        self.title = title
    }

    public var body: some Commands {
        CommandGroup(after: .appInfo) {
            Button(title) { store.present() }
        }
    }
}
