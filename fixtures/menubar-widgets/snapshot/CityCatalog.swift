import SwiftUI

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [SnapshotEntry("city-small", width: 170, height: 170) { CityWidgetView(entry: CityEntry(date: Date(timeIntervalSince1970: 0), name: "Lisbon", degrees: 21)) }]
    }
}
