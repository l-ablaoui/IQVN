class Readers_writers {
    constructor() {
        this.readers = 0; // Count of current readers
        this.writers = 0; // Count of active writers
        this.readQueue = []; // Queue for readers waiting to read
        this.writeQueue = []; // Queue for writers waiting to write
    }

    async readLock() {
        return new Promise(resolve => {
            const attemptRead = () => {
                if (this.writers === 0) {
                    this.readers++;
                    resolve(this); // Grant access
                } else {
                    this.readQueue.push(attemptRead);
                }
            };
            attemptRead();
        });
    }

    async writeLock() {
        return new Promise(resolve => {
            const attemptWrite = () => {
                if (this.readers === 0 && this.writers === 0) {
                    this.writers++;
                    resolve(this); // Grant access
                } else {
                    this.writeQueue.push(attemptWrite);
                }
            };
            attemptWrite();
        });
    }

    unlockRead() {
        this.readers--;
        this._next();
    }

    unlockWrite() {
        this.writers--;
        this._next();
    }

    _next() {
        // Check the next queue
        if (this.writeQueue.length > 0) {
            this.writeQueue.shift()(); // Allow the next writer
        } else if (this.readQueue.length > 0) {
            this.readQueue.shift()(); // Allow the next reader
        }
    }
}

export default Readers_writers;