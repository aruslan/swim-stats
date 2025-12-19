import SwiftUI

struct SwimmerDetailView: View {
    let swimmerName: String
    @State private var times: [SwimResult] = []
    @State private var isLoading = true
    
    let columns = [
        GridItem(.adaptive(minimum: 300, maximum: 500), spacing: 40)
    ]
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 40) {
                // Header
                HStack {
                    Image(systemName: "figure.pool.swim")
                        .font(.system(size: 60))
                        .foregroundStyle(.blue)
                    
                    Text(swimmerName)
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                }
                .padding(.bottom, 40)
                
                if isLoading {
                    ProgressView()
                } else if times.isEmpty {
                    Text("No times found.")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Top Times")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    
                    LazyVGrid(columns: columns, spacing: 40) {
                        ForEach(times) { time in
                            TimeCard(result: time)
                        }
                    }
                }
            }
            .padding(60)
        }
        .networkBackground()
        .task {
            await loadData()
        }
    }
    
    func loadData() async {
        do {
            let allTimes = try await SwimStatsNetwork.shared.fetchTimes()
            // Filter and sort by bests
            let bests = SwimStatsNetwork.shared.getBestTimes(for: swimmerName, times: allTimes)
            self.times = bests
            self.isLoading = false
        } catch {
            print("Error: \(error)")
            self.isLoading = false
        }
    }
}

struct TimeCard: View {
    let result: SwimResult
    
    var tintColor: Color {
        switch result.timeStandard {
        case "AAAA": return .purple
        case "AAA": return .indigo
        case "AA": return .blue
        case "A": return .cyan
        case "BB": return .green
        case "B": return .yellow
        default: return .gray
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(result.event)
                    .font(.headline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(result.timeStandard)
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(6)
                    .background(tintColor.opacity(0.2))
                    .foregroundStyle(tintColor)
                    .cornerRadius(8)
            }
            
            Text(result.time)
                .font(.system(size: 44, weight: .black, design: .monospaced))
                .foregroundColor(.primary)
            
            Text(result.date)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .background(Color.white.opacity(0.1))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(tintColor.opacity(0.5), lineWidth: 2)
        )
    }
}

extension View {
    func networkBackground() -> some View {
        self.background(
            LinearGradient(colors: [Color.indigo.opacity(0.2), Color.black], startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
        )
    }
}
