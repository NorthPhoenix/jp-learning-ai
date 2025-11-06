export interface AudioRecorderOptions {
  mediaStream?: MediaStream
  element?: HTMLAudioElement
  debug?: boolean
  recorder?: MediaRecorderOptions
  audio?: MediaTrackConstraints
}

const codecsList = {
  webm: ["opus", "vorbis"],
  ogg: ["opus", "vorbis"], // This may not work on mobile
}

export class AudioRecorder {
  options: AudioRecorderOptions
  latency: number
  debug: boolean
  mediaStream?: MediaStream
  mediaRecorder?: MediaRecorder
  recordingReady: boolean
  mediaGranted: boolean
  recording: boolean
  onBuffer?: (info: [Blob, number]) => void
  onReady?: (info: { mimeType: string; data: Blob; startTime: number }) => void
  onStop?: () => void
  bufferHeader: Blob | null
  afterStop: boolean
  onRecordingStateChange?: (recording: boolean) => void

  constructor(options?: AudioRecorderOptions, latency?: number) {
    options ??= {}

    this.options = options
    latency ??= 1000
    this.latency = latency

    this.debug = options.debug ?? false
    if (options.element && options.element.srcObject instanceof MediaStream) {
      this.mediaStream = options.element.srcObject
    }
    this.recordingReady = false
    this.mediaGranted = false
    this.recording = false
    this.bufferHeader = null

    this.afterStop = false

    this.getSupportedMimeType()
  }

  getSupportedMimeType() {
    this.options.recorder ??= {}

    if (
      this.options.recorder.mimeType &&
      !MediaRecorder.isTypeSupported(this.options.recorder.mimeType)
    ) {
      console.log("MediaRecorder doesn't supports mimetype " + this.options.recorder.mimeType)
      this.options.recorder.mimeType = undefined
    }

    if (!this.options.recorder?.mimeType) {
      let supportedMimeType: string | undefined = undefined

      for (const format of Object.keys(codecsList) as Array<keyof typeof codecsList>) {
        const codecs = codecsList[format]
        const mimeType = "audio/" + format

        for (const codec of codecs) {
          const temp = mimeType + ";codecs=" + codec
          if (MediaRecorder.isTypeSupported(temp) && MediaSource.isTypeSupported(temp)) {
            supportedMimeType = temp
            break
          }
        }

        if (
          !supportedMimeType &&
          MediaRecorder.isTypeSupported(mimeType) &&
          MediaSource.isTypeSupported(mimeType)
        )
          supportedMimeType = mimeType

        if (!supportedMimeType) break
      }

      this.options.recorder.mimeType = supportedMimeType

      if (this.debug) console.log("mimeType: " + supportedMimeType)
    }
  }

  onMediaGranted(mediaStream: MediaStream) {
    console.log("onMediaGranted:", mediaStream)
    this.mediaGranted = true

    this.bufferHeader = null
    let bufferHeaderLength = 0

    this.mediaRecorder = new MediaRecorder(mediaStream, this.options.recorder)

    if (this.debug) console.log("MediaRecorder obtained")
    this.mediaRecorder.onstart = () => {
      this.recording = true
      this.onRecordingStateChange?.(true)
    }

    const headerLatency = 100

    this.mediaRecorder.ondataavailable = (event) => {
      if (!this.options.recorder?.mimeType) {
        console.log("No mimeType available")
        return
      }

      if (!this.mediaRecorder) return // avoid type warnings

      if (bufferHeaderLength) {
        const streamingTime = Number(String(Date.now()).slice(-5, -3))
        this.onBuffer?.([event.data, streamingTime])
        return
      }

      // Return if the recording was stopped
      if (this.mediaRecorder.state !== "recording") return

      if (event.data.size <= 1) return

      // The audio buffer can contain some duration that causes a noise
      // So we will need to remove it on streamer side
      // Because the AudioBuffer can't be converted to ArrayBuffer with WebAudioAPI
      this.bufferHeader = event.data

      const predefinedBuffer = getBufferHeader(this.mediaRecorder.mimeType)
      if (!predefinedBuffer) return

      this.bufferHeader = predefinedBuffer
      bufferHeaderLength = this.bufferHeader.size

      if (bufferHeaderLength > 900 || bufferHeaderLength < 100)
        console.log(
          "%c[WARN] The buffer header length was more than 0.9KB or smaller than 0.1KB. This sometime cause decode error on streamer side. Try to avoid any heavy CPU usage when using the recorder.",
          "color:yellow",
        )

      if (this.onReady)
        this.onReady({
          mimeType: this.options.recorder.mimeType,
          startTime: Date.now(),
          data: this.bufferHeader,
        })

      this.recordingReady = true

      if (this.latency === headerLatency) return

      // Record with the custom latency
      console.log("stopping")
      this.mediaRecorder.stop()
      setTimeout(() => {
        this.mediaRecorder?.start(this.latency)
      }, 10)
    }

    // Get first header
    this.mediaRecorder.start(headerLatency)
  }

