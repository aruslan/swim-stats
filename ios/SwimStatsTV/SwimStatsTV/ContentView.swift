import SwiftUI

struct ContentView: View {
    @State private var swimmers: [String] = ["Anna Abdikeeva", "Valerie Dronova", "Kexin Liu", "Evelyn Mieszkowski"]
    @State private var selectedSwimmer: String?
    
    @State private var navigationPath = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: 40) {
                    Text("Swim Stats")
                        .font(.system(size: 80, weight: .bold, design: .rounded))
                        .padding(.top, 40)
                    
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 400, maximum: 600), spacing: 60)], spacing: 60) {
                        ForEach(swimmers, id: \.self) { swimmer in
                            NavigationLink(value: swimmer) {
                                SwimmerCard(name: swimmer)
                            }
                            .buttonStyle(.card)
                        }
                    }
                }
                .padding(60)
            }
            .background(
                LinearGradient(colors: [Color.blue.opacity(0.3), Color.clear], startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()
            )
            .navigationDestination(for: String.self) { swimmerName in
                SwimmerDetailView(swimmerName: swimmerName)
            }
        }
        .onOpenURL { url in
            handleDeepLink(url)
        }
    }
    
    // Simple Deep Link Handler
    private func handleDeepLink(_ url: URL) {
        print("🔗 Open URL: \(url)")
        // Expected format: swimstats://swimmer/Anna%20Abdikeeva
        if url.host == "swimmer" {
            let swimmerName = url.lastPathComponent.replacingOccurrences(of: "%20", with: " ")
            print("🔗 Navigate to: \(swimmerName)")
            
            // Reset path and push scalar
            navigationPath = NavigationPath()
            // Using a slight delay can ensure the stack reset completes before pushing
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                if swimmers.contains(swimmerName) {
                    navigationPath.append(swimmerName)
                }
            }
        }
    }
}

struct SwimmerCard: View {
    let name: String
    
    var body: some View {
        VStack {
            Image(systemName: "figure.pool.swim")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 150)
                .foregroundColor(.white)
                .padding()
                .background(Circle().fill(Color.blue.gradient))
                .shadow(radius: 10)
            
            Text(name)
                .font(.title3)
                .fontWeight(.bold)
                .padding(.top, 20)
        }
        .frame(maxWidth: .infinity, minHeight: 400)
        .background(Color.white.opacity(0.1))
        .cornerRadius(20)
    }
}



#Preview {
    ContentView()
}
