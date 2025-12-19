import UIKit
import OSLog

class SwimCardRendererV7 {
    
    // Cache the heavy texture to avoid reloading it 5 times
    private static var cachedBackground: UIImage?
    
    // Create a logger for the renderer
    private static let logger = Logger(subsystem: "me.aruslan.SwimStatsTV", category: "Renderer")

    static func renderImage(for result: SwimResult, overrideStandard: String, qualifier: String?, traceID: String, filename: String) -> URL? {
        let appGroupIdentifier = "group.me.aruslan.SwimStatsTV.v4"
        // FORCE LOG: Use .error so it appears in filtered consoles
        logger.error("🎨 SwimCardRendererV7 START: \(result.event, privacy: .public) [Group: \(appGroupIdentifier)] [Trace: \(traceID)]")
        
        // Standard Apple TV Poster ratio is often 2:3 or similar. 
        // We will use a high-res portrait resolution.
        let size = CGSize(width: 400, height: 600)
        
        let renderer = UIGraphicsImageRenderer(size: size)
        
        let image = renderer.image { ctx in
            // 1. Draw Background (Pool Texture)
            var textureImage = cachedBackground
            
            if textureImage == nil {
                // Load it once
                // Try standard named image load (looks in Main bundle by default)
                if let img = UIImage(named: "pool_texture") {
                    textureImage = img
                } 
                // Try looking in the specific class bundle (for Extensions)
                else if let img = UIImage(named: "pool_texture", in: Bundle(for: SwimCardRendererV7.self), compatibleWith: nil) {
                    textureImage = img
                }
                // Fallback: Try the file on disk explicitly
                else if let path = Bundle(for: SwimCardRendererV7.self).path(forResource: "pool_texture", ofType: "png"),
                        let img = UIImage(contentsOfFile: path) {
                    textureImage = img
                }
                
                cachedBackground = textureImage
            }
            
            if let texture = textureImage {
                texture.draw(in: CGRect(origin: .zero, size: size))
                
                // Darken the water texture (make it deeper/less bright)
                // Use .multiply to preserve texture details while darkening
                UIColor.black.withAlphaComponent(0.3).setFill()
                ctx.fill(CGRect(origin: .zero, size: size), blendMode: .multiply)
                
            } else {
                // FALLBACK: Programmatic Drawing
                let bgColor = colorForStandard(overrideStandard)
                bgColor.setFill()
                ctx.fill(CGRect(origin: .zero, size: size))
                drawPoolTiles(in: ctx.cgContext, size: size)
                drawWaves(in: ctx.cgContext, size: size, color: UIColor.white.withAlphaComponent(0.2))
            }
            
            // 2. Add Color Overlay for Standard
            let standardColor = colorForStandard(overrideStandard)
            standardColor.withAlphaComponent(0.6).setFill() // Semi-transparent tint
            ctx.fill(CGRect(origin: .zero, size: size), blendMode: .overlay)
            
            // 2b. Darken bottom for readability
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                      colors: [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.9).cgColor] as CFArray,
                                      locations: [0.0, 1.0])!
            ctx.cgContext.drawLinearGradient(gradient, start: CGPoint.zero, end: CGPoint(x: 0, y: size.height), options: [])
            
            // 3. Draw Date (Top)
            // Match Stroke Name size (32)
            let dateFont = UIFont.systemFont(ofSize: 32, weight: .bold)
            let dateAttrs: [NSAttributedString.Key: Any] = [
                .font: dateFont,
                .foregroundColor: UIColor.white.withAlphaComponent(0.9)
            ]
            let dateString = NSAttributedString(string: result.date, attributes: dateAttrs)
            let dateSize = dateString.size()
            dateString.draw(at: CGPoint(x: (size.width - dateSize.width)/2, y: 40))
            
            // 3b. Draw Icon (Top Center - pushed down by date)
            // Parse event string "50 FR SCY" -> Dist: "50", Stroke: "FR", Course: "SCY"
            let parts = result.event.components(separatedBy: " ")
            var strokeIcon: UIImage?
            var titleText = result.event // Fallback default
            