  reAddTracks(mediaStream: MediaStream) {
    if (!this.mediaRecorder) return

    const streams = mediaStream.getTracks()
    for (const stream of streams) {
      this.mediaRecorder.stream.addTrack(stream)
    }

    this.mediaRecorder.start(this.latency)
    this.recording = true
    this.onRecordingStateChange?.(true)
  }

  async startRecording() {
    if (this.afterStop) {
      this.afterStop = false

      if (!this.options.mediaStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: this.options.audio ?? true,
        })
        this.reAddTracks(stream)
      }
      return
    } else if (!this.mediaGranted || !this.mediaRecorder) {
      this.recordingReady = false

      if (this.options.mediaStream) {
        this.onMediaGranted(this.options.mediaStream)
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: this.options.audio ?? true,
        })
        this.onMediaGranted(stream)
      }

      return false
    }

    if (this.mediaRecorder.state !== "recording") {
      this.mediaRecorder.start(this.latency)
      this.recording = true
      this.onRecordingStateChange?.(true)
    }

    return true
  }

  stopRecording() {
    if (!this.recording || !this.mediaRecorder) {
      return
    }

    this.recording = false
    this.onRecordingStateChange?.(false)
    this.mediaRecorder.stop()

    if (!this.options.mediaStream) {
      // Turn off stream from microphone
      const streams = this.mediaRecorder.stream.getTracks()
      for (const stream of streams) {
        stream?.stop()
        this.mediaRecorder.stream.removeTrack(stream)
      }
    }

    // this.mediaRecorder.ondataavailable = null;
    // this.mediaRecorder.onstart = null;

    this.bufferHeader = null

    this.afterStop = true

    if (this.onStop) this.onStop()
  }
}

const BufferHeader: Record<string, string | Blob> = {
  "audio/webm;codecs=opus":
    "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////FUmpZpkq17GDD0JATYCGQ2hyb21lV0GGQ2hyb21lFlSua7+uvdeBAXPFh7o5nyc1kHqDgQKGhkFfT1BVU2Oik09wdXNIZWFkAQIAAIC7AAAAAADhjbWERzuAAJ+BAmJkgSAfQ7Z1Af/////////ngQCjjIEAAID/A//+//7//qM=",
}

function getBufferHeader(type: string) {
  if (!("chrome" in window) && type === "audio/webm;codecs=opus") {
    // this header is only for chrome based brosers
    return false
  }

  if (!(type in BufferHeader)) return false

  let buffer = BufferHeader[type]!

  if (buffer.constructor === Blob) return buffer

  buffer = window.atob(buffer as string)

  const UInt = new Uint8Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) UInt[i] = buffer.charCodeAt(i)

  return (BufferHeader[type] = new Blob([UInt]))
}
