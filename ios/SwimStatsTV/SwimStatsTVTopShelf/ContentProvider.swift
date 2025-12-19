import TVServices
import OSLog
import UIKit

class ContentProvider: TVTopShelfContentProvider {

    override func loadTopShelfContent(completionHandler: @escaping (TVTopShelfContent?) -> Void) {
        let logger = Logger(subsystem: "me.aruslan.SwimStatsTV", category: "TopShelf")
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
        // Generate a unique SHORT trace ID for onscreen debugging (e.g., "DEBUG-A01")
        let traceID = "DBG-" + String(UUID().uuidString.prefix(4)).uppercased()
        
        logger.error("🚀 Top Shelf Extension: loadTopShelfContent called! App Version: \(version) (\(build)) [TRACE: \(traceID)]")
        
        Task {
            do {
                logger.error("🚀 Top Shelf Extension: Starting Network Fetch...")
                // 1. Fetch Data
                let results = try await SwimStatsNetwork.shared.fetchTimes()
                logger.error("🚀 Top Shelf Extension: Network Fetch Success! Count: \(results.count)")
                
                // 2. Process Data: Calculate Standard & Sort
                // Filter for "Anna" specifically (Partial match for "Anna Abdikeeva")
                let annaResults = results.filter { $0.name.hasPrefix("Anna") }
                
                let validResults = annaResults.compactMap { result -> (SwimResult, String)? in
                    // Calculate true standard locally
                    let (achieved, _, _) = SwimStandards.shared.analyzeTime(
                        time: result.timeInSeconds,
                        event: result.event,
                        // Force age 11-12 for Anna for now (or use result.age if reliable)
                        age: "11-12" 
                    )
                    
                    // Filter out uninteresting times
                    if achieved == "Slower than B" {
                        return nil
                    }
                    if achieved == "?" {
                        // Fallback to existing if we couldn't parse
                        if result.timeStandard == "Slower than B" { return nil }
                        return (result, result.timeStandard)
                    }
                    
                    return (result, achieved)
                }
                
                // Sort by Date
                let sorted = validResults.sorted {
                    ($0.0.dateObject ?? Date.distantPast) > ($1.0.dateObject ?? Date.distantPast)
                }
                
                let top5 = sorted.prefix(5)
                
                // 3. Create TV Items
                var items: [TVTopShelfSectionedItem] = []
                
                for (result, standard) in top5 {
                    autoreleasepool {
                        // Standard Title
                        // SANITIZE: Remove / and : from ID so it doesn't create invalid file paths
                        let safeID = result.id.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
                        let uniqueID = "\(safeID)-\(UUID().uuidString)"
                        let sectionedItem = TVTopShelfSectionedItem(identifier: uniqueID)
                        sectionedItem.title = result.event
                        sectionedItem.imageShape = .poster
                        
                        // Render Image
                        // Render Image (Writes to Defaults and Local Caches)
                        let imageFilename = "card-\(uniqueID).jpg"
                        
                        // Calculate Regional Standard (Real Logic)
                        // Use default age "12" because our JSONs are Girls 11, 12, 13, 14
                        // And we forced "11-12" for motivational (which works for 11 or 12 key potentially? No, motivational keys are usually "11-12" strings).
                        // Wait, motivational keys are ranges "11-12". Regional keys are single years "12".
                        // So we pass "12" to analyzeRegional.
                        let qualifier = SwimStandards.shared.analyzeRegional(time: result.timeInSeconds, event: result.event, age: "12")
                        
                        let imageURL = SwimCardRendererV7.renderImage(for: result, overrideStandard: standard, qualifier: qualifier, traceID: traceID, filename: imageFilename)
                        
                        // LOGIC: PineBoard needs a file it can read.
                        // renderImage creates a file in Local Caches.
                        // We pass that URL to PineBoard.
                        if let url = imageURL {
                            sectionedItem.setImageURL(url, for: .screenScale1x)
                            sectionedItem.setImageURL(url, for: .screenScale2x)
                        } else {
                            sectionedItem.title = "No Image: \(result.event)"
                        }
                        
                        // Add Deep Link Action
                        // This URL will launch the main app and be caught by onOpenURL
                        if let url = URL(string: "swimstats://swimmer/Anna%20Abdikeeva") {
                            sectionedItem.displayAction = TVTopShelfAction(url: url)
                        }
                        
                        items.append(sectionedItem)
                    }
                }
                
                // 4. Create Section
                let section = TVTopShelfItemCollection(items: items)
                section.title = "Anna's Latest Achievements"
                
                // 5. Return Content
                let content = TVTopShelfSectionedContent(sections: [section])
                completionHandler(content)
                
            } catch {
                print("Error loading Top Shelf content: \(error)")
                // Return empty content or a generic error banner if possible
                completionHandler(nil)
            }
        }
    }
}
