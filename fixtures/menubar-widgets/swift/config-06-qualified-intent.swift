import AppIntents
import SwiftUI
import WidgetKit

enum Kinds {
    static let forecast = "com.example.forecast.city"
    static let clock = "com.example.forecast.clock"
}

enum Shared {
    struct PickCity: WidgetConfigurationIntent {
        static let title: LocalizedStringResource = "Pick City"
        @Parameter(title: "City") var city: String?
        init() {}
    }
}

struct CityEntry: TimelineEntry {
    let date: Date
}

struct CityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CityEntry { CityEntry(date: .now) }
    func snapshot(for configuration: Shared.PickCity, in context: Context) async -> CityEntry { CityEntry(date: .now) }
    func timeline(for configuration: Shared.PickCity, in context: Context) async -> Timeline<CityEntry> {
        Timeline(entries: [CityEntry(date: .now)], policy: .atEnd)
    }
}

struct ClockProvider: TimelineProvider {
    func placeholder(in context: Context) -> CityEntry { CityEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (CityEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<CityEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .atEnd))
    }
}

struct CityForecastWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: Kinds.forecast, intent: Shared.PickCity.self, provider: CityProvider()) { entry in
            Text(entry.date, style: .time)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

struct ClockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Kinds.clock, provider: ClockProvider()) { entry in
            Text(entry.date, style: .time)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}
