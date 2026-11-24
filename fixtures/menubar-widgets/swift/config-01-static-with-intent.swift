import AppIntents
import SwiftUI
import WidgetKit

struct ProjectEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Project"
    static let defaultQuery = ProjectQuery()
    let id: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(id)") }
}

struct ProjectQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [ProjectEntity] { identifiers.map(ProjectEntity.init(id:)) }
    func suggestedEntities() async throws -> [ProjectEntity] { [ProjectEntity(id: "Inbox")] }
}

struct ChooseProjectIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Choose Project"
    @Parameter(title: "Project") var project: ProjectEntity?
    init() {}
}

struct TasksEntry: TimelineEntry {
    let date: Date
    let open: Int
}

struct TasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry { TasksEntry(date: .now, open: 3) }
    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) { completion(placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .atEnd))
    }
}

struct TasksWidget: Widget {
    let kind = "TasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksProvider()) { entry in
            Text("\(entry.open) open")
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Tasks")
    }
}
