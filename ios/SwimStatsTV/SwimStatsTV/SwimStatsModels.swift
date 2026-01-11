import Foundation

// MARK: - Core Data Models

/// Represents a single swim result from times.json
struct SwimResult: Codable, Identifiable, Hashable {
    var id: String { "\(name)-\(event)-\(date)-\(time)" } // Computed unique ID
    
    let name: String
    let event: String
    let time: String
    let age: String
    let date: String
    let meet: String
    let timeStandard: String
    let lsc: String
    let team: String
    
    // CodingKeys to map JSON snake_case to Swift camelCase
    enum CodingKeys: String, CodingKey {
        case name, event, time, age, date, meet, lsc, team
        case timeStandard = "time_standard"
    }
}

/// Represents the metadata file checks
struct SwimMetadata: Codable {
    let scrapedAt: String
    let totalResults: Int
    let swimmers: [String]
    
    enum CodingKeys: String, CodingKey {
        case scrapedAt = "scraped_at"
        case totalResults = "total_results"
        case swimmers
    }
}

/// Represents a single unofficial swim result from unofficial_times.json
struct UnofficialSwimResult: Codable {
    let name: String
    let event: String
    let time: String
    let date: String
    let meet: String
    let timeStandard: String
    
    enum CodingKeys: String, CodingKey {
        case name, event, time, date, meet
        case timeStandard = "time_standard"
    }
    
    /// Converts to the standard SwimResult
    func toOfficial() -> SwimResult {
        return SwimResult(
            name: self.name,
            event: self.event,
            time: self.time,
            age: "N/A",      // Not present in unofficial
            date: self.date,
            meet: self.meet,
            timeStandard: self.timeStandard,
            lsc: "N/A",      // Not present in unofficial
            team: "Unattached" // Default
        )
    }
}

// MARK: - Extensions & Helpers

extension SwimResult {
    /// Returns the stroke from the event string (e.g., "50 FR SCY" -> "FR")
    var stroke: String {
        let parts = event.components(separatedBy: " ")
        if parts.count >= 2 {
            return parts[1]
        }
        return "??"
    }
    
    /// Returns the distance (e.g., "50 FR SCY" -> 50)
    var distance: Int {
        let parts = event.components(separatedBy: " ")
        if let dist = parts.first, let val = Int(dist) {
            return val
        }
        return 0
    }
    
    /// Parses the time string "1:02.34" or "23.45" into seconds for comparison
    var timeInSeconds: Double {
        let cleanTime = time.replacingOccurrences(of: "r", with: "") // Handle relay leads if any
        let parts = cleanTime.components(separatedBy: ":")
        
        if parts.count == 2 {
            // MM:SS.SS
            let minutes = Double(parts[0]) ?? 0
            let seconds = Double(parts[1]) ?? 0
            return (minutes * 60) + seconds
        } else {
            // SS.SS
            return Double(cleanTime) ?? 0
        }
    }
    
    /// Returns a native Date object
    var dateObject: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd/YYYY"
        return formatter.date(from: date)
    }
}
