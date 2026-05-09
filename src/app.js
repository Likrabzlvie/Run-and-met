// src/app.js
import "./style.css";
import {
  auth,
  provider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  db,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  getDocFromServer,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  getDoc,
  deleteDoc,
} from "./firebase.js";

// ==========================================
// 1. MOCK DATA ARCHITECTURE
// ==========================================

const usersMockData = [
  {
    id: "u1",
    name: "Alex Runner",
    username: "@alexr",
    age: 28,
    avatar_url: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    level: "Advanced",
    favoriteActivity: "Trail Running",
    bio: "Love hitting the trails early in the morning. Always looking for pacing buddies.",
    followersCount: 145,
    followingCount: 89,
    isVerified: true,
    reviews: [
      { author: "Jamie", rating: 5, text: "Great pacer!" },
      { author: "Sam", rating: 4, text: "Fun to run with but fast." },
    ],
  },
  {
    id: "u2",
    name: "Sam Hiker",
    username: "@samhikes",
    age: 32,
    avatar_url: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    level: "Intermediate",
    favoriteActivity: "Hiking",
    bio: "Weekend warrior. Exploring new peaks.",
    followersCount: 42,
    followingCount: 100,
    isVerified: false,
    reviews: [{ author: "Alex", rating: 5, text: "Awesome local guide." }],
  },
  {
    id: "u3",
    name: "Jamie Jogger",
    username: "@jamiej",
    age: 25,
    avatar_url: "https://i.pravatar.cc/150?u=a042581f4e29026703d",
    level: "Beginner",
    favoriteActivity: "Running",
    bio: "Just getting into 5ks. Friendly pace.",
    followersCount: 200,
    followingCount: 250,
    isVerified: true,
    reviews: [{ author: "Alex", rating: 4, text: "Very consistent pace." }],
  },
];

let currentUser = {
  id: "u0",
  name: "You (Active)",
  username: "@myrunner",
  age: 30,
  avatar_url: "https://i.pravatar.cc/150?u=me",
  level: "Intermediate",
  favoriteActivity: "Running",
  bio: "Looking to build mileage and meet cool people.",
  followersCount: 12,
  followingCount: 15,
  isVerified: true,
  reviews: [
    { author: "Alex", rating: 5, text: "Great running partner!" },
    { author: "Sam", rating: 4, text: "Very reliable and punctual." },
  ],
};

usersMockData.push(currentUser);

let runsData = [];

async function fetchRunDatabase(
  apiUrl = "https://raw.githubusercontent.com/Likrabzlvie/GPX/refs/heads/main/output/database.json",
) {
  // Show skeletons in the start-run-list if taking time
  const startRunContainer = document.getElementById("start-run-list");
  if (startRunContainer) {
    startRunContainer.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
  }

  try {
    let response;
    try {
      response = await fetch(apiUrl + "?t=" + new Date().getTime(), {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Bad response status from GitHub: " + response.status);
    } catch (err) {
      console.warn(
        `Failed to fetch from GitHub (${err.message}). Falling back to local /database.json...`,
      );
      response = await fetch("/database.json");
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch runs database: ${response.status} ${response.statusText}.`,
      );
    }
    let data = await response.json();

    if (data && !Array.isArray(data)) {
      // Just in case the JSON is wrapped in an object
      data = data.runs || data.features || data.data || Object.values(data);
    }

    if (!Array.isArray(data)) {
      data = [];
    }

    // Normalize coordinates and filter invalid runs
    runsData = data
      .map((r, i) => {
        let lat = r.lat;
        let lng = r.lng;

        // Support new GitHub format
        if (r.start_coordinates) {
          lat = r.start_coordinates.latitude;
          lng = r.start_coordinates.longitude;
        } else if (r.latitude !== undefined) {
          lat = r.latitude;
          lng = r.lon !== undefined ? r.lon : r.longitude;
        }

        let path = r.path || [];

        // If it's a GeoJSON feature
        if (r.type === "Feature" && r.geometry) {
          if (r.geometry.type === "LineString") {
            const coords = r.geometry.coordinates;
            if (coords && coords.length > 0) {
              lng = coords[0][0];
              lat = coords[0][1];
              // Convert [lng, lat] to [lat, lng] for Leaflet
              path = coords.map((c) => [c[1], c[0]]);
            }
          } else if (r.geometry.type === "Point") {
            lng = r.geometry.coordinates[0];
            lat = r.geometry.coordinates[1];
          }
          r.properties = r.properties || {};
        }

        // Map properties consistently
        const distVal = r.distance_km
          ? `${r.distance_km} km`
          : r.distance || r.properties?.distance || "0 km";
        let gpxVal = r.download_url || r.gpxUrl || r.properties?.gpxUrl;
        if (gpxVal && !gpxVal.startsWith("http")) {
          gpxVal =
            "https://raw.githubusercontent.com/Likrabzlvie/GPX/refs/heads/main/" +
            gpxVal.replace(/^\/+/, "");
        }

        return {
          id: r.id || r.properties?.id || "run-" + i,
          title: r.title || r.properties?.title || "Run",
          difficulty:
            r.difficulty || r.properties?.difficulty || "Intermédiaire",
          type: r.type || r.properties?.type || "Courses",
          distance: distVal,
          gpxUrl: gpxVal,
          ...r,
          ...(r.properties || {}),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          path: path,
        };
      })
      .filter((r) => !isNaN(r.lat) && !isNaN(r.lng));

    console.log("Static API fully loaded with " + runsData.length + " runs.");
    if (map) {
      renderMarkers();
    }
  } catch (err) {
    console.error("Error fetching database:", err.message);
  }
}

let chatsMockData = {
  r2: [
    {
      senderId: "u2",
      text: "Excited for the hike this weekend!",
      timestamp: "10:00 AM",
    },
    { senderId: "u0", text: "Me too! Bringing snacks.", timestamp: "10:05 AM" },
  ],
  u1: [
    {
      senderId: "u1",
      text: "Hey, do you want to join my 5k tomorrow?",
      timestamp: "Yesterday",
    },
    { senderId: "u0", text: "I'll let you know!", timestamp: "Yesterday" },
  ],
};

// ==========================================
// 2. STATE & GLOBALS
// ==========================================

let map;
let currentBaseLayer = null;
let isSatellite = false;
let markerClusterGroup = null;
let markers = [];
let backgroundPolylines = [];
let currentPolyline = null;
let currentPingMarker = null;
let currentView = "view-map";
let activeChatId = null;

const difficultyColors = {
  Débutant: "#10B981",
  Intermédiaire: "#F59E0B",
  Pro: "#FF2A85",
  "Fou du bus": "#8B5CF6",
};

// ==========================================
// 3. CORE UTILITIES
// ==========================================

function getActivityIcon(activity) {
  const normalized = activity.toLowerCase();
  if (normalized.includes("trail"))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mountain"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;
  if (normalized.includes("trek"))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>`;
  if (normalized.includes("randonnée") || normalized.includes("hiking"))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-footprints"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
}

function getDifficultyClass(difficulty) {
  const norm = difficulty.toLowerCase();
  if (norm.includes("débutant") || norm.includes("easy")) return "debutant";
  if (norm.includes("intermédiaire") || norm.includes("intermediaire"))
    return "intermediaire";
  if (norm.includes("pro") || norm.includes("hard")) return "pro";
  if (norm.includes("fou")) return "fou";
  return "debutant";
}

function getUser(id) {
  return usersMockData.find((u) => u.id === id);
}

window.clearMapFocus = function () {
  document.getElementById("side-panel").classList.remove("panel-active");

  if (currentPolyline && map) {
    map.removeLayer(currentPolyline);
    currentPolyline = null;
  }
  if (currentPingMarker && map) {
    map.removeLayer(currentPingMarker);
    currentPingMarker = null;
  }

  // Bring back all markers
  if (markerClusterGroup) {
    if (!map.hasLayer(markerClusterGroup)) {
      map.addLayer(markerClusterGroup);
    }
  } else {
    markers.forEach((m) => {
      if (!map.hasLayer(m)) map.addLayer(m);
    });
  }
};

function switchView(viewId) {
  window.clearMapFocus();
  document
    .querySelectorAll(".view")
    .forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === viewId);
  });
  document.getElementById(viewId).classList.add("active");
  currentView = viewId;

  if (viewId === "view-map" && map) {
    setTimeout(() => map.invalidateSize(), 100);
  } else if (viewId === "view-profile") {
    renderProfileView();
  } else if (viewId === "view-chat") {
    renderChatList();
    document.getElementById("chat-list-container").classList.remove("hidden");
    document.getElementById("chat-room-container").classList.add("hidden");
  } else if (viewId === "view-start") {
    renderStartRunList();
  }
}

window.navigateWithLoader = function (targetTabId, callback) {
  const loader = document.getElementById("page-loader");
  const loaderPath = loader.querySelector(".route-path");

  const length = loaderPath.getTotalLength() || 300;

  // Reset path animation
  loaderPath.style.transition = "none";
  loaderPath.style.strokeDasharray = length + " " + length;
  loaderPath.style.strokeDashoffset = length;
  loaderPath.getBoundingClientRect(); // trigger reflow

  // Show overlay
  loader.classList.add("active");

  // Trigger drawing animation
  setTimeout(() => {
    loaderPath.style.transition =
      "stroke-dashoffset 1.2s cubic-bezier(0.25, 1, 0.5, 1)";
    loaderPath.style.strokeDashoffset = "0";

    // Switch view halfway through or after drawing
    setTimeout(() => {
      switchView(targetTabId);
      if (callback) callback();

      // Hide loader overlay
      setTimeout(() => {
        loader.classList.remove("active");
      }, 300);
    }, 1200);
  }, 50);
};

function renderStartRunList() {
  const container = document.getElementById("start-run-list");
  if (!container) return;

  if (!currentUser.id) {
    container.innerHTML =
      '<p style="color:var(--text-secondary); text-align:center;">Please sign in to see your runs.</p>';
    return;
  }

  // Find runs where user is a participant or organizer
  const myJoinedRuns = runsData.filter(
    (r) => r.organizerId === currentUser.id || r.isAddedToMyRuns,
  );

  if (myJoinedRuns.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-secondary); text-align:center;">You haven\'t joined any runs yet.</p>';
    return;
  }

  container.innerHTML = myJoinedRuns
    .map((run) => {
      // Generate pseudo-random status based on run id character code sum
      const charSum = run.id
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isFull = charSum % 3 === 0;

      return `
      <div class="run-card route-card" style="background: var(--glass-bg); backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">${run.title}</h3>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 12px;">
            <span class="status-dot ${isFull ? "full" : "open"}"></span>
            ${isFull ? "Au complet" : "Places dispo"}
          </div>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${run.date || "TBD"} • ${run.meetingPoint || "Start"}</p>
        <button class="btn btn-primary btn-liquid" style="margin-top: 8px;" onclick="handleLiquidClick(event, () => startNavigation('${run.id}', '${run.gpxUrl || ""}'))"><span class="btn-text">START</span></button>
      </div>
    `;
    })
    .join("");

  setTimeout(
    () => initTiltEffect(container.querySelectorAll(".route-card")),
    50,
  );
}

