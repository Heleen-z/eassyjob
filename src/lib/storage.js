import { defaultTopics, fingerprint, mergeBackup, validateBackup } from './data.js';

const databaseName = 'job-library';
let databasePromise;
let channel;
const subscribers = new Set();

function storageError(message, code = 'STORAGE', cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function channelForChanges() {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('job-library-changes');
    channel.onmessage = () => {
      for (const callback of subscribers) callback();
    };
  }
  return channel;
}

function notifyChanged() {
  channelForChanges()?.postMessage({ changed: true });
  for (const callback of subscribers) callback();
}

export function subscribeLibrary(callback) {
  if (typeof callback !== 'function') throw new TypeError('订阅回调必须是函数');
  subscribers.add(callback);
  channelForChanges();
  return () => subscribers.delete(callback);
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (!globalThis.indexedDB) {
    return Promise.reject(storageError('当前浏览器无法使用本地资料存储', 'STORAGE_UNAVAILABLE'));
  }
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let settled = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('topics')) {
        const store = db.createObjectStore('topics', { keyPath: 'id' });
        for (const topic of defaultTopics) store.add(topic);
      }
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      settled = true;
      reject(storageError('无法打开本地资料库', 'STORAGE', request.error));
    };
    request.onblocked = () => {
      settled = true;
      reject(storageError('请关闭此应用的旧标签页后重试', 'STORAGE_BLOCKED'));
    };
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function transaction(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let result;
    let failure;
    const tx = db.transaction(['topics', 'records'], mode);
    const topicStore = tx.objectStore('topics');
    const recordStore = tx.objectStore('records');
    const topicRequest = topicStore.getAll();
    const recordRequest = recordStore.getAll();
    let completedReads = 0;
    const readComplete = () => {
      completedReads += 1;
      if (completedReads !== 2) return;
      try {
        result = operation(
          { topics: topicRequest.result, records: recordRequest.result },
          { topicStore, recordStore },
        );
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    topicRequest.onsuccess = readComplete;
    recordRequest.onsuccess = readComplete;
    tx.oncomplete = () => {
      resolve(result);
      if (mode === 'readwrite') notifyChanged();
    };
    tx.onabort = () => reject(failure ?? storageError('保存失败，输入内容尚未保存', 'STORAGE', tx.error));
    tx.onerror = () => { /* The abort event returns the final transaction failure. */ };
  });
}

function orderTopics(topics) {
  const order = new Map(defaultTopics.map((topic, index) => [topic.id, index]));
  return [...topics].sort((left, right) =>
    (order.get(left.id) ?? 100) - (order.get(right.id) ?? 100)
    || left.name.localeCompare(right.name, 'zh-CN'));
}

export function loadLibrary() {
  return transaction('readonly', (library) => ({
    topics: orderTopics(library.topics),
    records: library.records,
  }));
}

// Pure preparation keeps the edit and duplicate rules testable without replacing IndexedDB.
export function prepareRecordSave(record, library, { allowDuplicate = false } = {}) {
  const previous = library.records.find((existing) => existing.id === record.id);
  const candidate = { ...record, createdAt: previous?.createdAt ?? record.createdAt };
  const incoming = validateBackup({
    schemaVersion: 1, topics: library.topics, records: [candidate],
  }).records[0];
  const key = fingerprint(incoming);
  const duplicate = library.records.find((existing) =>
    existing.id !== incoming.id && fingerprint(existing) === key);
  if (duplicate && !allowDuplicate) {
    const error = storageError('这条资料已经保存过', 'DUPLICATE');
    error.record = duplicate;
    throw error;
  }
  return incoming;
}

export function saveRecord(record, { allowDuplicate = false } = {}) {
  return transaction('readwrite', (library, { recordStore }) => {
    const incoming = prepareRecordSave(record, library, { allowDuplicate });
    recordStore.put(incoming);
    return incoming;
  });
}

export function deleteRecord(id) {
  return transaction('readwrite', (_library, { recordStore }) => {
    if (typeof id !== 'string' || !id.trim()) throw storageError('资料 ID 无效', 'VALIDATION');
    recordStore.delete(id);
  });
}

export function saveTopic(topic) {
  return transaction('readwrite', (library, { topicStore }) => {
    const incoming = validateBackup({ schemaVersion: 1, topics: [topic], records: [] }).topics[0];
    const name = incoming.name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '');
    const duplicate = library.topics.find((existing) => existing.id !== incoming.id
      && existing.name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '') === name);
    if (duplicate) {
      const error = storageError('这个主题已经存在', 'DUPLICATE_TOPIC');
      error.topic = duplicate;
      throw error;
    }
    topicStore.put(incoming);
    return incoming;
  });
}

export function restoreBackup(backup) {
  let validated;
  try {
    validated = validateBackup(backup);
  } catch (error) {
    return Promise.reject(error);
  }
  return transaction('readwrite', (library, { topicStore, recordStore }) => {
    const merged = mergeBackup(library, validated);
    for (const topic of merged.topics) topicStore.put(topic);
    for (const record of merged.records) recordStore.put(record);
    return merged;
  });
}
