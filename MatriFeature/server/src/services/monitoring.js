const os = require('os');
const { Worker } = require('mediasoup');
const { logger } = require('./logger');
const config = require('../config/mediasoup');

class MonitoringService {
  constructor() {
    this.metrics = {
      cpu: {
        usage: 0,
        timestamp: Date.now()
      },
      memory: {
        usage: 0,
        timestamp: Date.now()
      },
      network: {
        bitrate: 0,
        timestamp: Date.now()
      },
      security: {
        failedAuthAttempts: 0,
        lastFailedAttempt: null
      }
    };

    this.alerts = [];
    this.startMonitoring();
  }

  async startMonitoring() {
    setInterval(() => this.checkMetrics(), config.performance.cpu.checkInterval);
  }

  async checkMetrics() {
    try {
      // Check CPU usage
      const cpuUsage = await this.getCpuUsage();
      if (cpuUsage > config.performance.cpu.maxUsage) {
        this.alert('high_cpu', `CPU usage is high: ${cpuUsage}%`);
      }

      // Check memory usage
      const memoryUsage = await this.getMemoryUsage();
      if (memoryUsage > config.performance.memory.maxUsage) {
        this.alert('high_memory', `Memory usage is high: ${memoryUsage}%`);
      }

      // Check network usage
      const networkUsage = await this.getNetworkUsage();
      if (networkUsage > config.performance.network.maxBitrate) {
        this.alert('high_network', `Network usage is high: ${networkUsage}bps`);
      }

      // Update metrics
      this.metrics = {
        cpu: { usage: cpuUsage, timestamp: Date.now() },
        memory: { usage: memoryUsage, timestamp: Date.now() },
        network: { usage: networkUsage, timestamp: Date.now() },
        security: this.metrics.security
      };

      logger.info('Monitoring metrics updated', { metrics: this.metrics });
    } catch (error) {
      logger.error('Error checking metrics:', error);
    }
  }

  async getCpuUsage() {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => {
      return acc + Object.values(cpu.times).reduce((a, b) => a + b);
    }, 0);
    return 100 - (totalIdle / totalTick) * 100;
  }

  async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return ((total - free) / total) * 100;
  }

  async getNetworkUsage() {
    // This is a simplified version. In production, you'd want to use a more accurate method
    const networkInterfaces = os.networkInterfaces();
    let totalBytes = 0;
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (!iface.internal) {
          totalBytes += iface.bytes;
        }
      }
    }
    return totalBytes;
  }

  alert(type, message) {
    const alert = {
      type,
      message,
      timestamp: Date.now()
    };
    this.alerts.push(alert);
    logger.warn('Alert triggered:', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  recordSecurityEvent(event) {
    if (event.type === 'auth_failure') {
      this.metrics.security.failedAuthAttempts++;
      this.metrics.security.lastFailedAttempt = Date.now();
      
      if (this.metrics.security.failedAuthAttempts > 5) {
        this.alert('security', 'Multiple failed authentication attempts detected');
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      alerts: this.alerts
    };
  }

  resetMetrics() {
    this.metrics = {
      cpu: { usage: 0, timestamp: Date.now() },
      memory: { usage: 0, timestamp: Date.now() },
      network: { usage: 0, timestamp: Date.now() },
      security: {
        failedAuthAttempts: 0,
        lastFailedAttempt: null
      }
    };
    this.alerts = [];
  }
}

module.exports = new MonitoringService(); 