// ==========================================
// 4. MAP & DISCOVERY
// ==========================================

function initMap() {
  if (map) return;

  const osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    },
  );

  const topoLayer = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
      maxZoom: 17,
    },
  );

  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EAP, and the GIS User Community",
      maxZoom: 19,
    },
  );

  map = L.map("map", {
    zoomControl: false,
    layers: [topoLayer], // Set Topo as the default starting map
  }).setView([45.77607, 3.04889], 13);

  map.on("click", () => {
    window.clearMapFocus();
  });

  currentBaseLayer = topoLayer;

  const baseMaps = {
    "Relief & Chemins": topoLayer,
    Classique: osmLayer,
    Satellite: satelliteLayer,
  };

  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  map.on("baselayerchange", function (e) {
    if (e.name === "Satellite") {
      isSatellite = true;
      document.body.classList.add("satellite-mode");
    } else {
      isSatellite = false;
      document.body.classList.remove("satellite-mode");
    }
  });

  markerClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div class="cluster-glow"><span>${count}</span></div>`,
        className: "custom-cluster-icon",
        iconSize: L.point(44, 44),
        iconAnchor: L.point(22, 52),
      });
    },
  });
  map.addLayer(markerClusterGroup);

  // Add map event for fetching when panning
  map.on("moveend", async () => {
    const bounds = map.getBounds();
    const fetchedRuns = await fetchRunsForArea(bounds);
    // Integrate fetched runs into current data pool if needed
    // ...
  });

  renderMarkers("discovery");
}

function renderMarkers(filterType) {
  if (markerClusterGroup) {
    markerClusterGroup.clearLayers();
  } else {
    markers.forEach((m) => map.removeLayer(m));
  }
  markers = [];

  backgroundPolylines.forEach((p) => map.removeLayer(p));
  backgroundPolylines = [];

  if (currentPolyline) {
    map.removeLayer(currentPolyline);
    currentPolyline = null;
  }
  if (currentPingMarker) {
    map.removeLayer(currentPingMarker);
    currentPingMarker = null;
  }

  const isDiscovery = filterType
    ? filterType === "discovery"
    : document.getElementById("btn-discovery").classList.contains("active");
  let runsToShow = isDiscovery
    ? runsData
    : runsData.filter((r) => r.isAddedToMyRuns);

  // Apply filters
  let minDist = 1;
  let maxDist = 200;
  const sliderEl = document.getElementById("filter-distance-slider");
  if (sliderEl && sliderEl.noUiSlider) {
    const vals = sliderEl.noUiSlider.get();
    minDist = parseFloat(vals[0]);
    maxDist = parseFloat(vals[1]);
  }
  const diffFilter = document.getElementById("filter-difficulty").value;
  const typeFilter = document.getElementById("filter-type").value;

  runsToShow = runsToShow.filter((run) => {
    const runDist = parseFloat(run.distance); // e.g. "5 km" -> 5
    if (!isNaN(runDist) && (runDist < minDist || runDist > maxDist))
      return false;
    if (diffFilter !== "All" && run.difficulty !== diffFilter) return false;
    if (typeFilter !== "All" && run.type !== typeFilter) return false;
    return true;
  });

  runsToShow.forEach((run) => {
    const diffClass = getDifficultyClass(run.difficulty);
    const svgIcon = getActivityIcon(run.type);

    const customIcon = L.divIcon({
      className: "custom-neon-marker",
      html: `
        <div class="map-pin ${diffClass}">
           ${svgIcon}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 38],
    });

    const marker = L.marker([run.lat, run.lng], { icon: customIcon });

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      focusRun(run);
    });

    marker._runId = run.id;
    if (markerClusterGroup) {
      markerClusterGroup.addLayer(marker);
    } else {
      marker.addTo(map);
    }
    markers.push(marker);

    // Draw trace in the background
    if (run.path && run.path.length > 0) {
      const traceColor = difficultyColors[run.difficulty] || "#FF7A00";
      const poly = L.polyline(run.path, {
        color: traceColor,
        weight: 3,
        opacity: 0.4, // lower opacity so it doesn't clutter
        lineCap: "round",
        lineJoin: "round",
        interactive: false, // dont block clicks on map
      }).addTo(map);
      backgroundPolylines.push(poly);
    }
  });

  if (runsToShow.length > 0) {
    if (markerClusterGroup) {
      const bounds = markerClusterGroup.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 0.8 });
      }
    } else {
      const group = new L.featureGroup(markers);
      map.flyToBounds(group.getBounds(), { padding: [50, 50], duration: 0.8 });
    }
  }
}

