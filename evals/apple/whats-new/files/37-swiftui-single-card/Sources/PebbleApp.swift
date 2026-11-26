import SwiftUI

@main
struct PebbleApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        NavigationSplitView {
            List(1..<4, id: \.self) { item in
                Text("Board \(item)")
            }
        } detail: {
            Text("Select a board")
        }
        .frame(minWidth: 720, minHeight: 480)
    }
}
