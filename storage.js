class Storage {
    constructor(config) {
        this.config = config;
        this.store = [];
    }

    async getUserRecord(keyPair) {
        const key = Object.keys(keyPair).pop();
        const value = keyPair[key];
        const data = this.store.find(record => record[key] === value);
        return data && data.record;
    }

    async setUserRecord(keyPair, record) {
        const key = Object.keys(keyPair).pop();
        const value = keyPair[key];
        const data = { [key]: value, record };
        this.store.push(data);
        return data.record;
    }
}
module.exports = Storage;
