// menubar-widgets ConfigurableWidget.swift (design-pro-max)
// A widget whose options appear in Edit Widget: AppIntentConfiguration, a WidgetConfigurationIntent and an AppEntity
// parameter with its query. The kind string lives in one constant that reloadTimelines(ofKind:) also uses.

import AppIntents
import SwiftUI
import WidgetKit

enum WidgetKinds {
    static let city = "com.example.weather.city"
}

struct CityEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "City"
    static let defaultQuery = CityQuery()

    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct CityQuery: EntityQuery {
    func entities(for identifiers: [CityEntity.ID]) async throws -> [CityEntity] {
        CityStore.cities.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CityEntity] {
        CityStore.cities
    }

    func defaultResult() async -> CityEntity? {
        CityStore.cities.first
    }
}

enum CityStore {
    static let cities = [
        CityEntity(id: "lisbon", name: "Lisbon"),
        CityEntity(id: "oslo", name: "Oslo"),
    ]

    static func degrees(for id: String) -> Int {
        id == "oslo" ? 4 : 21
    }
}

struct SelectCityIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Select City"
    static let description = IntentDescription("Choose the city this widget shows.")

    @Parameter(title: "City")
    var city: CityEntity?

    init() {}
}

struct CityEntry: TimelineEntry {
    let date: Date
    let name: String
    let degrees: Int
}

struct CityProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CityEntry {
        CityEntry(date: .now, name: "City", degrees: 20)
    }

    func snapshot(for configuration: SelectCityIntent, in context: Context) async -> CityEntry {
        entry(for: configuration)
    }

    func timeline(for configuration: SelectCityIntent, in context: Context) async -> Timeline<CityEntry> {
        Timeline(entries: [entry(for: configuration)], policy: .after(.now.addingTimeInterval(30 * 60)))
    }

    private func entry(for configuration: SelectCityIntent) -> CityEntry {
        let city = configuration.city ?? CityStore.cities[0]
        return CityEntry(date: .now, name: city.name, degrees: CityStore.degrees(for: city.id))
    }
}

struct CityWidgetView: View {
    let entry: CityEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.name)
                .font(.headline)
                .lineLimit(1)
            Text("\(entry.degrees)°")
                .font(.system(.title, design: .rounded, weight: .bold))
                .monospacedDigit()
                .contentTransition(.numericText())
            Spacer(minLength: 0)
            Text(entry.date, style: .time)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct CityWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetKinds.city, intent: SelectCityIntent.self, provider: CityProvider()) { entry in
            CityWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("City Weather")
        .description("Shows the temperature in a city you choose.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct WeatherWidgets: WidgetBundle {
    var body: some Widget {
        CityWidget()
    }
}

enum WidgetRefresh {
    static func forecastChanged() {
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKinds.city)
    }
}
