// whats-new WhatsNewVideo.swift (design-pro-max). A muted looping clip for a What's New page, built on AVQueuePlayer
// and AVPlayerLooper. It plays only while its page is current, rewinds when the page leaves, never starts on its own
// under Reduce Motion (the poster and a play button show instead), and gets a pause button when the clip runs longer
// than 5 s. The clip ships inside the app bundle; it carries no audio track.

import AVFoundation
import SwiftUI

@MainActor
final class LoopingPlayer: ObservableObject {
    let player = AVQueuePlayer()
    @Published private(set) var isPlaying = false
    @Published private(set) var isLong = false
    private var looper: AVPlayerLooper?

    init(url: URL) {
        player.isMuted = true
        player.preventsDisplaySleepDuringVideoPlayback = false
        let item = AVPlayerItem(asset: AVURLAsset(url: url))
        looper = AVPlayerLooper(player: player, templateItem: item)
        Task { [weak self] in
            let asset = AVURLAsset(url: url)
            guard let duration = try? await asset.load(.duration) else { return }
            self?.isLong = duration.seconds > 5
        }
    }

    func play() {
        player.play()
        isPlaying = true
    }

    func pause() {
        player.pause()
        isPlaying = false
    }

    func stop() {
        pause()
        player.seek(to: .zero)
    }
}

struct WhatsNewVideo: View {
    let url: URL
    let poster: String?
    let isActive: Bool
    let labels: WhatsNewLabels

    @StateObject private var looping: LoopingPlayer
    @State private var userPaused = false
    @State private var userStarted = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(url: URL, poster: String?, isActive: Bool, labels: WhatsNewLabels) {
        self.url = url
        self.poster = poster
        self.isActive = isActive
        self.labels = labels
        _looping = StateObject(wrappedValue: LoopingPlayer(url: url))
    }

    private var shouldPlay: Bool {
        isActive && !userPaused && (userStarted || !reduceMotion)
    }

    private var showsToggle: Bool {
        looping.isLong || reduceMotion || userPaused || userStarted
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            PlayerLayerView(player: looping.player)
                .accessibilityHidden(true)
            if let poster, !looping.isPlaying {
                Color.clear
                    .overlay { Image(poster).resizable().scaledToFill() }
                    .clipped()
                    .accessibilityHidden(true)
            }
            if showsToggle {
                Button {
                    if looping.isPlaying {
                        userPaused = true
                        userStarted = false
                    } else {
                        userPaused = false
                        userStarted = true
                    }
                    sync()
                } label: {
                    Image(systemName: looping.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Color.black.opacity(0.55)))
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(looping.isPlaying ? labels.pause : labels.play)
                .padding(8)
            }
        }
        .onAppear(perform: sync)
        .onDisappear { looping.stop() }
        .onChange(of: isActive) {
            if !isActive {
                userPaused = false
                userStarted = false
            }
            sync()
        }
        .onChange(of: reduceMotion) { sync() }
    }

    private func sync() {
        if shouldPlay {
            looping.play()
        } else if isActive {
            looping.pause()
        } else {
            looping.stop()
        }
    }
}

#if os(macOS)
import AppKit

struct PlayerLayerView: NSViewRepresentable {
    let player: AVPlayer

    func makeNSView(context: Context) -> PlayerHostView {
        let view = PlayerHostView()
        view.playerLayer.player = player
        return view
    }

    func updateNSView(_ view: PlayerHostView, context: Context) {
        if view.playerLayer.player !== player { view.playerLayer.player = player }
    }
}

final class PlayerHostView: NSView {
    let playerLayer = AVPlayerLayer()

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        playerLayer.videoGravity = .resizeAspectFill
        layer = playerLayer
    }

    required init?(coder: NSCoder) {
        nil
    }
}
#else
import UIKit

struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerHostView {
        let view = PlayerHostView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PlayerHostView, context: Context) {
        if view.playerLayer.player !== player { view.playerLayer.player = player }
    }
}

final class PlayerHostView: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }
}
#endif
