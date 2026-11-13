// menubar-widgets WidgetBundle.swift (design-pro-max)
// The widget extension's entry point. Keep it alone in this file: views and providers live in other files, so they
// can also be compiled with SnapshotRenderer.swift, which has its own @main.

import SwiftUI
import WidgetKit

@main
struct WeatherWidgets: WidgetBundle {
    var body: some Widget {
        CityWidget()
    }
}
