import Foundation

/// Handles network requests to fetch swim data
class SwimStatsNetwork {
    // Singleton for easy access
    static let shared = SwimStatsNetwork()
    
    // The source of truth
    private let timesURL = URL(string: "https://aruslan.io/swim-stats/times.json")!
    
    private init() {}
    
    /// Fetches the latest swim times from GitHub
    func fetchTimes() async throws -> [SwimResult] {
        let (data, response) = try await URLSession.shared.data(from: timesURL)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode([SwimResult].self, from: data)
    }
    
    /// Helper to filter times for a specific swimmer and find their bests
    func getBestTimes(for swimmerName: String, times: [SwimResult]) -> [SwimResult] {
        let swimmersTimes = times.filter { $0.name.contains(swimmerName) }
        
        // Group by event
        var bests: [String: SwimResult] = [:]
        
        for result in swimmersTimes {
            let key = result.event // e.g. "50 FR SCY"
            
            if let existing = bests[key] {
                if result.timeInSeconds < existing.timeInSeconds {
                    bests[key] = result
                }
            } else {
                bests[key] = result
            }
        }
        
        // Return sorted by event name for now
        return Array(bests.values).sorted { $0.event < $1.event }
    }
}
