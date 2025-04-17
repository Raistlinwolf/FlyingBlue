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
        },
        {
          label: "Miles",
          data: data.map(f => f.miles),
          borderColor: "green",
          fill: false
        }
      ]
    }
  });
}

function calculateXP(segment, cabin, roundtrip, doubleXP) {
  // Simplified based on Flying Blue region matrix
  const zone = getZone(segment);
  const xpMap = {
    economy: [4, 6, 10, 12, 15],
    premium: [6, 9, 15, 18, 24],
    business: [12, 18, 30, 36, 45],
    first: [15, 24, 40, 50, 60]
  };
  let baseXP = xpMap[cabin][zone];
  if (roundtrip) baseXP *= 2;
  if (doubleXP) baseXP *= 2;
  return baseXP;
}

function calculateMiles(segment) {
  return Math.round(Math.random() * 8000) + 1000; // Placeholder
}

function getZone(segment) {
  const domestic = ["AMS", "CDG", "FRA"];
  const medium = ["LHR", "BCN", "MAD"];
  const long1 = ["JFK", "CAI", "DXB"];
  const long2 = ["BKK", "SIN", "DEL"];
  const long3 = ["SYD", "LAX", "CPT"];
  if (domestic.includes(segment)) return 0;
  if (medium.includes(segment)) return 1;
  if (long1.includes(segment)) return 2;
  if (long2.includes(segment)) return 3;
  return 4;
}

function addFlightToTable(flight, id) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${flight.origin} → ${flight.stop1 || "-"} → ${flight.stop2 || "-"} → ${flight.destination}</td>
    <td>${flight.cabin}</td>
    <td>${flight.xp}</td>
    <td>${flight.miles}</td>
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
    let totalMiles = 0;
    request.result.forEach(f => {
      addFlightToTable(f, f.id);
      totalXP += f.xp;
      totalMiles += f.miles;
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

// Add flight event
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
  const segments = [origin];
  if (stop1) segments.push(stop1);
  if (stop2) segments.push(stop2);
  segments.push(destination);

  const totalXP = segments.length * calculateXP(destination, cabin, roundtrip, doubleXP);
  const totalMiles = segments.length * calculateMiles(destination);

  const tx = db.transaction("flights", "readwrite");
  tx.objectStore("flights").add({ origin, stop1, stop2, destination, cabin, roundtrip, doubleXP, xp: totalXP, miles: totalMiles });
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