function focusRun(run) {
  // 1. Render and open the side panel immediately
  renderSidePanel(run);

  // 2. Clear all markers from the map
  if (markerClusterGroup && map.hasLayer(markerClusterGroup)) {
    map.removeLayer(markerClusterGroup);
  } else {
    markers.forEach((m) => {
      if (map.hasLayer(m)) map.removeLayer(m);
    });
  }

  // 3. (Current marker highlight is no longer necessary as loadGPXTrack adds currentPingMarker)

  // 4. Clear current map layers (GPX track and ping)
  if (currentPolyline) {
    map.removeLayer(currentPolyline);
    currentPolyline = null;
  }
  if (currentPingMarker) {
    map.removeLayer(currentPingMarker);
    currentPingMarker = null;
  }

  // 5. Load GPX from download_url (new format) or gpxUrl
  const url = run.gpxUrl;

  if (url) {
    loadGPXTrack(url, run);
  } else if (run.path && run.path.length > 0) {
    // Legacy fallback for embedded paths
    currentPolyline = L.polyline(run.path, {
      color: difficultyColors[run.difficulty] || "#FF7A00",
      weight: 5,
      opacity: 0.9,
      className: `neon-path ${getDifficultyClass(run.difficulty)}`,
    }).addTo(map);

    const isDesktop = window.innerWidth >= 768;
    const paddingBottomRight = isDesktop
      ? [380, 100]
      : [50, window.innerHeight * 0.5];

    // Create a fallback start marker if we don't have GPX
    const pingIcon = L.divIcon({
      className: "custom-neon-marker",
      html: `
        <div class="map-pin ${getDifficultyClass(run.difficulty)}">
           ${getActivityIcon(run.type)}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    currentPingMarker = L.marker([run.lat, run.lng], { icon: pingIcon }).addTo(
      map,
    );

    map.flyToBounds(currentPolyline.getBounds(), {
      paddingTopLeft: [50, 50],
      paddingBottomRight: paddingBottomRight,
      duration: 0.8,
    });
  }
}

const weatherEmojiMap = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  85: "❄️",
  86: "❄️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

async function fetchWeather(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    const temp = Math.round(data.current_weather.temperature);
    const code = data.current_weather.weathercode;
    const emoji = weatherEmojiMap[code] || "🌡️";
    return `Météo actuelle : ${temp}°C ${emoji}`;
  } catch (err) {
    console.error("Error fetching weather:", err);
    return "Météo : Indisponible";
  }
}

function renderSidePanel(run) {
  const panel = document.getElementById("side-panel");
  const content = document.getElementById("side-panel-content");

  // Safe fallbacks for new JSON structure
  const organizer = getUser(run.organizerId) || currentUser;
  const participants = run.participants || [];
  const runDate = run.date || "TBD";
  const meetingPoint = run.meetingPoint || "Start Coordinates";
  const elevation = run.elevation_gain_m
    ? `${run.elevation_gain_m}m D+`
    : "0m D+";

  let avatarsHtml = participants
    .map((pId) => {
      const p = getUser(pId);
      return p
        ? `<img src="${p.avatar_url}" alt="${p.name}" data-userid="${p.id}" class="clickable-avatar" />`
        : "";
    })
    .join("");

  content.innerHTML = `
    <div class="run-detail-header">
      <h3>${run.title}</h3>
      <p style="display:flex; align-items:center; gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ${runDate} &nbsp; <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg> ${meetingPoint}</p>
      <p id="run-weather-container" style="display:flex; align-items:center; gap:6px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Chargement météo...</p>
      <div style="margin-top: 12px; display: flex; gap: 10px; font-size: 0.8rem; flex-wrap: wrap;">
        <span class="tag-diff" style="color: var(--text-primary); border: 1px solid var(--glass-border); box-shadow: none;">${getActivityIcon(run.type)} ${run.type}</span>
        <span class="tag-diff" style="color: var(--text-primary); border: 1px solid var(--glass-border); box-shadow: none;">${run.distance || run.distance_km + " km"}</span>
        <span class="tag-diff" style="color: var(--text-primary); border: 1px solid var(--glass-border); box-shadow: none;">Dénivelé : ${elevation}</span>
        <span class="tag-diff ${getDifficultyClass(run.difficulty)}">${run.difficulty}</span>
      </div>
    </div>
    
    <div class="profile-section">
      <h4>Organizer</h4>
      <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" class="clickable-avatar" data-userid="${organizer.id}">
        <img src="${organizer.avatar_url}" style="width: 40px; border-radius: 50%;" />
        <div>
          <div style="font-weight: 600;">${organizer.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">${organizer.level}</div>
        </div>
      </div>
    </div>

    <div class="profile-section" id="dynamic-participants-container">
      <h4>Participants</h4>
      <div class="participant-avatars">
        <span style="font-size:0.85rem; color:var(--text-secondary);">Loading...</span>
      </div>
    </div>

    <div class="profile-section" style="display:flex; justify-content: space-between; align-items:center;" id="dynamic-likes-container">
      <div style="display:flex; align-items:center; gap: 8px;">
        <button id="btn-like-run" class="btn btn-secondary" style="background: none; border: 1px solid var(--glass-border); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: var(--text-primary); cursor: pointer; transition: all 0.2s;" onclick="toggleRunLike('${run.id}')">
          <svg id="heart-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
        <span id="run-likes-count" style="font-weight:600; font-size: 0.9rem;">...</span>
      </div>
    </div>

    <div class="action-buttons" style="display:flex; flex-direction:column; gap:8px;">
      <div style="display: flex; gap: 8px;">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${run.lat},${run.lng}" target="_blank" class="action-btn btn-secondary" style="flex:1; text-decoration: none; text-align:center;">View Maps</a>
        <button class="action-btn btn-secondary" style="flex:1;" onclick="startNavigation('${run.id}', '${run.gpxUrl || ""}')">Live Nav + SOS</button>
      </div>
      <div id="dynamic-action-container" style="display: flex;">
        <button class="action-btn btn-secondary" disabled style="width: 100%;">Loading...</button>
      </div>
    </div>
    
    <div class="profile-section" style="margin-top:20px;" id="dynamic-reviews-container">
      <h4 style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
        Reviews 
        <span id="run-reviews-avg" style="font-size:0.9rem; font-weight:normal; color:var(--text-secondary);">No reviews yet</span>
      </h4>
      <div id="runs-reviews-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; max-height:150px; overflow-y:auto;">
        <span style="font-size:0.85rem; color:var(--text-secondary);">Loading...</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap: 4px; color: var(--accent-orange);" id="review-stars-input">
          ${[1, 2, 3, 4, 5].map((i) => `<span class="star-rating-btn" data-val="${i}" style="cursor:pointer; font-size:1.2rem;" onclick="setReviewRating(event, ${i})">☆</span>`).join("")}
        </div>
        <input type="hidden" id="review-rating-val" value="0" />
        <textarea id="review-comment-input" placeholder="Leave a review..." style="width:100%; padding:8px; border-radius:8px; border:1px solid var(--glass-border); outline:none; background:var(--glass-bg); color:var(--text-primary); resize:none; font-family:inherit; font-size:0.85rem;" rows="2"></textarea>
        <button id="btn-submit-review" class="btn btn-secondary" onclick="submitRunReview('${run.id}')">Submit Review</button>
      </div>
    </div>
  `;

  panel.classList.add("panel-active");

  listenToRunSession(run.id);

  content.querySelectorAll(".clickable-avatar").forEach((img) => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      openUserProfile(e.currentTarget.dataset.userid);
    });
  });

  const weatherContainer = document.getElementById("run-weather-container");
  if (weatherContainer && run.lat && run.lng) {
    fetchWeather(run.lat, run.lng).then((res) => {
      weatherContainer.innerText = res;
    });
  }
}

// ==========================================
// 5. CHAT SYSTEM
// ==========================================

window.renderChatList = async function () {
  const container = document.getElementById("chat-list");

  if (!auth.currentUser) {
    container.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); margin-top:20px;">Please sign in to view chats.</p>';
    return;
  }

  container.innerHTML =
    '<p style="text-align:center; color: var(--text-secondary); margin-top:20px;">Loading...</p>';

  try {
    const sessionsSnap = await getDocs(collection(db, "runs_sessions"));
    const joinedRuns = [];
    sessionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const participants = data.participants || [];
      if (participants.some((p) => p.uid === auth.currentUser.uid)) {
        joinedRuns.push(docSnap.id);
      }
    });

    if (joinedRuns.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); margin-top:20px;">You haven\'t joined any runs yet.</p>';
      return;
    }

    container.innerHTML = "";

    joinedRuns.forEach((runId) => {
      const run = runsData.find((r) => r.id === runId);
      const title = run ? run.title : "Group Run Chat";
      const avatar = "https://i.pravatar.cc/150?u=group";

      const div = document.createElement("div");
      div.className = "chat-item";
      div.innerHTML = `
        <img src="${avatar}" class="chat-item-avatar" />
        <div class="chat-item-info">
          <h4>${title}</h4>
          <p><i>Group Chat</i></p>
        </div>
      `;
      div.addEventListener("click", () =>
        window.openGroupChatRoom(runId, title),
      );
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error fetching chats:", err);
    container.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); margin-top:20px;">Error loading chats.</p>';
  }
};

window.openGroupChatRoom = function (runId, title) {
  const openChat = () => {
    document.getElementById("chat-list-container").classList.add("hidden");
    const room = document.getElementById("chat-room-container");
    room.classList.remove("hidden");

    activeChatId = runId;
    document.getElementById("chat-room-title").textContent = title;

    // Detach previous chat if any
    if (window.currentGroupChatListener) {
      window.currentGroupChatListener();
      window.currentGroupChatListener = null;
    }

    const container = document.getElementById("chat-messages");
    container.innerHTML = "";

    const messagesRef = collection(db, `runs_sessions/${runId}/group_messages`);
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    window.currentGroupChatListener = onSnapshot(q, (snapshot) => {
      container.innerHTML = "";
      snapshot.docs.forEach((docSnap) => {
        const msg = docSnap.data();
        const msgId = docSnap.id;
        const isMine =
          auth.currentUser && msg.senderId === auth.currentUser.uid;

        const div = document.createElement("div");
        div.className = `chat-bubble ${isMine ? "sent" : "received"}`;

        let contentHtml = msg.text || "";

        if (msg.type === "poll" && msg.poll) {
          contentHtml = `<strong style="display:block;margin-bottom:8px;">📊 Poll: ${msg.poll.question}</strong><div style="display:flex;flex-direction:column;gap:6px;">`;
          msg.poll.options.forEach((opt, idx) => {
            const hasVoted =
              auth.currentUser &&
              opt.votes &&
              opt.votes.includes(auth.currentUser.uid);
            const voteCount = opt.votes ? opt.votes.length : 0;
            const fmtDate =
              new Date(opt.text).toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
              }) || opt.text;

            contentHtml += `
              <div style="background: var(--glass-bg); border: 1px solid ${hasVoted ? "var(--accent-orange)" : "var(--glass-border)"}; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: var(--text-primary);" onclick="votePollOption('${msgId}', ${idx})">
                <span>${fmtDate}</span>
                <div style="display:flex; align-items:center; gap: 4px;">
                  <span style="font-size:0.8rem; background: var(--glass-bg); padding: 2px 6px; border-radius: 12px;">${voteCount}</span>
                  ${hasVoted ? '<span style="color:var(--accent-orange);">✓</span>' : ""}
                </div>
              </div>
            `;
          });
          contentHtml += `</div>`;
        }

        div.innerHTML = `
          ${!isMine ? `<span class="chat-bubble-sender">${msg.senderName || "Unknown"}</span>` : ""}
          ${contentHtml}
        `;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    });
  };

  if (currentView !== "view-chat") {
    window.navigateWithLoader("view-chat", openChat);
  } else {
    openChat();
  }
};

document
  .getElementById("btn-send-message")
  .addEventListener("click", sendActiveGroupMessage);
document.getElementById("chat-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendActiveGroupMessage();
});

async function sendActiveGroupMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !activeChatId || !auth.currentUser) return;

  const messagesRef = collection(
    db,
    `runs_sessions/${activeChatId}/group_messages`,
  );
  try {
    input.value = "";
    await addDoc(messagesRef, {
      senderId: auth.currentUser.uid,
      senderName: auth.currentUser.displayName || "Runner",
      text: text,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

// === POLL LOGIC ===
document.getElementById("btn-create-poll")?.addEventListener("click", () => {
  document.getElementById("poll-modal-overlay").classList.remove("hidden");
});
document.getElementById("close-poll-modal")?.addEventListener("click", () => {
  document.getElementById("poll-modal-overlay").classList.add("hidden");
});
document
  .getElementById("btn-add-poll-option")
  ?.addEventListener("click", () => {
    const container = document.getElementById("poll-options-container");
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.gap = "8px";
    div.innerHTML = `<input type="datetime-local" class="poll-option-input" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-primary);" />`;
    container.appendChild(div);
  });

document
  .getElementById("btn-submit-poll")
  ?.addEventListener("click", async () => {
    const question = document.getElementById("poll-question").value.trim();
    const optionsInputs = document.querySelectorAll(".poll-option-input");
    const options = [];
    optionsInputs.forEach((input) => {
      if (input.value) options.push(input.value);
    });

    if (
      !question ||
      options.length === 0 ||
      !activeChatId ||
      !auth.currentUser
    ) {
      alert("Please enter a question and at least one valid date/time option.");
      return;
    }

    const messagesRef = collection(
      db,
      `runs_sessions/${activeChatId}/group_messages`,
    );
    try {
      const pollData = {
        question: question,
        options: options.map((opt) => ({ text: opt, votes: [] })),
      };
      await addDoc(messagesRef, {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || "Runner",
        text: `Created a poll: ${question}`,
        type: "poll",
        poll: pollData,
        timestamp: serverTimestamp(),
      });

      document.getElementById("poll-modal-overlay").classList.add("hidden");
      document.getElementById("poll-question").value = "";
      optionsInputs.forEach((input) => (input.value = ""));
    } catch (err) {
      console.error("Error creating poll:", err);
    }
  });

window.votePollOption = async function (messageId, optionIndex) {
  if (!auth.currentUser || !activeChatId) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(
    db,
    `runs_sessions/${activeChatId}/group_messages`,
    messageId,
  );

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    if (!data.poll) return;

    let pollOptions = [...data.poll.options];
    let currentOption = pollOptions[optionIndex];

    if (currentOption.votes.includes(uid)) {
      // Remove vote
      currentOption.votes = currentOption.votes.filter((id) => id !== uid);
    } else {
      // Add vote
      currentOption.votes.push(uid);
    }

    await updateDoc(docRef, {
      poll: {
        ...data.poll,
        options: pollOptions,
      },
    });
  } catch (err) {
    console.error("Error voting:", err);
  }
};
// ==================

// ==========================================
// 6. PROFILE SYSTEM
// ==========================================

function getStarSvg(type) {
  if (type === "full") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:inline-block; vertical-align:middle; margin-bottom:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  } else if (type === "half") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="url(#halfGradient)" stroke="none" style="display:inline-block; vertical-align:middle; margin-bottom:2px;">
      <defs>
        <linearGradient id="halfGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stop-color="currentColor"/>
          <stop offset="50%" stop-color="#4B5563"/>
        </linearGradient>
      </defs>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
  } else {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#4B5563" stroke="none" style="display:inline-block; vertical-align:middle; margin-bottom:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
}