            if parts.count >= 2 {
                let strokeCode = parts.count == 3 ? parts[1] : parts.last! // Handle "50 FR" or "50 FR SCY"
                strokeIcon = iconForStroke(strokeCode)
                
                if strokeIcon != nil {
                     // If we have an icon, the title becomes just "50 SCY" (Distance + Course)
                     // Or just "50" if no course
                     if parts.count == 3 {
                         titleText = "\(parts[0]) \(parts[2])"
                     } else {
                         titleText = parts[0]
                     }
                }
            }

            if let icon = strokeIcon {
                let iconSize = CGSize(width: 140, height: 140)
                let iconRect = CGRect(x: (size.width - iconSize.width)/2, 
                                      y: 90, // Moved down further (was 70)
                                      width: iconSize.width, 
                                      height: iconSize.height)
                icon.draw(in: iconRect)
            }
            
            // 4. Draw Time (Center)
            let timeFont = UIFont.monospacedDigitSystemFont(ofSize: 70, weight: .black)
            let timeAttrs: [NSAttributedString.Key: Any] = [
                .font: timeFont,
                .foregroundColor: UIColor.white
            ]
            let timeString = NSAttributedString(string: result.time, attributes: timeAttrs)
            let timeSize = timeString.size()
            // Below Icon
            timeString.draw(at: CGPoint(x: (size.width - timeSize.width)/2, y: 240))
            
            // 5. Draw Event Description (Below Time)
            // "50 SCY"
            let eventFont = UIFont.systemFont(ofSize: 40, weight: .bold)
            let eventAttrs: [NSAttributedString.Key: Any] = [
                .font: eventFont,
                .foregroundColor: UIColor.white.withAlphaComponent(0.9)
            ]
            let eventString = NSAttributedString(string: titleText, attributes: eventAttrs)
            let eventSize = eventString.size()
            eventString.draw(at: CGPoint(x: (size.width - eventSize.width)/2, y: 320))

            // 6. Draw Stroke Name (Below Event Description)
            // e.g. "FREESTYLE"
            var strokeName = ""
            if let code = parts.count >= 2 ? (parts.count == 3 ? parts[1] : parts.last!) : nil {
                 strokeName = fullNameForStroke(code)
            }
            
            let strokeNameFont = UIFont.systemFont(ofSize: 32, weight: .bold)
            let strokeNameAttrs: [NSAttributedString.Key: Any] = [
                .font: strokeNameFont,
                .foregroundColor: UIColor.white.withAlphaComponent(0.7) // Slightly dimmer
            ]
            let strokeNameString = NSAttributedString(string: strokeName.uppercased(), attributes: strokeNameAttrs)
            let strokeNameSize = strokeNameString.size()
            strokeNameString.draw(at: CGPoint(x: (size.width - strokeNameSize.width)/2, y: 370))
            
            
            // 7. Draw Standard Badges (Bottom)
            
            // 7a. Standard (Bottom Right) - "A", "BB"
            let badgeText = overrideStandard
            if !badgeText.isEmpty {
                let badgeFont = UIFont.systemFont(ofSize: 60, weight: .heavy)
                let badgeAttrs: [NSAttributedString.Key: Any] = [
                    .font: badgeFont,
                    .foregroundColor: UIColor.white
                ]
                let badgeString = NSAttributedString(string: badgeText, attributes: badgeAttrs)
                let badgeSize = badgeString.size()
                
                // Position: 30px from right, 30px from bottom
                let badgeX = size.width - badgeSize.width - 30
                let badgeY = size.height - badgeSize.height - 30
                badgeString.draw(at: CGPoint(x: badgeX, y: badgeY))
            }

