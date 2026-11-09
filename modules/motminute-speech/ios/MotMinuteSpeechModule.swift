// MotMinute — module natif de transcription locale.
//
// Utilise SpeechAnalyzer / SpeechTranscriber (iOS 26+) pour transcrire un
// fichier audio stocké sur l'iPhone, sans envoi réseau. Les minutages de
// chaque bloc proviennent des intervalles audio renvoyés par le moteur
// (attribut `audioTimeRange`), jamais d'une estimation.
//
// Fournit aussi :
//  - getAudioInfo : durée réelle d'un fichier (AVAudioFile) pour valider l'import ;
//  - sentenceEmbedding* : accès expérimental à NLEmbedding (recherche par sens).

import AVFoundation
import ExpoModulesCore
import NaturalLanguage
import Speech

public class MotMinuteSpeechModule: Module {
  private var currentJob: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("MotMinuteSpeech")

    Events("onTranscriptionProgress", "onModelProgress")

    // MARK: - Audio

    AsyncFunction("getAudioInfo") { (uri: String) throws -> [String: Any] in
      let url = try MotMinuteSpeechModule.fileURL(from: uri)
      do {
        let file = try AVAudioFile(forReading: url)
        let format = file.processingFormat
        let duration = format.sampleRate > 0 ? Double(file.length) / format.sampleRate : 0
        return [
          "durationSec": duration,
          "sampleRate": format.sampleRate,
          "channels": Int(format.channelCount),
        ]
      } catch {
        throw Exception(
          name: "ERR_UNREADABLE_AUDIO",
          description: "Fichier audio illisible : \(error.localizedDescription)"
        )
      }
    }

    // MARK: - Transcription

    AsyncFunction("getAvailability") { (localeId: String) async -> [String: Any] in
      let osVersion = UIDevice.current.systemVersion
      guard #available(iOS 26.0, *) else {
        return ["status": "unsupported-os", "osVersion": osVersion]
      }
      var result = await SpeechEngine.availability(localeId: localeId)
      result["osVersion"] = osVersion
      return result
    }

    AsyncFunction("ensureModel") { (localeId: String) async throws -> [String: Any] in
      guard #available(iOS 26.0, *) else {
        throw Exception(name: "ERR_UNSUPPORTED_OS", description: "La transcription nécessite iOS 26.")
      }
      return try await SpeechEngine.ensureModel(localeId: localeId) { [weak self] fraction in
        self?.sendEvent("onModelProgress", ["fraction": fraction])
      }
    }

    AsyncFunction("transcribe") { (uri: String, localeId: String) async throws -> [String: Any] in
      guard #available(iOS 26.0, *) else {
        throw Exception(name: "ERR_UNSUPPORTED_OS", description: "La transcription nécessite iOS 26.")
      }
      let url = try MotMinuteSpeechModule.fileURL(from: uri)
      let job = SpeechEngine.Job()
      self.currentJob = job
      defer { self.currentJob = nil }
      let segments = try await job.run(url: url, localeId: localeId) { [weak self] fraction, processedSec in
        self?.sendEvent("onTranscriptionProgress", ["fraction": fraction, "processedSec": processedSec])
      }
      return ["segments": segments, "engine": "SpeechAnalyzer/SpeechTranscriber", "locale": localeId]
    }

    AsyncFunction("cancel") { () async -> Bool in
      guard #available(iOS 26.0, *) else { return false }
      guard let job = self.currentJob as? SpeechEngine.Job else { return false }
      await job.cancel()
      return true
    }

    // MARK: - Recherche par sens (expérimental)

    AsyncFunction("sentenceEmbeddingInfo") { (language: String) -> [String: Any] in
      let lang = NLLanguage(rawValue: language)
      guard let embedding = NLEmbedding.sentenceEmbedding(for: lang) else {
        return ["available": false]
      }
      return ["available": true, "dimension": embedding.dimension, "revision": embedding.revision]
    }

    AsyncFunction("embedSentences") { (texts: [String], language: String) throws -> [[Double]] in
      let lang = NLLanguage(rawValue: language)
      guard let embedding = NLEmbedding.sentenceEmbedding(for: lang) else {
        throw Exception(name: "ERR_NO_EMBEDDING", description: "Aucun modèle de phrases local pour \(language).")
      }
      return texts.map { embedding.vector(for: $0) ?? [] }
    }
  }

  static func fileURL(from uri: String) throws -> URL {
    if let url = URL(string: uri), url.isFileURL {
      return url
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    throw Exception(name: "ERR_BAD_URI", description: "Chemin de fichier invalide : \(uri)")
  }
}

// MARK: - Moteur SpeechAnalyzer (iOS 26+)

@available(iOS 26.0, *)
enum SpeechEngine {
  static func makeTranscriber(locale: Locale) -> SpeechTranscriber {
    SpeechTranscriber(
      locale: locale,
      transcriptionOptions: [],
      reportingOptions: [],
      attributeOptions: [.audioTimeRange]
    )
  }

