export class NetworkClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.handlers = new Map();
        this.isConnected = false;
        this.messageQueue = [];
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.addEventListener('open', () => {
                this.isConnected = true;
                resolve();
                this._emit('connected');
                this._flushQueue();
            });

            this.ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.type) {
                        this._emit(data.type, data.payload);
                    }
                } catch (error) {
                    console.error('Failed to parse message', error);
                }
            });

            this.ws.addEventListener('close', () => {
                this.isConnected = false;
                this._emit('disconnected');
            });

            this.ws.addEventListener('error', (error) => {
                console.error('WebSocket error', error);
                this.isConnected = false;
                reject(error);
                this._emit('error', { message: 'Unable to reach the game server.' });
            });
        });
    }

    send(type, payload = {}) {
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('WebSocket not connected. Queuing message.', type);
            this.messageQueue.push({ type, payload });
        }
    }

    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        const set = this.handlers.get(type);
        set.add(handler);
        return () => set.delete(handler);
    }

    _emit(type, payload) {
        const handlers = this.handlers.get(type);
        if (!handlers) {
            return;
        }
        handlers.forEach((handler) => {
            try {
                handler(payload);
            } catch (error) {
                console.error('Handler execution failed', error);
            }
        });
    }

    _flushQueue() {
        while (this.isConnected && this.messageQueue.length) {
            const message = this.messageQueue.shift();
            this.send(message.type, message.payload);
        }
    }
}