function renderStarsHTML(rating) {
  const numAvg = parseFloat(rating);
  const fullStars = Math.floor(numAvg);
  const hasHalfStar = numAvg - fullStars > 0 && numAvg - fullStars <= 0.5;
  const isOverHalf = numAvg - fullStars > 0.5;

  const actualFullStars = fullStars + (isOverHalf ? 1 : 0);
  const emptyStars = 5 - actualFullStars - (hasHalfStar ? 1 : 0);

  let stars = getStarSvg("full").repeat(actualFullStars);
  if (hasHalfStar) stars += getStarSvg("half");
  stars += getStarSvg("empty").repeat(emptyStars);
  return stars;
}

function getAverageRating(reviews) {
  if (!reviews || reviews.length === 0) return { avg: "No ratings", stars: "" };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = (sum / reviews.length).toFixed(1);
  const stars = renderStarsHTML(avg);
  return { avg, stars };
}

window.showRelationships = function (type) {
  const overlay = document.getElementById("relationships-modal-overlay");
  const title = document.getElementById("relationships-title");
  const content = document.getElementById("relationships-content");

  overlay.classList.remove("hidden");
  title.innerText = type === "followers" ? "Followers" : "Following";

  // Create a mock list based on existing users
  let listHtml = "";
  usersMockData.forEach((u, i) => {
    // Just a varied list for demo purposes
    if (type === "followers" && i % 2 === 0) {
      listHtml += `
        <div class="user-row" style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px;" onclick="openUserProfile('${u.id}')">
          <img src="${u.avatar_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
          <div style="flex: 1;">
            <div style="font-weight: 600;">${u.name} ${u.isVerified ? '<span class="badge-verified" style="font-size:0.7rem; padding: 2px 4px;">✓</span>' : ""}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${u.username}</div>
          </div>
        </div>
      `;
    } else if (type === "following" && i % 3 !== 0) {
      listHtml += `
        <div class="user-row" style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; border-radius: 8px;" onclick="openUserProfile('${u.id}')">
          <img src="${u.avatar_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
          <div style="flex: 1;">
            <div style="font-weight: 600;">${u.name} ${u.isVerified ? '<span class="badge-verified" style="font-size:0.7rem; padding: 2px 4px;">✓</span>' : ""}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${u.username}</div>
          </div>
        </div>
      `;
    }
  });

  if (!listHtml)
    listHtml =
      '<div style="color:var(--text-secondary); text-align:center; padding: 20px;">No users found</div>';
  content.innerHTML = listHtml;
};

document
  .getElementById("close-relationships-modal")
  ?.addEventListener("click", () => {
    document
      .getElementById("relationships-modal-overlay")
      .classList.add("hidden");
  });

function renderProfileView() {
  const display = document.getElementById("profile-display");
  const edit = document.getElementById("profile-edit");

  display.classList.remove("hidden");
  edit.classList.add("hidden");

  const ratingData = getAverageRating(currentUser.reviews);

  display.innerHTML = `
    <div class="profile-header">
      <img src="${currentUser.avatar_url}" class="profile-avatar" />
      <h2 class="profile-name">
        ${currentUser.name} 
        ${currentUser.isVerified ? '<span class="badge-verified">Verified ✓</span>' : ""}
      </h2>
      <p class="profile-username" style="margin-bottom: 4px;">${currentUser.username}</p>
      <p style="font-size: 0.9rem; font-weight: 600; color: #fbbf24;">
        ${ratingData.avg} ${ratingData.stars}
      </p>
    </div>
    
    <div class="profile-stats">
      <div class="stat-box" onclick="showRelationships('followers')" style="cursor: pointer;">
        <div class="stat-value">${currentUser.followersCount}</div>
        <div class="stat-label">Followers</div>
      </div>
      <div class="stat-box" onclick="showRelationships('following')" style="cursor: pointer;">
        <div class="stat-value">${currentUser.followingCount}</div>
        <div class="stat-label">Following</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${currentUser.level}</div>
        <div class="stat-label">Level</div>
      </div>
    </div>
    
    <div class="profile-section">
      <h4>About Me</h4>
      <p>${currentUser.bio}</p>
      <p style="margin-top:12px; font-size: 0.9rem;">
        <span style="color: var(--accent-primary); font-weight: 600; text-shadow: 0 0 8px rgba(255, 122, 0, 0.4);">Favorite Activity:</span> <span style="display:inline-flex; align-items:center; gap:4px; vertical-align:middle;">${getActivityIcon(currentUser.favoriteActivity)} ${currentUser.favoriteActivity}</span>
      </p>
    </div>
    
    <button class="action-btn btn-secondary" id="btn-edit-profile" style="width:100%;">Edit Profile</button>
  `;

  document.getElementById("btn-edit-profile").addEventListener("click", () => {
    display.classList.add("hidden");
    edit.classList.remove("hidden");
    renderEditProfile();
  });
}

