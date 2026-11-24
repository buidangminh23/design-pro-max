import SwiftUI

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-light", width: 170, height: 170) {
                StepsCard(title: "Today", done: 0.42, note: "5,800 steps to go")
            },
            SnapshotEntry("small-dark", width: 170, height: 170, colorScheme: .dark) {
                StepsCard(title: "Today", done: 0.91, note: "Almost there")
            },
            SnapshotEntry("medium-light", width: 364, height: 170) {
                StepsCard(title: "This week", done: 0.42, note: "Three active days so far")
            },
        ]
    }
}
