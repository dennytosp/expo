import ExpoModulesCore
import UniformTypeIdentifiers

private let sharingQueue = DispatchQueue(label: "expo.modules.sharing.AsyncQueue", qos: .userInitiated)
private let stagedShareLifetime: TimeInterval = 24 * 60 * 60

public final class SharingModule: Module {
  private weak var activeShareSheet: UIActivityViewController?

  private var appGroupId: String {
    get throws {
      guard let groupId = Bundle.main.object(forInfoDictionaryKey: "ExpoShareIntoAppGroupId") as? String else {
        throw FailedToResolveAppGroupIdException()
      }
      return groupId
    }
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoSharing")

    AsyncFunction("shareAsync") { (url: URL, options: SharingOptions, promise: Promise) in
      guard FileSystemUtilities.isReadableFile(appContext, url) else {
        throw FilePermissionException()
      }
      guard !isShareSheetActive() else {
        throw SharingInProgressException()
      }

      // `UIActivityViewController` derives the shared item's type (and preview)
      // from the file's extension. Cached files often have no extension, so when
      // the caller declares a content type via `UTI`/`mimeType` we expose the
      // file under a correctly-named hard link. A hard link is a second name for
      // the same on-disk data, so this costs no copy and behaves as a real file
      // for every consumer.
      let itemURL = shareableURL(for: url, options: options)
      let linkDirectory = itemURL == url ? nil : itemURL.deletingLastPathComponent()

      DispatchQueue.main.async {
        let session = ShareSheetSession(promise: promise, stagedDirectory: linkDirectory)

        guard !self.isShareSheetActive() else {
          session.reject(SharingInProgressException())
          return
        }

        guard let currentViewController = self.appContext?.utilities?.currentViewController() else {
          session.reject(MissingCurrentViewControllerException())
          return
        }

        guard currentViewController.viewIfLoaded?.window != nil,
          currentViewController.presentedViewController == nil,
          !currentViewController.isBeingPresented,
          !currentViewController.isBeingDismissed,
          currentViewController.transitionCoordinator == nil
        else {
          session.reject(FailedToPresentShareSheetException())
          return
        }

        let activityController = UIActivityViewController(activityItems: [itemURL], applicationActivities: nil)
        activityController.title = options.dialogTitle
        self.activeShareSheet = activityController

        activityController.completionWithItemsHandler = { _, _, _, _ in
          DispatchQueue.main.async {
            // Resolve unconditionally. UIActivityViewController invokes this once
            // on dismissal for every (activityType, completed) permutation.
            // Keep staged files cached because some activities read them after dismissal.
            self.activeShareSheet = nil
            session.resolve()
          }
        }

        // Apple docs state that `UIActivityViewController` must be presented in a
        // popover on iPad https://developer.apple.com/documentation/uikit/uiactivityviewcontroller
        if UIDevice.current.userInterfaceIdiom == .pad {
          let rect = options.anchor
          let viewFrame = currentViewController.view.frame

          activityController.popoverPresentationController?.sourceRect = CGRect(
            x: rect?.x ?? viewFrame.midX,
            y: rect?.y ?? viewFrame.maxY,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0
          )
          activityController.popoverPresentationController?.sourceView = currentViewController.view
          activityController.modalPresentationStyle = .pageSheet
        }

        currentViewController.present(activityController, animated: true)
      }
    }
    .runOnQueue(sharingQueue)

    // MARK: - Share into

    Function("getSharedPayloads") {
      let rawPayloads = try getSharePayloads(appGroupId: appGroupId)
      return rawPayloads.map { ExpoSharePayload(from: $0).toDictionary() }
    }

    AsyncFunction("getResolvedSharedPayloadsAsync") {
      let rawPayloads = try getSharePayloads(appGroupId: appGroupId)

      return try await withThrowingTaskGroup(of: (Int, ExpoResolvedSharePayload).self) { [weak self] group in
        guard let self else {
          return []
        }

        for (index, rawPayload) in rawPayloads.enumerated() {
          group.addTask {
            let resolved = try await ExpoResolvedSharePayload.resolve(from: rawPayload)
            return (index, resolved)
          }
        }

        var results = [ExpoResolvedSharePayload?](repeating: nil, count: rawPayloads.count)
        for try await (index, resolved) in group {
          results[index] = resolved
        }

        return results.compactMap { $0?.toDictionary() }
      }
    }

    Function("clearSharedPayloads") {
      try UserDefaults(suiteName: appGroupId)?.removeObject(forKey: SHARE_INTO_DEFAULTS_KEY)
    }
  }

