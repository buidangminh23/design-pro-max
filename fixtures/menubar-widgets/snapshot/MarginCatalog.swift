import SwiftUI

struct TallTimer: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Focus")
                .font(.system(size: 13, weight: .semibold))
            Text("24:59")
                .font(.system(size: 44, weight: .bold))
                .monospacedDigit()
            Text("Two sessions done")
                .font(.system(size: 11))
        }
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
    }
}

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-timer", width: 170, height: 170) {
                TallTimer()
            },
        ]
    }
}
