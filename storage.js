// Local storage utilities for QuizGen
// Handles storing quiz data, chat messages, and user activities locally

const DB_NAME = 'quizgen_local';
const DB_VERSION = 1;

class LocalStorage {
    constructor() {
        this.db = null;
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            // Create object stores when database is first created
            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for quiz attempts
                if (!db.objectStoreNames.contains('quizAttempts')) {
                    db.createObjectStore('quizAttempts', { keyPath: 'id', autoIncrement: true });
                }

                // Store for chat messages
                if (!db.objectStoreNames.contains('chatMessages')) {
                    const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id', autoIncrement: true });
                    chatStore.createIndex('groupId', 'groupId');
                    chatStore.createIndex('timestamp', 'timestamp');
                }

                // Store for uploaded notes
                if (!db.objectStoreNames.contains('notes')) {
                    db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    // Save a quiz attempt locally
    async saveQuizAttempt(quizData) {
        const store = this.db.transaction('quizAttempts', 'readwrite').objectStore('quizAttempts');
        quizData.timestamp = Date.now();
        quizData.synced = false;
        return store.add(quizData);
    }

    // Save a chat message locally
    async saveChatMessage(message) {
        const store = this.db.transaction('chatMessages', 'readwrite').objectStore('chatMessages');
        message.timestamp = Date.now();
        message.synced = false;
        return store.add(message);
    }

    // Save uploaded notes locally
    async saveNote(noteData) {
        const store = this.db.transaction('notes', 'readwrite').objectStore('notes');
        noteData.timestamp = Date.now();
        noteData.synced = false;
        return store.add(noteData);
    }

    // Get all quiz attempts
    async getQuizAttempts() {
        const store = this.db.transaction('quizAttempts', 'readonly').objectStore('quizAttempts');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get chat messages for a specific group
    async getChatMessages(groupId) {
        const store = this.db.transaction('chatMessages', 'readonly').objectStore('chatMessages');
        const index = store.index('groupId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(groupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all notes
    async getNotes() {
        const store = this.db.transaction('notes', 'readonly').objectStore('notes');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get storage usage stats
    async getStorageStats() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentUsed: (estimate.usage / estimate.quota) * 100
            };
        }
        return null;
    }

    // Backup unsynced data to server
    async backupToServer(serverUrl) {
        const unsyncedQuizzes = await this.getUnsyncedData('quizAttempts');
        const unsyncedMessages = await this.getUnsyncedData('chatMessages');
        const unsyncedNotes = await this.getUnsyncedData('notes');

        try {
            // Attach JWT from localStorage when available
            const token = localStorage.getItem('jwt');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            // Instead of sending full blobs, send metadata summaries with approximate sizes
            const summarize = (arr) => {
                if (!arr || !Array.isArray(arr)) return null;
                return arr.map(item => ({
                    id: item.id || null,
                    timestamp: item.timestamp || null,
                    approxBytes: estimateBytes(item)
                }));
            };

            const payload = {
                quizzesMeta: summarize(unsyncedQuizzes),
                messagesMeta: summarize(unsyncedMessages),
                notesMeta: summarize(unsyncedNotes)
            };

            const response = await fetch(serverUrl.replace(/\/$/, '') + '/api/backup', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                // Mark items as synced
                await this.markAsSynced('quizAttempts', unsyncedQuizzes);
                await this.markAsSynced('chatMessages', unsyncedMessages);
                await this.markAsSynced('notes', unsyncedNotes);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Backup failed:', error);
            return false;
        }
    }

    // Get unsynced items from a store
    async getUnsyncedData(storeName) {
        const store = this.db.transaction(storeName, 'readonly').objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const unsynced = request.result.filter(item => !item.synced);
                resolve(unsynced);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Mark items as synced
    async markAsSynced(storeName, items) {
        const store = this.db.transaction(storeName, 'readwrite').objectStore(storeName);
        for (const item of items) {
            item.synced = true;
            store.put(item);
        }
    }
}

// Estimate serialized byte size for an object
function estimateBytes(obj) {
    try {
        const str = JSON.stringify(obj);
        // Rough UTF-8 byte length approximation
        return new Blob([str]).size;
    } catch (e) {
        return 0;
    }
}

// Helper for simple key-value storage (user preferences, settings)
const PreferencesStorage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
    },

    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return defaultValue;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    }
};

// Export storage instances
export const storage = new LocalStorage();
export const preferences = PreferencesStorage;