  private func declaredContentType(_ options: SharingOptions) -> UTType? {
    if let uti = options.UTI, let type = UTType(uti), type.preferredFilenameExtension != nil {
      return type
    }
    if let mimeType = options.mimeType,
      let type = UTType(mimeType: mimeType),
      type.preferredFilenameExtension != nil {
      return type
    }
    return nil
  }

  private func isShareSheetActive() -> Bool {
    if Thread.isMainThread {
      return activeShareSheet != nil
    }
    return DispatchQueue.main.sync { activeShareSheet != nil }
  }

  private func shareableURL(for url: URL, options: SharingOptions) -> URL {
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
      return url
    }

    let stagingDirectory = (appContext?.config.cacheDirectory ?? FileManager.default.temporaryDirectory)
      .appendingPathComponent("expo-sharing", isDirectory: true)
    cleanupStaleShareDirectories(in: stagingDirectory)

    guard let type = declaredContentType(options), let ext = type.preferredFilenameExtension else {
      return url
    }

    if let currentType = UTType(filenameExtension: url.pathExtension), currentType.conforms(to: type) {
      return url
    }

    // An explicitly declared type intentionally takes precedence over a conflicting filename extension.
    let baseName = url.lastPathComponent
    let linkDirectory = stagingDirectory
      .appendingPathComponent(UUID().uuidString, isDirectory: true)
    let linkURL = linkDirectory
      .appendingPathComponent(baseName.isEmpty ? "expo-sharing-item" : baseName)
      .appendingPathExtension(ext)

    do {
      try FileManager.default.createDirectory(at: linkDirectory, withIntermediateDirectories: true)
      do {
        try FileManager.default.linkItem(at: url, to: linkURL)
      } catch {
        // Hard links cannot span volumes (`EXDEV`), which is reachable for URLs
        // vended by a file provider. Copying costs an actual duplicate of the
        // file, but it is the only way to honor the declared type in that case.
        try FileManager.default.copyItem(at: url, to: linkURL)
      }
      return linkURL
    } catch {
      try? FileManager.default.removeItem(at: linkDirectory)
      appContext?.jsLogger.warn(
        "expo-sharing: Failed to stage '\(url.lastPathComponent)' with the declared type: \(error.localizedDescription). Sharing the original URL, so the declared type will be ignored."
      )
      return url
    }
  }

  private func cleanupStaleShareDirectories(in directory: URL) {
    let resourceKeys: Set<URLResourceKey> = [.isDirectoryKey, .contentModificationDateKey, .creationDateKey]
    guard let contents = try? FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: Array(resourceKeys),
      options: .skipsHiddenFiles
    ) else {
      return
    }

    let expirationDate = Date(timeIntervalSinceNow: -stagedShareLifetime)
    for url in contents {
      guard UUID(uuidString: url.lastPathComponent) != nil,
        let values = try? url.resourceValues(forKeys: resourceKeys),
        values.isDirectory == true,
        let contentDate = values.contentModificationDate ?? values.creationDate,
        contentDate < expirationDate
      else {
        continue
      }
      try? FileManager.default.removeItem(at: url)
    }
  }

  private func getSharePayloads(appGroupId: String) -> [SharePayload] {
    let userDefaults = UserDefaults(suiteName: appGroupId)

    guard let data = userDefaults?.data(forKey: SHARE_INTO_DEFAULTS_KEY),
    let rawPayloads = try? JSONDecoder().decode([SharePayload].self, from: data)
    else {
      return []
    }

    return rawPayloads
  }
}

private final class ShareSheetSession {
  private let promise: Promise
  private let stagedDirectory: URL?
  private var isSettled = false

  init(promise: Promise, stagedDirectory: URL?) {
    self.promise = promise
    self.stagedDirectory = stagedDirectory
  }

  func resolve() {
    settle {
      promise.resolve(nil)
    }
  }

  func reject(_ exception: Exception) {
    settle(cleanupStagedDirectory: true) {
      promise.reject(exception)
    }
  }

  private func settle(cleanupStagedDirectory: Bool = false, _ action: () -> Void) {
    dispatchPrecondition(condition: .onQueue(.main))
    guard !isSettled else {
      return
    }
    isSettled = true
    if cleanupStagedDirectory {
      cleanup()
    }
    action()
  }

  private func cleanup() {
    if let stagedDirectory {
      try? FileManager.default.removeItem(at: stagedDirectory)
    }
  }
}
