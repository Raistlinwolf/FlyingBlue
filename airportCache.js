(async () => {
  const DB_NAME = 'airportCache';
  const STORE_NAME = 'cache';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getFromCache(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() < result.expiry) {
          resolve(result.value);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function saveToCache(key, value, ttl) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ key, value, expiry: Date.now() + ttl });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  const fetchGeoFromLeaflet = async (query) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'YourApp/1.0' } });
    const json = await res.json();
    const item = json.find(loc => loc.lat && loc.lon);
    return item ? { lat: parseFloat(item.lat), lon: parseFloat(item.lon) } : null;
  };

  // 公開函式：查找機場經緯度（優先使用 cache，其次 Leaflet）
  window.getLatLon = async (code) => {
    const airports = Array.isArray(window.airports) ? window.airports : [];
    const airport = airports.find(a => a.iata === code || a.icao === code);
    if (airport) return { lat: airport.lat, lon: airport.lon };

    const fallbackAirport = (window.airports || []).find(a => a.iata === code || a.icao === code);
    if (fallbackAirport) return { lat: fallbackAirport.lat, lon: fallbackAirport.lon };

    const cached = await getFromCache(code);
    if (cached) return { lat: cached.lat, lon: cached.lon };

    const geo = await fetchGeoFromLeaflet(code);
    if (geo) await saveToCache(code, geo, 30 * 24 * 60 * 60 * 1000); // 30天
    return geo;
  };

  // 顯示格式：Taipei, Taiwan Taoyuan International (TPE)
  window.getFormatted = (code) => {
    const airport = (window.airports || []).find(a => a.iata === code || a.icao === code);
    return airport
      ? `${airport.city}, ${airport.country} ${airport.name} (${airport.iata})`
      : code;
  };

  // 快取過期清理：清除超過30天的資料
  const clearExpired = async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const now = Date.now();
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      const { expiry } = cursor.value;
      if (now > expiry) cursor.delete();
      cursor.continue();
    };
  };

  clearExpired(); // 初始化時清理一次
})();