function renderEditProfile() {
  const edit = document.getElementById("profile-edit");
  edit.innerHTML = `
    <h3 style="margin-top:0;">Edit Profile</h3>
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="edit-name" value="${currentUser.name}" />
    </div>
    <div class="form-group">
      <label>Username</label>
      <input type="text" id="edit-username" value="${currentUser.username}" />
    </div>
    <div class="form-group">
      <label>Bio</label>
      <textarea id="edit-bio" rows="3">${currentUser.bio || ""}</textarea>
    </div>
    <div class="form-group">
      <label>Emergency Contact Number</label>
      <input type="tel" id="edit-emergency" placeholder="+33612345678" value="${currentUser.emergencyContactNumber || ""}" />
    </div>
    <div class="form-group">
      <label>Level</label>
      <input type="text" id="edit-level" value="${currentUser.level}" />
    </div>
     <div class="form-group">
      <label>Favorite Activity</label>
      <input type="text" id="edit-fav" value="${currentUser.favoriteActivity}" />
    </div>
    <div style="display:flex; gap:10px; margin-top:20px;">
      <button class="action-btn btn-secondary" id="btn-cancel-edit" style="flex:1;">Cancel</button>
      <button class="action-btn btn-primary" id="btn-save-edit" style="flex:1;">Save</button>
    </div>
  `;

  document
    .getElementById("btn-cancel-edit")
    .addEventListener("click", renderProfileView);

  document
    .getElementById("btn-save-edit")
    .addEventListener("click", async () => {
      currentUser.name = document.getElementById("edit-name").value;
      currentUser.username = document.getElementById("edit-username").value;
      currentUser.bio = document.getElementById("edit-bio").value;
      currentUser.emergencyContactNumber =
        document.getElementById("edit-emergency").value;
      currentUser.level = document.getElementById("edit-level").value;
      currentUser.favoriteActivity = document.getElementById("edit-fav").value;

      // Save to Firestore if authenticated
      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            name: currentUser.name,
            username: currentUser.username,
            bio: currentUser.bio,
            emergencyContactNumber: currentUser.emergencyContactNumber,
            level: currentUser.level,
            favoriteActivity: currentUser.favoriteActivity,
          });
        } catch (err) {
          console.error("Error updating profile in Firestore", err);
        }
      }

      const u = usersMockData.find((x) => x.id === currentUser.id);
      if (u) {
        u.name = currentUser.name;
        u.username = currentUser.username;
        u.bio = currentUser.bio;
        u.emergencyContactNumber = currentUser.emergencyContactNumber;
        u.level = currentUser.level;
        u.favoriteActivity = currentUser.favoriteActivity;
      }

      renderProfileView();
    });
}

// ==========================================
// 7. EXTERNAL USER PROFILE (MODAL)
// ==========================================

function openUserProfile(userId) {
  document
    .getElementById("relationships-modal-overlay")
    .classList.add("hidden");

  if (userId === currentUser.id) {
    if (currentView !== "view-profile") {
      window.navigateWithLoader("view-profile", () => {
        document.getElementById("side-panel").classList.remove("panel-active");
        document.getElementById("user-modal-overlay").classList.add("hidden");
      });
    } else {
      document.getElementById("side-panel").classList.remove("panel-active");
      document.getElementById("user-modal-overlay").classList.add("hidden");
    }
    return;
  }

  const user = getUser(userId);
  if (!user) return;

  const overlay = document.getElementById("user-modal-overlay");
  const content = document.getElementById("user-modal-content");

  const ratingData = getAverageRating(user.reviews);

  let reviewsHtml =
    user.reviews.length > 0
      ? user.reviews
          .map(
            (r) => `
      <div class="review-card">
        <div class="review-header">
          <strong>${r.author}</strong>
          <span class="review-rating" style="color: #fbbf24;">${renderStarsHTML(r.rating)}</span>
        </div>
        <p style="margin:0;font-size:0.9rem;color:var(--text-secondary);">${r.text}</p>
      </div>
    `,
          )
          .join("")
      : '<p style="color:var(--text-secondary); font-size:0.9rem;">No reviews yet.</p>';

  content.innerHTML = `
    <div class="profile-container" style="margin:0;">
      <div class="profile-header">
        <img src="${user.avatar_url}" class="profile-avatar" />
        <h2 class="profile-name">
          ${user.name}
          ${user.isVerified ? '<span class="badge-verified">Verified ✓</span>' : ""}
        </h2>
        <p class="profile-username" style="margin-bottom: 4px;">${user.username}</p>
        <p style="font-size: 0.9rem; font-weight: 600; color: #fbbf24;">
          ${ratingData.avg} ${ratingData.stars}
        </p>
      </div>
      
      <div class="profile-stats">
        <div class="stat-box" onclick="showRelationships('followers')" style="cursor: pointer;">
          <div class="stat-value">${user.followersCount}</div>
          <div class="stat-label">Followers</div>
        </div>
        <div class="stat-box" onclick="showRelationships('following')" style="cursor: pointer;">
          <div class="stat-value">${user.followingCount}</div>
          <div class="stat-label">Following</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${user.level}</div>
          <div class="stat-label">Level</div>
        </div>
      </div>
      
      <div class="profile-section">
        <h4>About</h4>
        <p style="font-size:0.9rem;">${user.bio}</p>
        <p style="margin-top:12px; font-size: 0.9rem;">
          <span style="color: var(--accent-primary); font-weight: 600; text-shadow: 0 0 8px rgba(255, 122, 0, 0.4);">Favorite Activity:</span> <span style="display:inline-flex; align-items:center; gap:4px; vertical-align:middle;">${getActivityIcon(user.favoriteActivity)} ${user.favoriteActivity}</span>
        </p>
      </div>
      
      <div class="profile-section">
        <h4>Community Reviews</h4>
        ${reviewsHtml}
      </div>
      
      <div class="action-buttons">
        <button class="action-btn btn-primary" id="modal-btn-follow">Follow</button>
        <button class="action-btn btn-secondary" id="modal-btn-message">Send Private Message</button>
      </div>
    </div>
  `;

  overlay.classList.remove("hidden");

  let isFollowing = false;
  const followBtn = document.getElementById("modal-btn-follow");
  followBtn.addEventListener("click", () => {
    isFollowing = !isFollowing;
    followBtn.textContent = isFollowing ? "Following" : "Follow";
    followBtn.className = `action-btn ${isFollowing ? "btn-secondary" : "btn-primary"}`;
  });

  document.getElementById("modal-btn-message").addEventListener("click", () => {
    overlay.classList.add("hidden");
    document.getElementById("side-panel").classList.remove("panel-active");
    if (!chatsMockData[user.id]) chatsMockData[user.id] = [];
    window.openPrivateChat(user.id, user.name);
  });
}
window.openUserProfile = openUserProfile;

// ==========================================
// 8. EVENT LISTENERS & INIT
// ==========================================

window.initTiltEffect = function (elements) {
  elements.forEach((card) => {
    card.style.transformStyle = "preserve-3d";
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      card.style.setProperty("--glare-x", `${glareX}%`);
      card.style.setProperty("--glare-y", `${glareY}%`);
      card.style.setProperty("--glare-opacity", "1");
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      card.style.setProperty("--glare-opacity", "0");
    });
  });
};

window.handleLiquidClick = function (event, callback) {
  const btn = event.currentTarget;
  if (
    btn.classList.contains("is-loading") ||
    btn.classList.contains("is-success")
  )
    return;

  // Save original text
  if (!btn.dataset.originalHtml) {
    btn.dataset.originalHtml = btn.innerHTML;
  }

  btn.classList.add("is-loading");

  setTimeout(() => {
    btn.classList.remove("is-loading");
    btn.classList.add("is-success");
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" style="margin:auto"><polyline points="20 6 9 17 4 12"/></svg>`;

    setTimeout(() => {
      if (callback) callback();
      // Optional: restore after 2s
      setTimeout(() => {
        if (btn.classList.contains("btn-liquid")) {
          btn.classList.remove("is-success");
          btn.innerHTML = btn.dataset.originalHtml;
        }
      }, 2000);
    }, 800);
  }, 1500);
};

