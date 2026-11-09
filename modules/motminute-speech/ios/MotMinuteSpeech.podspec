Pod::Spec.new do |s|
  s.name           = 'MotMinuteSpeech'
  s.version        = '0.1.0'
  s.summary        = 'Transcription locale (SpeechAnalyzer, iOS 26) pour MotMinute'
  s.description    = 'Module Expo local : transcription sur l’appareil avec SpeechAnalyzer/SpeechTranscriber et horodatage par mot.'
  s.license        = 'UNLICENSED'
  s.author         = 'MotMinute'
  s.homepage       = 'https://github.com/ougot0/motminute'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Speech', 'AVFoundation', 'NaturalLanguage'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