  static func resolveLocale(_ localeId: String) async -> Locale? {
    await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: localeId))
  }

  static func availability(localeId: String) async -> [String: Any] {
    guard SpeechTranscriber.isAvailable else {
      return ["status": "unsupported-device"]
    }
    guard let locale = await resolveLocale(localeId) else {
      return ["status": "unsupported-locale"]
    }
    let installed = await SpeechTranscriber.installedLocales
    let isInstalled = installed.contains { $0.identifier(.bcp47) == locale.identifier(.bcp47) }
    return [
      "status": isInstalled ? "ready" : "needs-download",
      "locale": locale.identifier(.bcp47),
    ]
  }

  static func ensureModel(localeId: String, onProgress: @escaping (Double) -> Void) async throws -> [String: Any] {
    guard SpeechTranscriber.isAvailable else {
      throw Exception(name: "ERR_UNSUPPORTED_DEVICE", description: "Cet iPhone ne prend pas en charge la transcription locale.")
    }
    guard let locale = await resolveLocale(localeId) else {
      throw Exception(name: "ERR_UNSUPPORTED_LOCALE", description: "Le français n’est pas disponible pour la transcription sur cet appareil.")
    }
    let transcriber = makeTranscriber(locale: locale)
    if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
      let progress = request.progress
      let observation = progress.observe(\.fractionCompleted, options: [.new]) { p, _ in
        onProgress(p.fractionCompleted)
      }
      defer { observation.invalidate() }
      try await request.downloadAndInstall()
    }
    onProgress(1)
    return ["status": "ready", "locale": locale.identifier(.bcp47)]
  }

  /// Une transcription en cours, annulable.
  final class Job {
    private var analyzer: SpeechAnalyzer?
    private var cancelled = false

    func cancel() async {
      cancelled = true
      await analyzer?.cancelAndFinishNow()
    }

    func run(
      url: URL,
      localeId: String,
      onProgress: @escaping (Double, Double) -> Void
    ) async throws -> [[String: Any]] {
      guard let locale = await SpeechEngine.resolveLocale(localeId) else {
        throw Exception(name: "ERR_UNSUPPORTED_LOCALE", description: "Langue non prise en charge.")
      }
      let installed = await SpeechTranscriber.installedLocales
      guard installed.contains(where: { $0.identifier(.bcp47) == locale.identifier(.bcp47) }) else {
        throw Exception(name: "ERR_MODEL_MISSING", description: "Le modèle de transcription français n’est pas encore téléchargé.")
      }

      let audioFile: AVAudioFile
      do {
        audioFile = try AVAudioFile(forReading: url)
      } catch {
        throw Exception(name: "ERR_UNREADABLE_AUDIO", description: "Fichier audio illisible : \(error.localizedDescription)")
      }
      let sampleRate = audioFile.processingFormat.sampleRate
      let totalSec = sampleRate > 0 ? Double(audioFile.length) / sampleRate : 0

      let transcriber = SpeechEngine.makeTranscriber(locale: locale)
      let analyzer = SpeechAnalyzer(modules: [transcriber])
      self.analyzer = analyzer

      let collector = Task { () throws -> [[String: Any]] in
        var builder = SegmentBuilder()
        for try await result in transcriber.results {
          guard result.isFinal else { continue }
          builder.add(result: result)
          let processed = result.range.end.seconds
          if processed.isFinite, totalSec > 0 {
            onProgress(min(1, processed / totalSec), processed)
          }
        }
        builder.flush()
        return builder.segments
      }

      do {
        if let lastSample = try await analyzer.analyzeSequence(from: audioFile) {
          try await analyzer.finalizeAndFinish(through: lastSample)
        } else {
          await analyzer.cancelAndFinishNow()
        }
      } catch {
        collector.cancel()
        throw error
      }
      let segments = try await collector.value
      if cancelled {
        throw Exception(name: "ERR_CANCELLED", description: "Transcription interrompue.")
      }
      onProgress(1, totalSec)
      return segments
    }
  }

  /// Regroupe les mots horodatés en blocs lisibles (phrases), en conservant
  /// strictement les intervalles fournis par le moteur.
  struct SegmentBuilder {
    var segments: [[String: Any]] = []
    private var text = ""
    private var start: Double?
    private var end: Double?

    mutating func add(result: SpeechTranscriber.Result) {
      let attributed = result.text
      var sawTimedRun = false
      for run in attributed.runs {
        let piece = String(attributed[run.range].characters)
        guard let range = run.audioTimeRange else {
          text += piece
          continue
        }
        sawTimedRun = true
        let s = range.start.seconds
        let e = range.end.seconds
        if start == nil, s.isFinite { start = s }
        if e.isFinite { end = max(end ?? e, e) }
        text += piece
        if shouldBreak() { flush() }
      }
      if !sawTimedRun {
        // Pas d'horodatage mot à mot : on prend l'intervalle du résultat.
        let s = result.range.start.seconds
        let e = result.range.end.seconds
        if start == nil, s.isFinite { start = s }
        if e.isFinite { end = e }
      }
      flush()
    }

    private func shouldBreak() -> Bool {
      guard let start, let end else { return false }
      let trimmed = text.trimmingCharacters(in: .whitespaces)
      let duration = end - start
      if let last = trimmed.last, ".?!…".contains(last), duration >= 4 { return true }
      return duration >= 30
    }

    mutating func flush() {
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      if !trimmed.isEmpty, let start, let end {
        segments.append(["start": start, "end": max(end, start), "text": trimmed])
      }
      text = ""
      start = nil
      end = nil
    }
  }
}
