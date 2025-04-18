import { getFromCache, saveToCache } from './airportCache.js';

let airports = [];

export async function setupAirportAutocomplete(inputEl, onSelect) {
  if (airports.length === 0) {
    // 嘗試從緩存中獲取機場資料
    const cachedAirports = await getFromCache('airports');
    if (cachedAirports) {
      airports = cachedAirports;
    } else {
      // 從 OpenFlights 或 OurAirports 下載資料
      const response = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
      const text = await response.text();
      airports = parseAirportsData(text);

      // 將資料保存到緩存，有效期30天
      await saveToCache('airports', airports, 30 * 24 * 60 * 60 * 1000);
    }
  }

  const container = document.createElement('div');
  container.className = 'autocomplete-dropdown';
  inputEl.parentNode.appendChild(container);

  inputEl.addEventListener('input', () => {
    const val = inputEl.value.trim().toUpperCase();
    container.innerHTML = "";

    if (!val) return;

    // 過濾符合輸入值的機場資料
    const results = airports.filter(ap =>
      ap.iata.toUpperCase().includes(val) ||
      ap.city.toUpperCase().includes(val) ||
      ap.name.toUpperCase().includes(val)
    ).slice(0, 10); // 限制最多顯示10個結果

    // 建立下拉選單項目
    results.forEach(ap => {
      const div = document.createElement('div');
      div.textContent = `${ap.city}, ${ap.name} (${ap.iata})`;
      div.addEventListener('click', () => {
        inputEl.value = `${ap.city}, ${ap.name} (${ap.iata})`;
        onSelect(ap);
        container.innerHTML = "";
      });
      container.appendChild(div);
    });
  });

  inputEl.addEventListener('blur', () => setTimeout(() => container.innerHTML = "", 200));
}

function parseAirportsData(data) {
  return data.split('\n').map(line => {
    const fields = line.split(',');
    return {
      iata: fields[4]?.replace(/"/g, ''),
      city: fields[2]?.replace(/"/g, ''),
      name: fields[1]?.replace(/"/g, ''),
      lat: parseFloat(fields[6]),
      lon: parseFloat(fields[7])
    };
  }).filter(ap => ap.iata && ap.city && ap.name);
}
