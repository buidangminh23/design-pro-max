import SwiftUI

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-light", width: 170, height: 170) {
                QuotaCard(title: "Personal", used: 0.42, note: "Resets in 3 days")
            },
            SnapshotEntry("small-dark", width: 170, height: 170, colorScheme: .dark) {
                QuotaCard(title: "Work", used: 0.91, note: "Resets tomorrow")
            },
            SnapshotEntry("medium-light", width: 364, height: 170) {
                QuotaCard(title: "Personal", used: 0.42, note: "Resets in 3 days")
            },
        ]
    }
}
