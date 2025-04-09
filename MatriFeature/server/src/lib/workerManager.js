import  mediasoup from 'mediasoup';
import  {router,numWorkers,worker,webRtcTransport} from '../config/mediasoup.js';

class WorkerManager {
  constructor() {
    this.workers = [];
    this.nextWorkerIndex = 0;
  }

  async init() {
 
    console.log(`Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker1 = await mediasoup.createWorker({
        ...worker,
        rtcMinPort: worker.rtcMinPort + (i * 1000),
        rtcMaxPort: worker.rtcMinPort + ((i + 1) * 1000) - 1
      });

      worker1.on('died', () => {
        console.error(`Worker ${worker1.pid} died, exiting in 2 seconds... [pid:${process.pid}]`);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker1);
      console.log(`Worker ${i + 1}/${numWorkers} created [pid:${worker1.pid}]`);
    }
  }

  getNextWorker() {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async closeAll() {
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers = [];
    this.nextWorkerIndex = 0;
  }
}

export default new WorkerManager();