function initAppLogic() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget.dataset.target;
      if (target !== currentView) {
        window.navigateWithLoader(target);
      }
    });
  });

  document.getElementById("btn-discovery").addEventListener("click", (e) => {
    e.target.classList.add("active");
    document.getElementById("btn-my-runs").classList.remove("active");
    renderMarkers("discovery");
  });

  document.getElementById("btn-my-runs").addEventListener("click", (e) => {
    e.target.classList.add("active");
    document.getElementById("btn-discovery").classList.remove("active");
    renderMarkers("my-runs");
  });

  document.getElementById("btn-back-to-chats").addEventListener("click", () => {
    document.getElementById("chat-list-container").classList.remove("hidden");
    document.getElementById("chat-room-container").classList.add("hidden");
    renderChatList();
  });

  // Filter Logic Initialization
  const updateFilters = () => renderMarkers();

  document
    .getElementById("btn-toggle-filters")
    .addEventListener("click", () => {
      const filterPanel = document.getElementById("filter-controls");
      filterPanel.classList.toggle("hidden");
    });

  document.getElementById("btn-import-gpx")?.addEventListener("click", () => {
    document.getElementById("gpx-file-input").click();
  });

  document.getElementById("gpx-file-input")?.addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process each selected file
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const gpxContent = event.target.result;

        // We will parse it dynamically and add it to runsData
        const newRunId = "uploaded-gpx-" + Date.now() + "-" + index;

        // Temporarily load it in Leaflet to extract metadata
        const tempGpxLayer = new L.GPX(gpxContent, { async: true });

        tempGpxLayer.on("loaded", function (e) {
          const l = e.target;
          const distKm = (l.get_distance() / 1000).toFixed(1);

          let center = [48.8566, 2.3522]; // default
          const bounds = l.getBounds();
          if (bounds.isValid()) {
            center = bounds.getCenter();
          }

          // Generate a new Run Object
          const newRun = {
            id: newRunId,
            title: file.name.replace(".gpx", ""),
            date: "Nouveau (Votre Trace)",
            meetingPoint: "Point de ralliement",
            lat: center.lat,
            lng: center.lng,
            difficulty:
              distKm > 20 ? "Pro" : distKm > 10 ? "Intermédiaire" : "Débutant",
            type: "Courses",
            duration: "N/A",
            distance: distKm + " km",
            isAddedToMyRuns: true, // Auto add to 'My Runs'
            gpxUrl:
              "data:application/gpx+xml;charset=utf-8," +
              encodeURIComponent(gpxContent),
            organizerId: currentUser.id,
            participants: [currentUser.id],
          };

          runsData.push(newRun);

          // Only re-render markers after the last one is processed
          if (index === files.length - 1) {
            alert(
              files.length +
                " tracks imported successfully! Switch to 'My Runs' to see them.",
            );
            renderMarkers(); // refresh
          }
        });
      };
      reader.readAsText(file);
    });

    // reset input
    e.target.value = null;
  });

  const distSliderElement = document.getElementById("filter-distance-slider");
  const distVal = document.getElementById("distance-val");

  if (distSliderElement && !distSliderElement.noUiSlider) {
    // noUiSlider initialization
    noUiSlider.create(distSliderElement, {
      start: [1, 200],
      connect: true,
      range: {
        min: 1,
        max: 200,
      },
      step: 1,
    });

    distSliderElement.noUiSlider.on("update", function (values, handle) {
      if (distVal) {
        distVal.textContent = `${Math.round(values[0])} - ${Math.round(values[1])}`;
      }
    });

    distSliderElement.noUiSlider.on("change", updateFilters);
  }
  document
    .getElementById("filter-difficulty")
    .addEventListener("change", updateFilters);
  document
    .getElementById("filter-type")
    .addEventListener("change", updateFilters);

  document.getElementById("close-side-panel").addEventListener("click", () => {
    window.clearMapFocus();
  });

  document.getElementById("close-user-modal").addEventListener("click", () => {
    document.getElementById("user-modal-overlay").classList.add("hidden");
  });

  // Intro Cinematic Animation
  const introCinematic = document.getElementById("intro-cinematic");
  if (introCinematic) {
    setTimeout(() => {
      // Use the page loader
      const loader = document.getElementById("page-loader");
      const loaderPath = loader?.querySelector(".route-path");

      if (loader && loaderPath) {
        loader.style.zIndex = "9999999";
        loader.style.background = "#0f0f13"; // Match intro background
        loader.classList.add("active");

        const length = loaderPath.getTotalLength() || 300;
        loaderPath.style.transition = "none";
        loaderPath.style.strokeDasharray = length + " " + length;
        loaderPath.style.strokeDashoffset = length;
        loaderPath.getBoundingClientRect();

        setTimeout(() => {
          loaderPath.style.transition =
            "stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1)";
          loaderPath.style.strokeDashoffset = "0";

          setTimeout(() => {
            introCinematic.remove();

            setTimeout(() => {
              loader.classList.remove("active");
              setTimeout(() => {
                loader.style.zIndex = "";
                loader.style.background = "";
              }, 400);
            }, 300);
          }, 1000);
        }, 50);
      } else {
        introCinematic.remove();
      }
    }, 8500); // Trigger transition right when scene 3 animation completes (4.5s + 4s = 8.5s)
  }

  // Auth Flow Logic
  const onboardingFlow = document.getElementById("onboarding-flow");
  const appContainer = document.getElementById("app");

  document
    .getElementById("btn-login-google")
    .addEventListener("click", async () => {
      try {
        const result = await signInWithPopup(auth, provider);
        // Save user to Firestore if new
        await setDoc(
          doc(db, "users", result.user.uid),
          {
            name: result.user.displayName,
            username:
              "@" + result.user.displayName.replace(/\s+/g, "").toLowerCase(),
            avatar_url: result.user.photoURL,
            isVerified: true,
          },
          { merge: true },
        );
      } catch (error) {
        console.error(error);
        alert("Login failed: " + error.message);
      }
    });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser.id = user.uid;
      currentUser.name = user.displayName;
      currentUser.username =
        "@" + user.displayName.replace(/\s+/g, "").toLowerCase();
      currentUser.avatar_url = user.photoURL;

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.emergencyContactNumber)
            currentUser.emergencyContactNumber =
              userData.emergencyContactNumber;
          if (userData.bio) currentUser.bio = userData.bio;
          if (userData.level) currentUser.level = userData.level;
          if (userData.favoriteActivity)
            currentUser.favoriteActivity = userData.favoriteActivity;
        }
      } catch (err) {
        console.error("Error fetching user profile", err);
      }

      onboardingFlow.classList.add("hidden");
      appContainer.classList.remove("hidden");
      window.navigateWithLoader("view-map", () => {
        setTimeout(async () => {
          initMap();
          await fetchRunDatabase();
          await window.syncUserJoinedRuns();
        }, 100);
      });
    } else {
      appContainer.classList.add("hidden");
      onboardingFlow.classList.remove("hidden");
    }
  });

  // Adding logout to profile logic (mocking the logout button)
  const profileContainer = document.getElementById("view-profile");
  if (profileContainer) {
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn btn-secondary";
    logoutBtn.style.marginTop = "24px";
    logoutBtn.style.width = "100%";
    logoutBtn.textContent = "Log Out";
    logoutBtn.addEventListener("click", () => {
      signOut(auth);
    });
    profileContainer.appendChild(logoutBtn);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppLogic);
} else {
  initAppLogic();
}

// ==========================================
// GPX & MAP MOCK API UPGRADES
// ==========================================

async function loadGPXTrack(url, runData) {
  console.log("Loading GPX track from:", url);

  if (currentPolyline) {
    map.removeLayer(currentPolyline);
    currentPolyline = null;
  }
  if (currentPingMarker) {
    map.removeLayer(currentPingMarker);
    currentPingMarker = null;
  }

  const trackColor = difficultyColors[runData.difficulty] || "#FF7A00";
  const difficultyClass = getDifficultyClass(runData.difficulty);

  // Immediately set the Ping marker so it doesn't disappear
  const pingIcon = L.divIcon({
    className: "custom-neon-marker",
    html: `
      <div class="map-pin ${difficultyClass}">
         ${getActivityIcon(runData.type)}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
  currentPingMarker = L.marker([runData.lat, runData.lng], {
    icon: pingIcon,
  }).addTo(map);

  currentPolyline = new L.GPX(url, {
    async: true,
    marker_options: {
      startIconUrl:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      endIconUrl:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      shadowUrl: "",
      wptIconUrls: {
        "": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="12" height="12"><circle cx="16" cy="16" r="14" fill="${encodeURIComponent(trackColor)}" stroke="%23ffffff" stroke-width="3" /><path d="M12 10 s1-1 3-1 4 2 6 2 3-1 3-1 v7 s-1 1-3 1-4-2-6-2-3 1-3 1 z" fill="%23ffffff" /><line x1="12" y1="9" x2="12" y2="23" stroke="%23ffffff" stroke-width="3" stroke-linecap="round" /></svg>`,
      },
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    },
    polyline_options: {
      color: trackColor,
      weight: 6,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      className: `neon-path ${difficultyClass}`,
    },
  })
    .on("loaded", function (e) {
      console.log("GPX Track loaded successfully:", url);
      const isDesktop = window.innerWidth >= 768;
      const paddingBottomRight = isDesktop
        ? [380, 100]
        : [50, window.innerHeight * 0.5];
      map.flyToBounds(e.target.getBounds(), {
        paddingTopLeft: [50, 50],
        paddingBottomRight: paddingBottomRight,
        duration: 0.8,
      });
    })
    .on("error", function (e) {
      console.error("GPX Load Error (404 or Invalid File):", url);
      // Alert is annoying but helpful for debugging user's GitHub mismatch
      // alert(`Erreur GPX: Impossible de charger le fichier.\nURL: ${url}`);
    })
    .addTo(map);
}

function fetchRunsForArea(bounds) {
  // Mock API simulating fetching GPX-based run objects for a given LatLngBounds
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate typical France bounds center: [46.6, 2.2]
      const fetchedRuns = [
        {
          id: "gpx-1",
          title: "Mont Blanc Trail Run",
          date: "15 Mai 2026",
          time: "10:00",
          meetingPoint: "Chamonix Base",
          distance: "25 km",
          type: "Trail",
          difficulty: "Pro",
          organizerId: 1,
          participants: [1, 2],
          gpxUrl:
            "https://raw.githubusercontent.com/mpetazolli/leaflet-gpx/master/demo/demo.gpx",
          lat: 45.9237,
          lng: 6.8694,
          isAddedToMyRuns: false,
        },
      ];
      resolve(fetchedRuns);
    }, 500);
  });
}

// ==========================================
// 8. FIRESTORE DYNAMIC RUN LOGIC
// ==========================================

let currentRunListener = null;

window.syncUserJoinedRuns = async function () {
  if (!auth.currentUser) return;
  try {
    const sessionsSnap = await getDocs(collection(db, "runs_sessions"));
    sessionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const runId = docSnap.id;
      const participants = data.participants || [];
      const runObj = runsData.find((r) => r.id === runId);
      if (runObj) {
        if (participants.some((p) => p.uid === auth.currentUser.uid)) {
          runObj.isAddedToMyRuns = true;
        } else {
          runObj.isAddedToMyRuns = false;
        }
      }
    });

    if (currentView === "view-map") {
      if (document.getElementById("btn-my-runs").classList.contains("active")) {
        renderMarkers("my-runs");
      } else {
        renderMarkers("discovery");
      }
    } else if (currentView === "view-start") {
      renderStartRunList();
    }
  } catch (err) {
    console.error("Error syncing joined runs:", err);
  }
};

