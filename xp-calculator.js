// xp-calculator.js

// IndexedDB Setup
const dbName = "flyingblueDB";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = function (event) {
  db = event.target.result;
  if (!db.objectStoreNames.contains("flights")) {
    db.createObjectStore("flights", { keyPath: "id", autoIncrement: true });
  }
};
request.onsuccess = function (event) {
  db = event.target.result;
  loadFlights();
};

// XP Chart
let chart;
function updateChart(data) {
  if (chart) chart.destroy();
  const ctx = document.getElementById("xpChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, i) => `Flight ${i + 1}`),
      datasets: [
        {
          label: "XP",
          data: data.map(f => f.xp),
          borderColor: "blue",
          fill: false
        }
      ]
    }
  });
}

function calculateXP(segments, cabin, roundtrip, doubleXP) {
  let totalXP = 0;

  segments.forEach(segment => {
    const zone = getZone(segment.origin, segment.destination);
    const xpMap = {
      economy:  [2, 5, 8, 10, 12],
      premium:  [4, 10, 16, 20, 24],
      business: [6, 15, 24, 30, 36],
      first:    [10, 25, 40, 50, 60]
    };

    let baseXP = xpMap[cabin][zone];
    if (roundtrip) baseXP *= 2;
    if (doubleXP) baseXP *= 2;

    totalXP += baseXP;
  });

  return totalXP;
}

function getZone(originCode, destinationCode) {
  const origin = airports.find(a => a.iata === originCode || a.icao === originCode);
  const destination = airports.find(a => a.iata === destinationCode || a.icao === destinationCode);

  if (!origin || !destination) return 4; // fallback to Long 3

  if (origin.country === destination.country) return 0; // Domestic

  // 判斷區域，不再計算 miles
  const distance = getDistance(origin.lat, origin.lon, destination.lat, destination.lon);
  if (distance < 2000) return 1;         // Medium
  if (distance < 3500) return 2;         // Long 1
  if (distance < 5000) return 3;         // Long 2
  return 4;                              // Long 3
}

function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function addFlightToTable(flight, id) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${flight.origin} → ${flight.stop1 || "-"} → ${flight.stop2 || "-"} → ${flight.destination}</td>
    <td>${flight.cabin}</td>
    <td>${flight.xp}</td>
    <td><button onclick="deleteFlight(${id})">Delete</button></td>
  `;
  document.querySelector("#flights-table tbody").appendChild(tr);
}

function deleteFlight(id) {
  const tx = db.transaction("flights", "readwrite");
  tx.objectStore("flights").delete(id);
  tx.oncomplete = () => loadFlights();
}

function loadFlights() {
  const tx = db.transaction("flights", "readonly");
  const store = tx.objectStore("flights");
  const request = store.getAll();
  request.onsuccess = () => {
    const tbody = document.querySelector("#flights-table tbody");
    tbody.innerHTML = "";
    let totalXP = 0;
    request.result.forEach(f => {
      addFlightToTable(f, f.id);
      totalXP += f.xp;
    });
    updateChart(request.result);
    updateStatus(totalXP);
  };
}

function updateStatus(totalXP) {
  const neededSilver = 100 - totalXP;
  const neededGold = 180 - totalXP;
  const neededPlat = 300 - totalXP;
  document.getElementById("status-info").textContent = `距離 Silver: ${Math.max(0, neededSilver)} XP | Gold: ${Math.max(0, neededGold)} XP | Platinum: ${Math.max(0, neededPlat)} XP`;
}

const form = document.getElementById("flight-form");
form.addEventListener("submit", function (e) {
  e.preventDefault();
  const origin = document.getElementById("origin").value.trim().toUpperCase();
  const stop1 = document.getElementById("stop1").value.trim().toUpperCase();
  const stop2 = document.getElementById("stop2").value.trim().toUpperCase();
  const destination = document.getElementById("destination").value.trim().toUpperCase();
  const cabin = document.getElementById("cabin").value;
  const roundtrip = document.getElementById("roundtrip").checked;
  const doubleXP = document.getElementById("doublexp").checked;

  const segments = [];
  if (origin && stop1) segments.push({ origin, destination: stop1 });
  if (stop1 && stop2) segments.push({ origin: stop1, destination: stop2 });
  if (stop2) segments.push({ origin: stop2, destination });
  else if (stop1) segments.push({ origin: stop1, destination });
  else segments.push({ origin, destination });

  const totalXP = calculateXP(segments, cabin, roundtrip, doubleXP);

  const tx = db.transaction("flights", "readwrite");
  tx.objectStore("flights").add({ origin, stop1, stop2, destination, cabin, roundtrip, doubleXP, xp: totalXP });
  tx.oncomplete = () => loadFlights();
});

// Export JSON
document.getElementById("export-json").addEventListener("click", () => {
  const tx = db.transaction("flights", "readonly");
  const store = tx.objectStore("flights");
  const req = store.getAll();
  req.onsuccess = () => {
    const data = JSON.stringify(req.result, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flights.json";
    a.click();
  };
});

// Import JSON
document.getElementById("import-json").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const imported = JSON.parse(reader.result);
    const tx = db.transaction("flights", "readwrite");
    const store = tx.objectStore("flights");
    imported.forEach(item => store.add(item));
    tx.oncomplete = () => loadFlights();
  };
  reader.readAsText(file);
});

// Airport Autocomplete Setup
function setupAirportAutocomplete(inputId, suggestionId) {
  const input = document.getElementById(inputId);
  const suggestionBox = document.getElementById(suggestionId);

  input.addEventListener("input", function () {
    const query = input.value.trim().toUpperCase();
    suggestionBox.innerHTML = "";
    if (query.length < 2) return;

    const matches = airports.filter(a =>
      a.code.startsWith(query) ||
      a.city.toUpperCase().includes(query) ||
      a.name.toUpperCase().includes(query)
    ).slice(0, 5);

    matches.forEach(airport => {
      const li = document.createElement("li");
      li.textContent = `${airport.code} - ${airport.city}, ${airport.country}`;
      li.addEventListener("click", () => {
        input.value = airport.code;
        suggestionBox.innerHTML = "";
      });
      suggestionBox.appendChild(li);
    });
  });

  input.addEventListener("blur", () => {
    setTimeout(() => suggestionBox.innerHTML = "", 200);
  });
}

setupAirportAutocomplete("origin", "origin-suggestions");
setupAirportAutocomplete("stop1", "stop1-suggestions");
setupAirportAutocomplete("stop2", "stop2-suggestions");
setupAirportAutocomplete("destination", "destination-suggestions");
