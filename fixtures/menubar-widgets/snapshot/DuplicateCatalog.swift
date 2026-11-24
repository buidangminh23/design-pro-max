import SwiftUI

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small/light", width: 170, height: 170) {
                StepsCard(title: "Today", done: 0.42, note: "5,800 steps to go")
            },
            SnapshotEntry("small:light", width: 170, height: 170) {
                StepsCard(title: "Today", done: 0.91, note: "Almost there")
            },
        ]
    }
}
