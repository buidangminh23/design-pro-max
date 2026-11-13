import SwiftUI
import WidgetKit

enum Kinds {
    static let weather = "com.example.weather.current"
}

struct WeatherEntry: TimelineEntry {
    let date: Date
    let degrees: Int
}

struct WeatherProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry { WeatherEntry(date: .now, degrees: 21) }
    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .atEnd))
    }
}

struct WeatherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Kinds.weather, provider: WeatherProvider()) { entry in
            Text("\(entry.degrees)°")
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Weather")
    }
}
