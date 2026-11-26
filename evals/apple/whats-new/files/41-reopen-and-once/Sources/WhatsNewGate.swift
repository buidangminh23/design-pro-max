import SwiftUI

struct WhatsNewGate: ViewModifier {
    @AppStorage("lastVersion") private var lastVersion = ""
    @State private var showing = false

    private var current: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
    }

    func body(content: Content) -> some View {
        content
            .onAppear {
                if lastVersion != current {
                    showing = true
                    lastVersion = current
                }
            }
            .sheet(isPresented: $showing) {
                WhatsNewView()
            }
    }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("New in Canvas").font(.title)
            Text("Layers can now be grouped and locked.")
            Button("OK") { dismiss() }
        }
        .padding(32)
    }
}
