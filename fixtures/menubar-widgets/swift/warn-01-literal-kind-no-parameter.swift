import AppIntents
import SwiftUI
import WidgetKit

struct EmptyIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Clock"
    init() {}
}

struct ClockEntry: TimelineEntry {
    let date: Date
}

struct ClockProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ClockEntry { ClockEntry(date: .now) }
    func snapshot(for configuration: EmptyIntent, in context: Context) async -> ClockEntry { ClockEntry(date: .now) }
    func timeline(for configuration: EmptyIntent, in context: Context) async -> Timeline<ClockEntry> {
        Timeline(entries: [ClockEntry(date: .now)], policy: .atEnd)
    }
}

struct ClockWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "ClockWidget", intent: EmptyIntent.self, provider: ClockProvider()) { entry in
            Text(entry.date, style: .time)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}
