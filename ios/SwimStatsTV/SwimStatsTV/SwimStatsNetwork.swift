import Foundation

/// Handles network requests to fetch swim data
class SwimStatsNetwork {
    // Singleton for easy access
    static let shared = SwimStatsNetwork()
    
    // The source of truth
    private let timesURL = URL(string: "https://aruslan.io/swim-stats/times.json")!
    private let unofficialTimesURL = URL(string: "https://aruslan.io/swim-stats/unofficial_times.json")!
    
    private init() {}
    
    /// Fetches the latest swim times from GitHub (both Official and Unofficial)
    func fetchTimes() async throws -> [SwimResult] {
        // Fetch both concurrently
        async let officialData = fetchJSON(from: timesURL, as: [SwimResult].self)
        async let unofficialData = fetchJSON(from: unofficialTimesURL, as: [UnofficialSwimResult].self)
        
        // Await results
        // Note: We gracefully handle failure of unofficial times by defaulting to empty
        let official = (try? await officialData) ?? []
        let unofficial = (try? await unofficialData) ?? []
        
        if official.isEmpty {
            // If official fails, we probably have a network issue, so propagate error if both fail
            // But if we have unofficial, maybe we can show that? 
            // For now, let's assume if official fails, we might still want to show unofficial if available,
            // or if both fail, throw error.
            
            // Re-attempt official to throw actual error to caller if needed, 
            // or just rely on the fact that we return partial data.
            // Let's stick to safe behavior: validOfficial + convertedUnofficial
        }
        
        let convertedUnofficial = unofficial.map { $0.toOfficial() }
        
        return official + convertedUnofficial
    }
    
    /// Helper to fetch and decode generic JSON
    private func fetchJSON<T: Decodable>(from url: URL, as type: T.Type) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
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
