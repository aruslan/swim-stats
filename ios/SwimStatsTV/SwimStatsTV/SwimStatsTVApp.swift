//
//  SwimStatsTVApp.swift
//  SwimStatsTV
//
//  Created by Ruslan Abdikeev on 12/16/25.
//

import SwiftUI

import OSLog

@main
struct SwimStatsTVApp: App {
    
    init() {
        checkAppGroupPermissions()
    }
    
    func checkAppGroupPermissions() {
        let logger = Logger(subsystem: "me.aruslan.SwimStatsTV", category: "PermissionsCheck")
        let appGroupIdentifier = "group.me.aruslan.SwimStatsTV.v4"
        
        logger.error("🚀 App Group Permission Check: STARTING for \(appGroupIdentifier)")
        
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            logger.error("🚀 App Group Permission Check: ❌ FAILED to get container URL. Check Capabilities/Provisioning!")
            return
        }
        
        logger.error("🚀 App Group Permission Check: ✅ Got container URL: \(container.path)")
        
        // TEST STANDARD SUBDIRECTORY: Library/Caches
        let libraryCaches = container.appendingPathComponent("Library/Caches")
        let testFileURL = libraryCaches.appendingPathComponent("permissions_check.txt")
        let testData = "Hello from Main App (Standard Path)".data(using: .utf8)!
        
        do {
            // Ensure directory exists (it might not in a fresh container)
            if !FileManager.default.fileExists(atPath: libraryCaches.path) {
                try FileManager.default.createDirectory(at: libraryCaches, withIntermediateDirectories: true)
                logger.error("🚀 App Group Permission Check: 📂 Created Library/Caches directory")
            }

            try testData.write(to: testFileURL)
            logger.error("🚀 App Group Permission Check: ✅ SUCCESS! Wrote file to Library/Caches.")
            // Clean up
            try FileManager.default.removeItem(at: testFileURL)
        } catch {
            logger.error("🚀 App Group Permission Check: ❌ FAILED to write file to Library/Caches. Error: \(error.localizedDescription)")
        }
        
        // 2. UserDefaults Check
        logger.error("🚀 UserDefaults Check: STARTING...")
        if let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) {
            sharedDefaults.set("Tested", forKey: "PermissionsCheck")
            let value = sharedDefaults.string(forKey: "PermissionsCheck")
            if value == "Tested" {
                logger.error("🚀 UserDefaults Check: ✅ SUCCESS! IPC via UserDefaults is working.")
            } else {
                logger.error("🚀 UserDefaults Check: ❌ FAILED! Wrote 'Tested' but read back '\(value ?? "nil")'")
            }
        } else {
             logger.error("🚀 UserDefaults Check: ❌ FAILED! Could not initialize UserDefaults with suite \(appGroupIdentifier)")
        }
    }


    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
