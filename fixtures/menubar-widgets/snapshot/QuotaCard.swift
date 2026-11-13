import SwiftUI

struct QuotaCard: View {
    let title: String
    let used: Double
    let note: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
            UsageBar(used: used)
            Text("\(Int((used * 100).rounded())) % used")
                .font(.system(size: 22, weight: .bold))
                .monospacedDigit()
            Text(note)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct UsageBar: View {
    let used: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.25))
                Capsule()
                    .fill(used > 0.8 ? Color.orange : Color.accentColor)
                    .frame(width: proxy.size.width * min(max(used, 0), 1))
            }
        }
        .frame(height: 6)
    }
}
