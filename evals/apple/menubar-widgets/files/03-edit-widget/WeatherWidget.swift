import SwiftUI
import WidgetKit

struct City: Identifiable, Hashable {
    let id: String
    let name: String
    let degrees: Int
}

enum CityStore {
    static var all: [City] {
        [City(id: "lisbon", name: "Lisbon", degrees: 21), City(id: "oslo", name: "Oslo", degrees: 4)]
    }
}

struct WeatherEntry: TimelineEntry {
    let date: Date
    let city: City
}

struct WeatherProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, city: CityStore.all[0])
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let entry = WeatherEntry(date: .now, city: CityStore.all[0])
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(1800))))
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherEntry

    var body: some View {
        VStack(alignment: .leading) {
            Text(entry.city.name).font(.headline)
            Text("\(entry.city.degrees)°")
                .font(.largeTitle.bold())
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct WeatherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WeatherWidget", provider: WeatherProvider()) { entry in
            WeatherWidgetView(entry: entry)
        }
        .configurationDisplayName("Weather")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

enum WidgetRefresh {
    static func forecastChanged() {
        WidgetCenter.shared.reloadTimelines(ofKind: "WeatherWidget")
    }
}
