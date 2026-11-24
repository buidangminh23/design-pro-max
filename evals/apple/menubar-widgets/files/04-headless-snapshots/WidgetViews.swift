import SwiftUI
import WidgetKit

struct ForecastSnapshot {
    let cityName: String
    let chanceOfRain: Double
    let updatedText: String
    let notes: [String]
}

struct SmallForecastView: View {
    let snapshot: ForecastSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.cityName).font(.headline)
            ProgressView(value: snapshot.chanceOfRain)
            Text(snapshot.updatedText).font(.caption).foregroundStyle(.secondary)
        }
        .padding()
    }
}

struct MediumForecastView: View {
    let snapshot: ForecastSnapshot

    var body: some View {
        HStack(alignment: .top) {
            SmallForecastView(snapshot: snapshot)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(snapshot.notes, id: \.self) { note in
                    Text(note).font(.caption)
                }
                Link("Open forecast", destination: URL(string: "weather://forecast")!)
                    .font(.caption.bold())
            }
        }
        .padding()
    }
}
