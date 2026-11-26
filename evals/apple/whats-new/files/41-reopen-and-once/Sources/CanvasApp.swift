import SwiftUI

@main
struct CanvasApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Canvas")
                .frame(minWidth: 640, minHeight: 400)
                .modifier(WhatsNewGate())
        }
    }
}
