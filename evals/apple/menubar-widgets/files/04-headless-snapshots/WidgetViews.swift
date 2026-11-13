import SwiftUI
import WidgetKit

struct UsageSnapshot {
    let accountName: String
    let used: Double
    let resetText: String
    let notes: [String]
}

struct SmallUsageView: View {
    let snapshot: UsageSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.accountName).font(.headline)
            ProgressView(value: snapshot.used)
            Text(snapshot.resetText).font(.caption).foregroundStyle(.secondary)
        }
        .padding()
    }
}

struct MediumUsageView: View {
    let snapshot: UsageSnapshot

    var body: some View {
        HStack(alignment: .top) {
            SmallUsageView(snapshot: snapshot)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(snapshot.notes, id: \.self) { note in
                    Text(note).font(.caption)
                }
                Link("Open details", destination: URL(string: "usage://details")!)
                    .font(.caption.bold())
            }
        }
        .padding()
    }
}
