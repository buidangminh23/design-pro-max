import SwiftUI

struct HourlyStrip: View {
    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<6, id: \.self) { hour in
                VStack(spacing: 4) {
                    Text("\(hour + 9):00")
                        .font(.system(size: 11))
                    Text("\(18 + hour)°")
                        .font(.system(size: 15, weight: .semibold))
                }
                .frame(width: 40)
            }
        }
    }
}

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-hourly", width: 170, height: 170) {
                HourlyStrip()
            },
        ]
    }
}
