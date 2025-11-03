declare module "jnaudiostream" {
  export class AudioRecorder {
    constructor(mediaConstraints?: MediaStreamConstraints, bufferDurationMs?: number)
    debug: boolean
    mediaRecorder?: MediaRecorder
    mediaStream?: MediaStream
    mediaGranted: boolean
    recordingReady: boolean
    recording: boolean
    onReady?: (packet: { mimeType: string; data: Blob }) => void
    onBuffer?: (packet: Array<Blob>) => void
    onRecordingReady?: (packet: { mimeType: string; data: Blob }) => void
    onBufferProcess?: (packet: Array<Blob>) => void
    startRecording(): Promise<void> | void
    stopRecording(): void
  }

  export class AudioStreamer {
    constructor(latencyMs?: number)
    debug: boolean
    playing: boolean
    latency: number
    mimeType?: string
    playStream(): void
    setBufferHeader(packet: { mimeType: string; data: ArrayBuffer | Blob }): void
    receiveBuffer(packet: Array<ArrayBuffer | Blob>): void
    stop(): void
  }
}
