import SwiftUI

struct BrokenCard: View {
    let samples: [Int]

    var body: some View {
        Text("\(samples[3]) steps")
    }
}

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-first", width: 170, height: 170) {
                Text("First")
            },
            SnapshotEntry("small-broken", width: 170, height: 170) {
                BrokenCard(samples: [1, 2])
            },
            SnapshotEntry("small-third", width: 170, height: 170) {
                Text("Third")
            },
        ]
    }
}