window.joinRun = async function (runId) {
  if (!auth.currentUser) {
    alert("Please sign in first");
    return;
  }
  try {
    const user = auth.currentUser;
    const runRef = doc(db, "runs_sessions", runId);

    // Check if doc exists, if not create it
    const docSnap = await getDocFromServer(runRef);
    if (!docSnap.exists()) {
      await setDoc(runRef, { participants: [] });
    }

    const participantData = {
      uid: user.uid,
      displayName: user.displayName || "Unknown Runner",
      photoURL: user.photoURL || "https://i.pravatar.cc/150",
    };

    await updateDoc(runRef, {
      participants: arrayUnion(participantData),
    });

    const runObj = runsData.find((r) => r.id === runId);
    if (runObj) {
      runObj.isAddedToMyRuns = true;
      if (document.getElementById("btn-my-runs").classList.contains("active")) {
        renderMarkers("my-runs");
      }
    }
  } catch (error) {
    console.error("Error joining run:", error);
  }
};

window.leaveRun = async function (runId) {
  if (!auth.currentUser) return;
  try {
    const user = auth.currentUser;
    const runRef = doc(db, "runs_sessions", runId);

    const docSnap = await getDocFromServer(runRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const participantToRemove = data.participants.find(
        (p) => p.uid === user.uid,
      );
      if (participantToRemove) {
        await updateDoc(runRef, {
          participants: arrayRemove(participantToRemove),
        });

        const runObj = runsData.find((r) => r.id === runId);
        if (runObj) {
          runObj.isAddedToMyRuns = false;
          if (
            document.getElementById("btn-my-runs").classList.contains("active")
          ) {
            renderMarkers("my-runs");
          }
        }
      }
    }
  } catch (error) {
    console.error("Error leaving run:", error);
  }
};

window.currentRunLikesListener = null;
window.currentRunReviewsListener = null;

window.listenToRunSession = function (runId) {
  if (currentRunListener) {
    currentRunListener(); // unsubscribe previous
  }
  if (window.currentRunLikesListener) window.currentRunLikesListener();
  if (window.currentRunReviewsListener) window.currentRunReviewsListener();

  const runRef = doc(db, "runs_sessions", runId);
  currentRunListener = onSnapshot(runRef, (docSnap) => {
    let participants = [];
    if (docSnap.exists()) {
      participants = docSnap.data().participants || [];
    }
    updateSidePanelParticipants(runId, participants);
  });

  const likesRef = collection(db, `runs_sessions/${runId}/likes`);
  window.currentRunLikesListener = onSnapshot(likesRef, (snap) => {
    const list = snap.docs.map((d) => d.id);
    const countEl = document.getElementById("run-likes-count");
    const heartIcon = document.getElementById("heart-icon");
    if (countEl)
      countEl.innerText = `${list.length} heart${list.length !== 1 ? "s" : ""}`;
    if (heartIcon) {
      if (auth.currentUser && list.includes(auth.currentUser.uid)) {
        heartIcon.setAttribute("fill", "var(--accent-orange)");
        heartIcon.setAttribute("stroke", "var(--accent-orange)");
      } else {
        heartIcon.setAttribute("fill", "none");
        heartIcon.setAttribute("stroke", "currentColor");
      }
    }
  });

  const reviewsRef = collection(db, `runs_sessions/${runId}/reviews`);
  window.currentRunReviewsListener = onSnapshot(reviewsRef, (snap) => {
    const listEl = document.getElementById("runs-reviews-list");
    const avgEl = document.getElementById("run-reviews-avg");
    if (!listEl) return;

    if (snap.empty) {
      listEl.innerHTML =
        '<span style="font-size:0.85rem; color:var(--text-secondary);">No reviews yet. Be the first!</span>';
      if (avgEl) avgEl.innerText = "No reviews yet";
      return;
    }

    let sum = 0;
    let html = "";
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      sum += data.rating;
      html += `
        <div style="background: var(--glass-bg); padding: 8px; border-radius: 8px; border: 1px solid var(--glass-border);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <img src="${data.userAvatar || "/public/fallback.svg"}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" />
              <span style="font-size:0.85rem; font-weight:600;">${data.userName}</span>
            </div>
            <span style="color:var(--accent-orange); font-size:0.9rem;">${"★".repeat(data.rating)}${"☆".repeat(5 - data.rating)}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-primary); word-break: break-word;">${data.comment}</div>
        </div>
      `;
    });
    const avg = (sum / snap.docs.length).toFixed(1);
    listEl.innerHTML = html;
    if (avgEl) avgEl.innerText = `${avg} ★ (${snap.docs.length})`;
  });
};

