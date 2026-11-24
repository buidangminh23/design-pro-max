import SwiftUI

struct ReleaseNotesCard: View {
    let notes: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("What changed")
                .font(.system(size: 13, weight: .semibold))
            ForEach(notes, id: \.self) { note in
                Text(note)
                    .font(.system(size: 11))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

enum SnapshotCatalog {
    @MainActor
    static func entries() -> [SnapshotEntry] {
        [
            SnapshotEntry("small-notes", width: 170, height: 170) {
                ReleaseNotesCard(notes: [
                    "The city picker now lists every place you saved, including the ones that were added on another Mac.",
                    "Forecasts refresh when the widget becomes visible instead of waiting for the next scheduled timeline.",
                    "Dark mode colours follow the system setting and no longer flash when the desktop picture changes.",
                ])
            },
        ]
    }
}
