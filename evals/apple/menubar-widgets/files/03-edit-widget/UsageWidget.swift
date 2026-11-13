import SwiftUI
import WidgetKit

struct Account: Identifiable, Hashable {
    let id: String
    let name: String
    let used: Double
}

enum AccountStore {
    static var all: [Account] {
        [Account(id: "personal", name: "Personal", used: 0.42), Account(id: "work", name: "Work", used: 0.91)]
    }
}

struct UsageEntry: TimelineEntry {
    let date: Date
    let account: Account
}

struct UsageProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsageEntry {
        UsageEntry(date: .now, account: AccountStore.all[0])
    }

    func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
        let entry = UsageEntry(date: .now, account: AccountStore.all[0])
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(1800))))
    }
}

struct UsageWidgetView: View {
    let entry: UsageEntry

    var body: some View {
        VStack(alignment: .leading) {
            Text(entry.account.name).font(.headline)
            Text(entry.account.used, format: .percent.precision(.fractionLength(0)))
                .font(.largeTitle.bold())
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct UsageWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "UsageWidget", provider: UsageProvider()) { entry in
            UsageWidgetView(entry: entry)
        }
        .configurationDisplayName("Usage")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

enum WidgetRefresh {
    static func usageChanged() {
        WidgetCenter.shared.reloadTimelines(ofKind: "UsageWidget")
    }
}
