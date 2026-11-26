import SwiftUI

@main
struct LedgerApp: App {
    var body: some Scene {
        WindowGroup {
            BooksView()
        }
    }
}

struct BooksView: View {
    var body: some View {
        NavigationStack {
            List(["Household", "Studio", "Travel"], id: \.self) { book in
                Text(book)
            }
            .navigationTitle("Books")
        }
    }
}
