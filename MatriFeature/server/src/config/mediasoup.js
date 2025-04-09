const os = require('os');

module.exports = {
    // Worker settings
    worker: {
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp'
        ],
    },

    // Router settings
    router: {
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                parameters: {
                    useinbandfec: 1,
                    usedtx: 1,
                    stereo: 1,
                    'sprop-stereo': 1
                }
            },
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                    'x-google-start-bitrate': 1000,
                    'x-google-min-bitrate': 500,
                    'x-google-max-bitrate': 2000
                }
            },
            {
                kind: 'video',
                mimeType: 'video/H264',
                clockRate: 90000,
                parameters: {
                    'packetization-mode': 1,
                    'profile-level-id': '42e01f',
                    'level-asymmetry-allowed': 1
                }
            }
        ]
    },

    // WebRTC transport settings
    webRtcTransport: {
        listenIps: [
            {
                ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP
            }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxSctpMessageSize: 262144,
        // Additional ICE settings
        iceServers: [
            {
                urls: process.env.TURN_SERVER_URL || 'stun:stun.l.google.com:19302'
            }
        ],
        iceTransportPolicy: 'all',
        enableIceTcp: true
    },

    // Plain transport settings (for RTP recording)
    plainTransport: {
        listenIp: {
            ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
            announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP
        },
        maxSctpMessageSize: 262144
    },

    // Recording settings
    recording: {
        enabled: process.env.RECORDING_ENABLED === 'true',
        path: process.env.RECORDING_PATH || '/recordings',
        maxSize: 1024 * 1024 * 1024 // 1GB
    },

    // Security settings
    security: {
        // Rate limiting
        rateLimit: {
            enabled: true,
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        },
        // CORS settings
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
        },
        // Authentication
        auth: {
            enabled: true,
            tokenExpiration: '1h'
        }
    },

    // Performance settings
    performance: {
        // CPU usage limits
        cpu: {
            maxUsage: 0.8, // 80% max CPU usage
            checkInterval: 5000 // Check every 5 seconds
        },
        // Memory usage limits
        memory: {
            maxUsage: 0.8, // 80% max memory usage
            checkInterval: 5000 // Check every 5 seconds
        },
        // Network usage limits
        network: {
            maxBitrate: 2000000, // 2Mbps max bitrate
            checkInterval: 1000 // Check every second
        }
    },

    // Monitoring settings
    monitoring: {
        enabled: true,
        port: process.env.MONITORING_PORT || 8888,
        secret: process.env.MONITORING_SECRET
    }
};