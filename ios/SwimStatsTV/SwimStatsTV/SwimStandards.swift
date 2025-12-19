import Foundation

// MARK: - Standards Data Model

struct MotivationalStandards: Codable {
    let Girls: [String: AgeGroupStandards]
}

typealias AgeGroupStandards = [String: CourseStandards] // "SCY" or "LCM"
typealias CourseStandards = [String: StrokeStandards]   // "FR", "BK", etc.
typealias StrokeStandards = [String: [String: String]]  // "50" -> {"B": "33.99"}

// MARK: - Regional Standards Data Model
struct RegionalStandards: Codable {
    let Girls: [String: AgeGroupStandards]
}

// Reuse existing typealiases.
// Note: Regional JSON structure "50": { "CUT": "30.09" } matches [String: [String: String]] 
// because {"CUT": "30.09"} is a dictionary [String: String].

class SwimStandards {
    static let shared = SwimStandards()
    
    private var motivationalStandards: MotivationalStandards?
    private var agcStandards: RegionalStandards?
    private var fwStandards: RegionalStandards?
    
    private init() {
        loadStandards()
    }
    
    private func loadStandards() {
        self.motivationalStandards = loadJSON("motivational_24_girls_11-12")
        self.agcStandards = loadJSON("agc_25_girls")
        self.fwStandards = loadJSON("farwestern_25_girls")
    }
    
    private func loadJSON<T: Codable>(_ filename: String) -> T? {
        var fileURL: URL?
        if let url = Bundle.main.url(forResource: filename, withExtension: "json") {
            fileURL = url
        } else {
            for bundle in Bundle.allBundles + Bundle.allFrameworks {
                if let url = bundle.url(forResource: filename, withExtension: "json") {
                    fileURL = url; break
                }
            }
        }
        
        guard let url = fileURL, let data = try? Data(contentsOf: url) else {
            print("❌ Failed to load \(filename).json")
            return nil
        }
        
        return try? JSONDecoder().decode(T.self, from: data)
    }
    
    /// Returns the standard achieved (e.g. "AA") and the next standard to chase
    func analyzeTime(time: Double, event: String, age: String = "11-12") -> (achieved: String, next: String, cut: Double?) {
        guard let data = motivationalStandards?.Girls[age] else { return ("?", "?", nil) }
        
        // Parse event "50 FR SCY"
        let parts = event.components(separatedBy: " ")
        guard parts.count == 3 else { return ("?", "?", nil) }
        let distance = parts[0]
        let stroke = parts[1]
        let course = parts[2]
        
        guard let strokeData = data[course]?[stroke]?[distance] else { return ("?", "?", nil) }
        
        // Check standards in order: AAAA -> B
        let order = ["AAAA", "AAA", "AA", "A", "BB", "B"]
        
        var achieved = "Slower than B"
        var next = "B"
        
        for std in order {
            if let cutStr = strokeData[std] {
                let cutTime = timeStringToSeconds(cutStr)
                if time <= cutTime {
                    achieved = std
                    if let index = order.firstIndex(of: std), index > 0 {
                        next = order[index - 1]
                    } else {
                        next = "MAX"
                    }
                    break
                } else {
                    next = std
                }
            }
        }
        
        let nextCutStr = strokeData[next]
        let nextCutTime = nextCutStr != nil ? timeStringToSeconds(nextCutStr!) : nil
        
        return (achieved, next, nextCutTime)
    }
    
    /// Returns "FW", "AGC", or nil
    func analyzeRegional(time: Double, event: String, age: String = "12") -> String? {
        // Parse event "50 FR SCY"
        let parts = event.components(separatedBy: " ")
        guard parts.count == 3 else { return nil }
        let distance = parts[0]
        let stroke = parts[1]
        let course = parts[2]
        
        // Check Far Westerns (Priority 1) - json has keys "11", "12", "13", "14".
        // Use exact age string passing. If "11-12", maybe default to "12"? 
        // Logic: if age range "11-12", check "12" standard (harder usually? or same).
        // For now, assume age is single digit or handled.
        
        // Helper to check a specific standard set
        func check(_ standards: RegionalStandards?) -> Bool {
            guard let data = standards?.Girls[age] else { return false }
            guard let cutDict = data[course]?[stroke]?[distance] else { return false }
            guard let cutStr = cutDict["CUT"] else { return false }
            return time <= timeStringToSeconds(cutStr)
        }
        
        if check(fwStandards) { return "FW" }
        if check(agcStandards) { return "AGC" }
        
        return nil
    }
    
    private func timeStringToSeconds(_ time: String) -> Double {
        let clean = time.replacingOccurrences(of: "r", with: "")
        let parts = clean.components(separatedBy: ":")
        if parts.count == 2 {
            return (Double(parts[0]) ?? 0) * 60 + (Double(parts[1]) ?? 0)
        }
        return Double(clean) ?? 0
    }
}
