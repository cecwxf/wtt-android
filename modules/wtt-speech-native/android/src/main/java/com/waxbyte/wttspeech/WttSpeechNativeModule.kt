package com.waxbyte.wttspeech

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.net.Uri
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.max

class WttSpeechNativeModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  @Volatile private var tts: OfflineTts? = null
  @Volatile private var audioTrack: AudioTrack? = null
  @Volatile private var speaking = false
  private var sampleRate = 22050

  override fun definition() = ModuleDefinition {
    Name("WttSpeechNative")

    AsyncFunction("initializeTts") { options: Map<String, Any?>, promise: Promise ->
      executor.execute {
        try {
          stopPlayback()
          tts?.release()
          val modelDir = cleanPath(requiredString(options, "modelDir"))
          val model = resolveFile(modelDir, requiredString(options, "modelFile"))
          val tokens = resolveFile(modelDir, requiredString(options, "tokensFile"))
          val lexicon = resolveFile(modelDir, requiredString(options, "lexiconFile"))
          val dictDir = cleanPath(requiredString(options, "dictDir"))
          require(File(dictDir).isDirectory) { "TTS dictionary directory not found" }
          val ruleFsts = requiredString(options, "ruleFstsFile")
            .split(',')
            .map { cleanPath(it.trim()) }
            .onEach { require(File(it).isFile) { "TTS rule file not found" } }
            .joinToString(",")
          val threads = (options["numThreads"] as? Number)?.toInt()?.coerceIn(1, 4) ?: 2
          val vits = OfflineTtsVitsModelConfig(
            model = model,
            lexicon = lexicon,
            tokens = tokens,
            dictDir = dictDir,
          )
          val config = OfflineTtsConfig(
            model = OfflineTtsModelConfig(vits = vits, numThreads = threads, provider = "cpu"),
            ruleFsts = ruleFsts,
            maxNumSentences = 1,
          )
          tts = OfflineTts(config = config)
          sampleRate = tts?.sampleRate() ?: 22050
          promise.resolve(mapOf("success" to true, "sampleRate" to sampleRate))
        } catch (error: Throwable) {
          releaseTts()
          promise.reject("ERR_TTS_INIT", error.message ?: "TTS initialization failed", error)
        }
      }
    }

    AsyncFunction("speak") { text: String, speakerId: Int, speakingRate: Double, promise: Promise ->
      executor.execute {
        try {
          require(text.isNotBlank()) { "Text cannot be empty" }
          val engine = tts ?: error("TTS is not initialized")
          stopPlayback()
          speaking = true
          val track = createAudioTrack(sampleRate)
          audioTrack = track
          var samplesWritten = 0
          engine.generateWithCallback(
            text,
            speakerId.coerceAtLeast(0),
            speakingRate.toFloat().coerceIn(0.5f, 2.0f),
            object : Function1<FloatArray, Int> {
              override fun invoke(samples: FloatArray): Int {
                if (!speaking) return 0
                val pcm = ShortArray(samples.size) { index ->
                  (samples[index].coerceIn(-1.0f, 1.0f) * Short.MAX_VALUE).toInt().toShort()
                }
                var offset = 0
                while (speaking && offset < pcm.size) {
                  val written = track.write(pcm, offset, pcm.size - offset, AudioTrack.WRITE_BLOCKING)
                  if (written <= 0) return 0
                  offset += written
                  samplesWritten += written
                }
                return if (speaking) 1 else 0
              }
            },
          )
          waitForPlayback(track, samplesWritten)
          stopPlayback()
          promise.resolve(mapOf("success" to true))
        } catch (error: Throwable) {
          stopPlayback()
          promise.reject("ERR_TTS_SPEAK", error.message ?: "TTS playback failed", error)
        }
      }
    }

    Function("stop") {
      stopPlayback()
    }

    AsyncFunction("release") { promise: Promise ->
      stopPlayback()
      executor.execute {
        releaseTts()
        promise.resolve(null)
      }
    }

    OnDestroy {
      stopPlayback()
      executor.execute { releaseTts() }
      executor.shutdown()
    }
  }

  private fun requiredString(options: Map<String, Any?>, key: String): String {
    return (options[key] as? String)?.takeIf { it.isNotBlank() }
      ?: error("Missing TTS option: $key")
  }

  private fun cleanPath(value: String): String {
    return if (value.startsWith("file://")) Uri.parse(value).path ?: value.removePrefix("file://") else value
  }

  private fun resolveFile(baseDir: String, path: String): String {
    val file = File(cleanPath(path)).let { if (it.isAbsolute) it else File(baseDir, path) }
    require(file.isFile) { "TTS model file not found: ${file.name}" }
    return file.absolutePath
  }

  private fun createAudioTrack(rate: Int): AudioTrack {
    val minBuffer = AudioTrack.getMinBufferSize(
      rate,
      AudioFormat.CHANNEL_OUT_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    require(minBuffer > 0) { "Audio output is unavailable" }
    return AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build(),
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(rate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build(),
      )
      .setBufferSizeInBytes(max(minBuffer * 4, rate * 2))
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build()
      .also {
        require(it.state == AudioTrack.STATE_INITIALIZED) { "Audio output failed to initialize" }
        it.play()
      }
  }

  private fun waitForPlayback(track: AudioTrack, samplesWritten: Int) {
    val timeoutAt = System.currentTimeMillis() + (samplesWritten * 1000L / sampleRate) + 1500L
    while (speaking && track.playbackHeadPosition < samplesWritten && System.currentTimeMillis() < timeoutAt) {
      Thread.sleep(20)
    }
  }

  @Synchronized
  private fun stopPlayback() {
    speaking = false
    val track = audioTrack
    audioTrack = null
    try {
      if (track?.state == AudioTrack.STATE_INITIALIZED) {
        track.pause()
        track.flush()
        track.stop()
      }
    } catch (_: IllegalStateException) {
      // The audio device may already have released the track.
    } finally {
      track?.release()
    }
  }

  private fun releaseTts() {
    stopPlayback()
    tts?.release()
    tts = null
  }
}
