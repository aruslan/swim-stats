import Foundation

struct TopShelfItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let imageName: String // "star.fill", "stopwatch", etc.
}

class SwimAnalysis {
    static func generateHighlights(from results: [SwimResult]) -> [TopShelfItem] {
        var items: [TopShelfItem] = []
        
        // 1. Sort by Date (Descending)
        // Note: we assume date format MM/dd/YYYY is parsable
        let sorted = results.sorted {
            ($0.dateObject ?? Date.distantPast) > ($1.dateObject ?? Date.distantPast)
        }
        
        // 2. Take Top 5
        let top5 = sorted.prefix(5)
        
        // 3. Map to Items
        for result in top5 {
            items.append(TopShelfItem(
                title: "\(result.event): \(result.time) (\(result.timeStandard))",
                subtitle: "", // Unused in tvOS sectioned layout
                imageName: "figure.pool.swim"
            ))
        }
        
        return items
    }
}
