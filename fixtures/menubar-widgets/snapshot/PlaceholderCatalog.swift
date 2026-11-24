import SwiftUI

struct RainCard: View {
    let chance: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Chance of rain")
                .font(.system(size: 13, weight: .semibold))
            ProgressView(value: chance)
            Link("Open forecast", destination: URL(string: "https://example.com/forecast")!)
                .font(.system(size: 11))
        }
    }
}

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-rain", width: 170, height: 170) {
                RainCard(chance: 0.6)
            },
        ]
    }
}