function updateSidePanelParticipants(runId, participants) {
  const container = document.getElementById("dynamic-participants-container");
  const actionContainer = document.getElementById("dynamic-action-container");
  if (!container || !actionContainer) return;

  const maxParticipants = 10;
  const currentCount = participants.length;

  let avatarsHtml = participants
    .map((p) => {
      // Only allow clicking if the user is signed in and it's not their own profile
      const onclickAttr =
        auth.currentUser && auth.currentUser.uid !== p.uid
          ? `onclick="openPrivateChat('${p.uid}', '${p.displayName.replace(/'/g, "\\'")}')" style="cursor: pointer; width:32px;height:32px;border-radius:50%;margin-right:-8px; border:2px solid #fff;"`
          : `style="width:32px;height:32px;border-radius:50%;margin-right:-8px; border:2px solid #fff;"`;
      return `<img src="${p.photoURL}" alt="${p.displayName}" title="${p.displayName} (Click to Chat)" ${onclickAttr} class="participant-avatar-small" />`;
    })
    .join("");

  const userInRun = auth.currentUser
    ? participants.some((p) => p.uid === auth.currentUser.uid)
    : false;

  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
      <h4 style="margin:0;">Participants (${currentCount}/${maxParticipants})</h4>
    </div>
    <div style="display:flex; padding-top: 4px;">
      ${avatarsHtml || '<span style="font-size:0.85rem; color:var(--text-secondary);">No participants yet</span>'}
    </div>
    ${
      userInRun
        ? `
    <div style="margin-top: 16px;">
      <button id="btn-open-group-chat" class="action-btn btn-primary" style="width: 100%; border-radius: 12px; background: #ffffff; color: #000; border: none; font-weight: bold; text-transform: uppercase;">
        Open Group Chat
      </button>
    </div>
    `
        : ""
    }
  `;

  if (userInRun) {
    document
      .getElementById("btn-open-group-chat")
      .addEventListener("click", () => {
        const run = runsData.find((r) => r.id === runId);
        const title = run ? run.title : "Group Run Chat";
        window.openGroupChatRoom(runId, title);
      });
  }

  if (!auth.currentUser) {
    actionContainer.innerHTML = `<button class="action-btn btn-secondary" style="width: 100%; border: 1px solid var(--glass-border); color: var(--text-primary);" id="btn-join-disabled">Sign In to Join</button>`;
    document
      .getElementById("btn-join-disabled")
      .addEventListener("click", () => alert("Please sign in to join."));
    return;
  }

  if (userInRun) {
    actionContainer.innerHTML = `<button class="action-btn" style="width: 100%; background:#ef4444; color:white; border:none;" id="btn-leave-run">Leave Run</button>`;
    document
      .getElementById("btn-leave-run")
      .addEventListener("click", () => window.leaveRun(runId));
  } else if (currentCount >= maxParticipants) {
    actionContainer.innerHTML = `<button class="action-btn btn-secondary" style="width: 100%; opacity:0.6; cursor:not-allowed;" disabled>Run Full / Waiting List</button>`;
  } else {
    actionContainer.innerHTML = `<button class="action-btn btn-primary btn-liquid" style="width: 100%;" id="btn-join-run"><span class="btn-text">Join Run</span></button>`;
    document
      .getElementById("btn-join-run")
      .addEventListener("click", (e) =>
        window.handleLiquidClick(e, () => window.joinRun(runId)),
      );
  }
}

// ==========================================
// 9. PRIVATE CHAT LOGIC
// ==========================================

let currentPrivateChatListener = null;
let activePrivateChatId = null;

function generateChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

window.openPrivateChat = function (otherUid, otherName) {
  if (!auth.currentUser) return;
  const currentUid = auth.currentUser.uid;
  const chatId = generateChatId(currentUid, otherUid);

  activePrivateChatId = chatId;

  document.getElementById("private-chat-title").innerText =
    `Chat with ${otherName}`;
  document.getElementById("private-chat-modal").classList.remove("hidden");

  listenToPrivateChat(chatId);
};

document.getElementById("close-private-chat").addEventListener("click", () => {
  document.getElementById("private-chat-modal").classList.add("hidden");
  if (currentPrivateChatListener) {
    currentPrivateChatListener();
    currentPrivateChatListener = null;
  }
  activePrivateChatId = null;
});

async function sendPrivateMessage(chatId, text) {
  if (!auth.currentUser || !text.trim()) return;

  const messagesRef = collection(db, `private_chats/${chatId}/messages`);
  try {
    await addDoc(messagesRef, {
      senderId: auth.currentUser.uid,
      text: text.trim(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error sending private message", err);
  }
}

document.getElementById("btn-send-private").addEventListener("click", () => {
  const input = document.getElementById("private-chat-input");
  if (activePrivateChatId && input.value) {
    sendPrivateMessage(activePrivateChatId, input.value);
    input.value = "";
  }
});

document
  .getElementById("private-chat-input")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-send-private").click();
    }
  });

function listenToPrivateChat(chatId) {
  if (currentPrivateChatListener) {
    currentPrivateChatListener();
  }

  const messagesRef = collection(db, `private_chats/${chatId}/messages`);
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  const messagesContainer = document.getElementById("private-chat-messages");

  currentPrivateChatListener = onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isMine = auth.currentUser && msg.senderId === auth.currentUser.uid;

      const div = document.createElement("div");
      div.style.padding = "8px 12px";
      div.style.borderRadius = "12px";
      div.style.maxWidth = "80%";
      div.style.wordBreak = "break-word";

      if (isMine) {
        div.style.backgroundColor = "var(--accent-pink)";
        div.style.color = "#fff";
        div.style.alignSelf = "flex-end";
      } else {
        div.style.backgroundColor = "var(--solid-bg)";
        div.style.color = "var(--text-primary)";
        div.style.border = "1px solid var(--glass-border)";
        div.style.alignSelf = "flex-start";
      }

      div.innerText = msg.text || "";
      messagesContainer.appendChild(div);
    });

    // Auto-scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ==========================================
// 10. GROUP CHAT AND NOTIFICATIONS
// ==========================================

window.globalGroupChatListeners = {};

window.startGlobalChatListeners = async function () {
  // Clear old listeners
  Object.values(window.globalGroupChatListeners).forEach((unsubscribe) =>
    unsubscribe(),
  );
  window.globalGroupChatListeners = {};

  if (!auth.currentUser) return;

  try {
    const sessionsSnap = await getDocs(collection(db, "runs_sessions"));
    const joinedRuns = [];
    sessionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const participants = data.participants || [];
      if (participants.some((p) => p.uid === auth.currentUser.uid)) {
        joinedRuns.push(docSnap.id);
      }
    });

    joinedRuns.forEach((runId) => {
      const messagesRef = collection(
        db,
        `runs_sessions/${runId}/group_messages`,
      );
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const msg = change.doc.data();
            // Do not notify for self sent messages or locally added docs
            if (!change.doc.metadata.hasPendingWrites) {
              if (auth.currentUser && msg.senderId !== auth.currentUser.uid) {
                // If we are currently IN the chat view for this run, maybe don't toast?
                // But it's fine to show toast otherwise. Let's just show it.
                window.showNotification(
                  msg.senderName || "Group Chat",
                  msg.text,
                );
              }
            }
          }
        });
      });

      window.globalGroupChatListeners[runId] = unsubscribe;
    });
  } catch (err) {
    console.error("Error setting up global chat listeners:", err);
  }
};

window.showNotification = function (title, message) {
  const toast = document.getElementById("notification-toast");
  if (!toast) return;

  document.getElementById("notification-title").innerText = title;
  document.getElementById("notification-message").innerText = message;

  toast.classList.remove("hidden");
  toast.style.opacity = "1";

  // Auto hide after 4 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 4000);
};

window.toggleRunLike = async function (runId) {
  if (!auth.currentUser) {
    alert("Please sign in to like a run.");
    return;
  }
  const uid = auth.currentUser.uid;
  const likeRef = doc(db, `runs_sessions/${runId}/likes`, uid);
  try {
    const snap = await getDoc(likeRef);
    if (snap.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, {});
    }
  } catch (err) {
    console.error("Error toggling like:", err);
  }
};

window.setReviewRating = function (e, rating) {
  const container = document.getElementById("review-stars-input");
  const input = document.getElementById("review-rating-val");
  if (!container || !input) return;
  input.value = rating;
  const stars = container.querySelectorAll(".star-rating-btn");
  stars.forEach((star, index) => {
    if (index < rating) {
      star.innerText = "★";
    } else {
      star.innerText = "☆";
    }
  });
};

window.submitRunReview = async function (runId) {
  if (!auth.currentUser) {
    alert("Please sign in to review a run.");
    return;
  }
  const ratingInput = document.getElementById("review-rating-val");
  const commentInput = document.getElementById("review-comment-input");
  if (!ratingInput || !commentInput) return;

  const rating = parseInt(ratingInput.value, 10);
  const comment = commentInput.value.trim();

  if (rating === 0) {
    alert("Please select a star rating.");
    return;
  }
  if (!comment) {
    alert("Please write a comment.");
    return;
  }

  const reviewsRef = collection(db, `runs_sessions/${runId}/reviews`);
  try {
    await addDoc(reviewsRef, {
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || "Runner",
      userAvatar: auth.currentUser.photoURL || "",
      rating: rating,
      comment: comment,
      timestamp: serverTimestamp(),
    });

    // Clear form
    ratingInput.value = "0";
    commentInput.value = "";
    const stars = document
      .getElementById("review-stars-input")
      .querySelectorAll(".star-rating-btn");
    stars.forEach((star) => (star.innerText = "☆"));
  } catch (err) {
    console.error("Error submitting review:", err);
    alert("Failed to submit review.");
  }
};

// ==========================================
// 9. LIVE NAVIGATION & SOS MODE
// ==========================================

let navMap = null;
let navWatchId = null;
let navUserMarker = null;

let navStartTime = null;
let navTimerInterval = null;
let navTotalDistance = 0; // in km
let navLastLatLng = null;

function updateNavTime() {
  if (!navStartTime) return;
  const now = new Date();
  const diff = now - navStartTime;
  const hrs = Math.floor(diff / 3600000)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((diff % 3600000) / 60000)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor((diff % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  document.getElementById("nav-time").innerText = `${hrs}:${mins}:${secs}`;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

window.startNavigation = async function (runId, gpxUrl) {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  const navMode = document.getElementById("navigation-mode");
  navMode.classList.remove("hidden");

  // Reset stats
  navStartTime = new Date();
  navTotalDistance = 0;
  navLastLatLng = null;
  document.getElementById("nav-distance").innerText = "0.00 km";
  updateNavTime();
  if (navTimerInterval) clearInterval(navTimerInterval);
  navTimerInterval = setInterval(updateNavTime, 1000);

  if (!navMap) {
    navMap = L.map("nav-map").setView([0, 0], 15);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      },
    ).addTo(navMap);
  } else {
    // Need to invalidate size since it was hidden
    setTimeout(() => navMap.invalidateSize(), 150);
  }

  // Clear existing GPX layers if any (we could store the GPX layer in a variable)
  navMap.eachLayer((layer) => {
    if (layer instanceof L.GPX) {
      navMap.removeLayer(layer);
    }
  });

  // If there's a GPX url, load it in the nav map
  if (gpxUrl && gpxUrl !== "undefined") {
    new L.GPX(gpxUrl, {
      async: true,
      marker_options: {
        startIconUrl: "",
        endIconUrl: "",
        shadowUrl: "",
      },
      polyline_options: {
        color: "#ff4b4b",
        weight: 6,
        opacity: 0.8,
      },
    })
      .on("loaded", function (e) {
        navMap.fitBounds(e.target.getBounds());
      })
      .addTo(navMap);
  }

  navWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (navLastLatLng) {
        const dist = calculateDistanceKm(
          navLastLatLng.lat,
          navLastLatLng.lng,
          lat,
          lng,
        );
        navTotalDistance += dist;
        document.getElementById("nav-distance").innerText =
          navTotalDistance.toFixed(2) + " km";
      }
      navLastLatLng = { lat, lng };

      if (!navUserMarker) {
        const pulseHtml = `
        <div class="pulse-ring"></div>
        <div class="pulse-dot"></div>
      `;
        navUserMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "custom-pulse",
            html: pulseHtml,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        }).addTo(navMap);
        navMap.setView([lat, lng], 16);
      } else {
        navUserMarker.setLatLng([lat, lng]);
        navMap.panTo([lat, lng]);
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      alert("Failed to get high precision location. Ensure GPS is enabled.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    },
  );
};

document.getElementById("btn-exit-nav")?.addEventListener("click", () => {
  if (navWatchId) {
    navigator.geolocation.clearWatch(navWatchId);
    navWatchId = null;
  }
  if (navTimerInterval) {
    clearInterval(navTimerInterval);
    navTimerInterval = null;
  }
  if (navUserMarker && navMap) {
    navMap.removeLayer(navUserMarker);
    navUserMarker = null;
  }
  document.getElementById("navigation-mode").classList.add("hidden");
});

const btnSos = document.getElementById("btn-sos");
if (btnSos) {
  // Double-tap logic
  let lastTap = 0;
  btnSos.addEventListener("click", (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 500 && tapLength > 0) {
      // Double tap detected
      triggerSOS();
      e.preventDefault();
    }
    lastTap = currentTime;
  });
}

function triggerSOS() {
  if (!currentUser.emergencyContactNumber) {
    alert(
      "No emergency contact number configured. Please update your profile.",
    );
    return;
  }
  window.location.href = "tel:" + currentUser.emergencyContactNumber;
}

// Start listeners when onAuthStateChanged is triggered
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.startGlobalChatListeners();
    // Render chat list if in chat view
    if (currentView === "view-chat") {
      window.renderChatList();
    }
  } else {
    // Clear listeners
    Object.values(window.globalGroupChatListeners).forEach((unsubscribe) =>
      unsubscribe(),
    );
    window.globalGroupChatListeners = {};
  }
  // existing auth state handling might exist elsewhere, but this is safe
});