            // 7b. Qualifier (Bottom Left) - "AGC", "FW"
            if let qual = qualifier, !qual.isEmpty {
                // Same size as Standard
                let qualFont = UIFont.systemFont(ofSize: 60, weight: .heavy)
                let qualAttrs: [NSAttributedString.Key: Any] = [
                    .font: qualFont,
                    .foregroundColor: UIColor.white // Maybe a color distinction? User said "same size".
                ]
                let qualString = NSAttributedString(string: qual, attributes: qualAttrs)
                let qualSize = qualString.size()
                
                // Position: 30px from left, 30px from bottom (align baseline with standard if possible, roughly same Y)
                // We'll use the same margin
                let qualX: CGFloat = 30
                let qualY = size.height - qualSize.height - 30
                
                qualString.draw(at: CGPoint(x: qualX, y: qualY))
            }
            
            // DEBUG: Version Watermark + TraceID
            // Removed for production polish
            // let debugFont = UIFont.systemFont(ofSize: 20, weight: .bold)
            // let debugAttrs: [NSAttributedString.Key: Any] = [.font: debugFont, .foregroundColor: UIColor.red]
            // let debugString = NSAttributedString(string: "v7-Group [\(traceID)]", attributes: debugAttrs)
            // debugString.draw(at: CGPoint(x: 10, y: size.height - 30))
        }
        
        // Save to Shared App Group Container
        // This is required for the Top Shelf Extension to share files with the Home Screen (PineBoard)
        // Filename passed in argument
        // appGroupIdentifier defined at top of function
        
        guard let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            logger.error("❌ Failed to access App Group Container: \(appGroupIdentifier, privacy: .public). Did you enable the Capability?")
            // Fallback to Caches if App Group is invalid (e.g. simulator might still work)
            return saveToLocalCaches(image: image, filename: filename, traceID: traceID)
        }
        
        // DIAGNOSTIC LOGGING
        logger.error("📂 [Trace: \(traceID)] App Group Path: \(sharedContainer.path, privacy: .public)")
        let exists = FileManager.default.fileExists(atPath: sharedContainer.path)
        let bundleID = Bundle.main.bundleIdentifier ?? "Unknown"
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        logger.error("ℹ️ Bundle: \(bundleID) (v\(version)), Group: \(appGroupIdentifier)")
        logger.error("📂 Exists: \(exists, privacy: .public), Writable: \(FileManager.default.isWritableFile(atPath: sharedContainer.path), privacy: .public)")
        
        // Use a "CardCache" subdirectory to keep things organized
        // UPDATE: Writing to subdirectory failed on device. Writing to root.
        // let cacheDir = sharedContainer.appendingPathComponent("CardCache")
        
        do {
            // Try explicit directory creation (sometimes the root needs a nudge)
            if !exists {
                try FileManager.default.createDirectory(at: sharedContainer, withIntermediateDirectories: true)
                logger.error("📂 Created App Group Directory successfully")
            }
            /*
            if !FileManager.default.fileExists(atPath: cacheDir.path) {
                try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
            }
            */
            
            // 3. Construct File Path in App Group's "Library/Caches"
            // Writing to root often fails (Sandbox Deny). Writing to Library/Caches is standard.
            let libraryCaches = sharedContainer.appendingPathComponent("Library/Caches/TopShelfImages")
            
            // Ensure Directory Exists
            if !FileManager.default.fileExists(atPath: libraryCaches.path) {
                try? FileManager.default.createDirectory(at: libraryCaches, withIntermediateDirectories: true)
                logger.error("📂 Created App Group Subdirectory: \(libraryCaches.path)")
            }
            
            let url = libraryCaches.appendingPathComponent(filename)
            
            if let data = image.jpegData(compressionQuality: 0.6) {
                // 1. Try App Group File Write (with noFileProtection)
                try data.write(to: url, options: .noFileProtection)
                logger.debug("✅ [Trace: \(traceID)] Saved card to App Group: \(url.path) (Size: \(data.count) bytes)")
                return url
            }
        } catch {
            logger.error("❌ Failed to save to App Group: \(error.localizedDescription, privacy: .public)")
            // FALLBACK: Try Local Caches
            return saveToLocalCaches(image: image, filename: filename, traceID: traceID)
        }
        
        return nil
    }
    
    private static func saveToLocalCaches(image: UIImage, filename: String, traceID: String) -> URL? {
        logger.error("⚠️ [Trace: \(traceID)] Entering saveToLocalCaches fallback for: \(filename, privacy: .public)")
        
        // Use Caches Directory
        guard let cachesDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            logger.error("❌ Failed to find Caches Directory")
            return nil
        }
        
        let url = cachesDir.appendingPathComponent(filename)
        
        do {
            // Ensure directory exists
            if !FileManager.default.fileExists(atPath: cachesDir.path) {
                try FileManager.default.createDirectory(at: cachesDir, withIntermediateDirectories: true)
            }
            
            if let data = image.jpegData(compressionQuality: 0.6) {
                try data.write(to: url)
                logger.error("⚠️ [Trace: \(traceID)] Fallback SUCCESS: Saved to Local Caches: \(url.path, privacy: .public)")
                return url
            }
        } catch {
             logger.error("❌ Fallback Failed: \(error.localizedDescription, privacy: .public)")
        }
        return nil
    }

    
    // ... Helpers ...

    private static func iconForStroke(_ code: String) -> UIImage? {
        let name: String
        switch code.uppercased() {
        case "FR", "FREE": name = "icon_freestyle"
        case "BK", "BACK": name = "icon_backstroke"
        case "BR", "BREAST": name = "icon_breaststroke"
        case "FL", "FLY": name = "icon_butterfly"
        case "IM": name = "icon_im"
        default: return nil
        }
        
        // Use the same robust loading logic as the background
        if let img = UIImage(named: name) { return img }
        if let img = UIImage(named: name, in: Bundle(for: SwimCardRendererV7.self), compatibleWith: nil) { return img }
        return nil
    }
    
    private static func fullNameForStroke(_ code: String) -> String {
        switch code.uppercased() {
        case "FR", "FREE": return "Freestyle"
        case "BK", "BACK": return "Backstroke"
        case "BR", "BREAST": return "Breaststroke"
        case "FL", "FLY": return "Butterfly"
        case "IM": return "Ind. Medley"
        default: return code
        }
    }

    private static func colorForStandard(_ std: String) -> UIColor {
        switch std {
        case "AAAA": return UIColor.systemPurple
        case "AAA": return UIColor.systemIndigo
        case "AA": return UIColor.systemBlue
        case "A": return UIColor.systemCyan // Cyan is close to Teal
        case "BB": return UIColor.systemGreen
        case "B": return UIColor.systemYellow
        case "Slower than B": return UIColor.systemGray
        default: return UIColor.systemGray
        }
    }
    
    private static func drawPoolTiles(in ctx: CGContext, size: CGSize) {
        ctx.saveGState()
        let tileSize: CGFloat = 40
        let path = UIBezierPath()
        
        for x in stride(from: 0, to: size.width, by: tileSize) {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: size.height))
        }
        for y in stride(from: 0, to: size.height, by: tileSize) {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
        }
        
        UIColor.white.withAlphaComponent(0.05).setStroke()
        path.lineWidth = 1
        path.stroke()
        ctx.restoreGState()
    }
    
    private static func drawWaves(in ctx: CGContext, size: CGSize, color: UIColor) {
        ctx.saveGState()
        let wavelength: CGFloat = 100
        let amplitude: CGFloat = 20
        let waterHeight: CGFloat = 150
        
        let path = UIBezierPath()
        path.move(to: CGPoint(x: 0, y: size.height))
        path.addLine(to: CGPoint(x: 0, y: size.height - waterHeight))
        
        for x in stride(from: 0, to: size.width + wavelength, by: 5) {
            let relativeX = x / wavelength
            let y = amplitude * sin(relativeX * 2 * .pi) + (size.height - waterHeight)
            path.addLine(to: CGPoint(x: x, y: y))
            path.addLine(to: CGPoint(x: x, y: y))
        }
        
        path.addLine(to: CGPoint(x: size.width, y: size.height))
        path.close()
        
        color.setFill()
        path.fill()
        ctx.restoreGState()
    }
}
