import SwiftUI

struct StepsCard: View {
    let title: String
    let done: Double
    let note: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
            GoalBar(done: done)
            Text("\(Int((done * 100).rounded())) % of goal")
                .font(.system(size: 22, weight: .bold))
                .monospacedDigit()
            Text(note)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct GoalBar: View {
    let done: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.25))
                Capsule()
                    .fill(done > 0.8 ? Color.green : Color.accentColor)
                    .frame(width: proxy.size.width * min(max(done, 0), 1))
            }
        }
        .frame(height: 6)
    }
}
