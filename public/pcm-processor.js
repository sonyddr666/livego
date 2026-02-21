class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.bufferSize = 2048; // Reduced from 4096 for lower latency
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0];
        for (let i = 0; i < channelData.length; i++) {
            this.buffer.push(channelData[i]);
        }

        if (this.buffer.length >= this.bufferSize) {
            const chunk = new Float32Array(this.buffer);
            this.port.postMessage(chunk);
            this.buffer = [];
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
