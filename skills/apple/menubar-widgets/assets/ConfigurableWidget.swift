// menubar-widgets ConfigurableWidget.swift (design-pro-max)
// A widget whose options appear in Edit Widget: AppIntentConfiguration, a WidgetConfigurationIntent and an AppEntity
// parameter with its query. The kind string lives in one constant that reloadTimelines(ofKind:) also uses.

import AppIntents
import SwiftUI
import WidgetKit

enum WidgetKinds {
    static let account = "com.example.usage.account"
}

struct AccountEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Account"
    static let defaultQuery = AccountQuery()

    let id: String
    let name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct AccountQuery: EntityQuery {
    func entities(for identifiers: [AccountEntity.ID]) async throws -> [AccountEntity] {
        AccountStore.accounts.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AccountEntity] {
        AccountStore.accounts
    }

    func defaultResult() async -> AccountEntity? {
        AccountStore.accounts.first
    }
}

enum AccountStore {
    static let accounts = [
        AccountEntity(id: "personal", name: "Personal"),
        AccountEntity(id: "work", name: "Work"),
    ]

    static func usage(for id: String) -> Double {
        id == "work" ? 0.91 : 0.42
    }
}

struct SelectAccountIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Select Account"
    static let description = IntentDescription("Choose the account this widget shows.")

    @Parameter(title: "Account")
    var account: AccountEntity?

    init() {}
}

struct AccountEntry: TimelineEntry {
    let date: Date
    let name: String
    let used: Double
}

struct AccountProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> AccountEntry {
        AccountEntry(date: .now, name: "Account", used: 0.5)
    }

    func snapshot(for configuration: SelectAccountIntent, in context: Context) async -> AccountEntry {
        entry(for: configuration)
    }

    func timeline(for configuration: SelectAccountIntent, in context: Context) async -> Timeline<AccountEntry> {
        Timeline(entries: [entry(for: configuration)], policy: .after(.now.addingTimeInterval(30 * 60)))
    }

    private func entry(for configuration: SelectAccountIntent) -> AccountEntry {
        let account = configuration.account ?? AccountStore.accounts[0]
        return AccountEntry(date: .now, name: account.name, used: AccountStore.usage(for: account.id))
    }
}

struct AccountWidgetView: View {
    let entry: AccountEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.name)
                .font(.headline)
                .lineLimit(1)
            Text(entry.used, format: .percent.precision(.fractionLength(0)))
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

struct AccountWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetKinds.account, intent: SelectAccountIntent.self, provider: AccountProvider()) { entry in
            AccountWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Account Usage")
        .description("Shows how much of an account's quota is used.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct UsageWidgets: WidgetBundle {
    var body: some Widget {
        AccountWidget()
    }
}

enum WidgetRefresh {
    static func accountChanged() {
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetKinds.account)
    }
}
