import SwiftUI
import WidgetKit

enum ForecastKinds {
    static let daily = "com.example.forecast.daily"
}

struct ForecastEntry: TimelineEntry {
    let date: Date
    let degrees: Int
}

struct ForecastProvider: TimelineProvider {
    func placeholder(in context: Context) -> ForecastEntry { ForecastEntry(date: .now, degrees: 18) }
    func getSnapshot(in context: Context, completion: @escaping (ForecastEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ForecastEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .atEnd))
    }
}

struct DailyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ForecastKinds.daily, provider: ForecastProvider()) { entry in
            Text("\(entry.degrees)°")
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}

struct MoonWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.example.forecast.moon", provider: ForecastProvider()) { entry in
            Text(entry.date, style: .date)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}
