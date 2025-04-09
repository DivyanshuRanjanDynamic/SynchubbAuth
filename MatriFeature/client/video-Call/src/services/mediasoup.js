import { Device } from 'mediasoup-client';
import { socketService } from './socket';
import { logger } from './logger';

class MediasoupService {
  constructor() {
    this.device = null;
    this.roomId = null;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.producers = new Map();
    this.consumers = new Map();
    this.localStream = null;
    this.remoteStreams = new Map();
    this.screenStream = null;
    this.qualityLevels = {
      low: { maxBitrate: 250000, resolution: { width: 320, height: 240 } },
      medium: { maxBitrate: 500000, resolution: { width: 640, height: 480 } },
      high: { maxBitrate: 1000000, resolution: { width: 1280, height: 720 } }
    };
    this.currentQuality = 'high';
  }

  async initialize(roomId) {
    try {
      this.roomId = roomId;
      
      // Get router RTP capabilities
      const { routerRtpCapabilities } = await socketService.request('getRouterRtpCapabilities', { roomId });
      
      // Load device
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities });
      
      logger.info('Mediasoup device initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Mediasoup device:', error);
      throw error;
    }
  }

  async createProducerTransport() {
    try {
      const { transportOptions } = await socketService.request('createWebRtcTransport', {
        roomId: this.roomId,
        forceTcp: false
      });

      this.producerTransport = this.device.createSendTransport(transportOptions);

      this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketService.request('connectTransport', {
            roomId: this.roomId,
            transportId: this.producerTransport.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      this.producerTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await socketService.request('produce', {
            roomId: this.roomId,
            transportId: this.producerTransport.id,
            kind,
            rtpParameters,
            appData
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      logger.info('Created producer transport');
      return this.producerTransport;
    } catch (error) {
      logger.error('Failed to create producer transport:', error);
      throw error;
    }
  }

  async createConsumerTransport() {
    try {
      const { transportOptions } = await socketService.request('createWebRtcTransport', {
        roomId: this.roomId,
        forceTcp: false
      });

      this.consumerTransport = this.device.createRecvTransport(transportOptions);

      this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketService.request('connectTransport', {
            roomId: this.roomId,
            transportId: this.consumerTransport.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      logger.info('Created consumer transport');
      return this.consumerTransport;
    } catch (error) {
      logger.error('Failed to create consumer transport:', error);
      throw error;
    }
  }

  async initializeLocalStream(constraints = { audio: true, video: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      logger.info('Local media stream initialized successfully');
      return this.localStream;
    } catch (error) {
      logger.error('Failed to initialize local stream:', error);
      throw error;
    }
  }

  async setStreamQuality(quality) {
    try {
      if (!this.qualityLevels[quality]) {
        throw new Error(`Invalid quality level: ${quality}`);
      }

      this.currentQuality = quality;
      const qualityConfig = this.qualityLevels[quality];

      // Update video track constraints
      const videoTrack = this.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        await videoTrack.applyConstraints({
          width: qualityConfig.resolution.width,
          height: qualityConfig.resolution.height
        });
      }

      // Update producer encodings
      const videoProducer = this.producers.get('video');
      if (videoProducer) {
        await videoProducer.setMaxSpatialLayer(quality === 'high' ? 2 : quality === 'medium' ? 1 : 0);
        await videoProducer.setMaxBitrate(qualityConfig.maxBitrate);
      }

      logger.info(`Stream quality set to ${quality}`);
    } catch (error) {
      logger.error('Failed to set stream quality:', error);
      throw error;
    }
  }

  async produceMedia(stream) {
    try {
      if (!this.producerTransport) {
        throw new Error('Producer transport not created');
      }

      this.localStream = stream;
      const qualityConfig = this.qualityLevels[this.currentQuality];

      // Produce audio
      if (stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        const audioProducer = await this.producerTransport.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
            opusFec: true
          }
        });
        this.producers.set('audio', audioProducer);
      }

      // Produce video
      if (stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const videoProducer = await this.producerTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: qualityConfig.maxBitrate },
            { maxBitrate: qualityConfig.maxBitrate / 2 },
            { maxBitrate: qualityConfig.maxBitrate / 4 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: qualityConfig.maxBitrate / 1000
          }
        });
        this.producers.set('video', videoProducer);
      }

      logger.info('Started producing media');
    } catch (error) {
      logger.error('Failed to produce media:', error);
      throw error;
    }
  }

  async consumeMedia(producerId, kind) {
    try {
      if (!this.consumerTransport) {
        throw new Error('Consumer transport not created');
      }

      const { rtpCapabilities } = this.device;
      const { consumerParameters } = await socketService.request('consume', {
        roomId: this.roomId,
        transportId: this.consumerTransport.id,
        producerId,
        rtpCapabilities
      });

      const consumer = await this.consumerTransport.consume({
        id: consumerParameters.id,
        producerId: consumerParameters.producerId,
        kind: consumerParameters.kind,
        rtpParameters: consumerParameters.rtpParameters
      });

      // Create a new MediaStream for this consumer
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      
      this.consumers.set(producerId, consumer);
      this.remoteStreams.set(producerId, stream);

      // Set up consumer events
      consumer.on('trackended', () => {
        this.handleTrackEnded(producerId);
      });

      consumer.on('transportclose', () => {
        this.handleTransportClose(producerId);
      });

      logger.info(`Started consuming ${kind} from producer ${producerId}`);
      return { consumer, stream };
    } catch (error) {
      logger.error(`Failed to consume ${kind} from producer ${producerId}:`, error);
      throw error;
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      // Stop existing video producer if any
      const videoProducer = this.producers.get('video');
      if (videoProducer) {
        videoProducer.close();
        this.producers.delete('video');
      }

      // Produce screen share
      const videoTrack = this.screenStream.getVideoTracks()[0];
      const screenProducer = await this.producerTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 2000000 },
          { maxBitrate: 1000000 },
          { maxBitrate: 500000 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 2000
        }
      });

      this.producers.set('screen', screenProducer);

      // Handle screen sharing stop
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      logger.info('Started screen sharing');
      return this.screenStream;
    } catch (error) {
      logger.error('Failed to start screen sharing:', error);
      throw error;
    }
  }

  handleTrackEnded(producerId) {
    try {
      const consumer = this.consumers.get(producerId);
      if (consumer) {
        consumer.close();
        this.consumers.delete(producerId);
      }

      const stream = this.remoteStreams.get(producerId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.remoteStreams.delete(producerId);
      }

      logger.info(`Track ended for producer ${producerId}`);
    } catch (error) {
      logger.error(`Failed to handle track ended for producer ${producerId}:`, error);
    }
  }

  handleTransportClose(producerId) {
    try {
      const consumer = this.consumers.get(producerId);
      if (consumer) {
        consumer.close();
        this.consumers.delete(producerId);
      }

      const stream = this.remoteStreams.get(producerId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.remoteStreams.delete(producerId);
      }

      logger.info(`Transport closed for producer ${producerId}`);
    } catch (error) {
      logger.error(`Failed to handle transport close for producer ${producerId}:`, error);
    }
  }

  async stopScreenShare() {
    try {
      const screenProducer = this.producers.get('screen');
      if (screenProducer) {
        screenProducer.close();
        this.producers.delete('screen');
      }

      // Resume camera if available
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          const videoProducer = await this.producerTransport.produce({
            track: videoTrack,
            encodings: [
              { maxBitrate: 1000000 },
              { maxBitrate: 500000 },
              { maxBitrate: 250000 }
            ],
            codecOptions: {
              videoGoogleStartBitrate: 1000
            }
          });
          this.producers.set('video', videoProducer);
        }
      }

      logger.info('Stopped screen sharing');
    } catch (error) {
      logger.error('Failed to stop screen sharing:', error);
      throw error;
    }
  }

  async toggleAudio(enabled) {
    try {
      const audioProducer = this.producers.get('audio');
      if (audioProducer) {
        audioProducer.track.enabled = enabled;
        logger.info(`Audio ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      logger.error('Failed to toggle audio:', error);
      throw error;
    }
  }

  async toggleVideo(enabled) {
    try {
      const videoProducer = this.producers.get('video');
      if (videoProducer) {
        videoProducer.track.enabled = enabled;
        logger.info(`Video ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      logger.error('Failed to toggle video:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Close all producers
      this.producers.forEach(producer => producer.close());
      this.producers.clear();

      // Close all consumers
      this.consumers.forEach(consumer => consumer.close());
      this.consumers.clear();

      // Close transports
      if (this.producerTransport) {
        this.producerTransport.close();
        this.producerTransport = null;
      }

      if (this.consumerTransport) {
        this.consumerTransport.close();
        this.consumerTransport = null;
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Stop screen stream
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      // Clear remote streams
      this.remoteStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      this.remoteStreams.clear();

      logger.info('Cleaned up all Mediasoup resources');
    } catch (error) {
      logger.error('Failed to cleanup Mediasoup resources:', error);
      throw error;
    }
  }
}

export const mediasoupService = new MediasoupService(); 