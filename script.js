const API_KEY = "3046379a68589ba6fc77b4eee6d6dbfc"; 
const AUTO_UPDATE_MINUTES = 5;

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const suggestions = document.getElementById("suggestions");
const statusText = document.getElementById("statusText");

const currentWeather = document.getElementById("currentWeather");
const forecastGrid = document.getElementById("forecastGrid");
const favList = document.getElementById("favList");

const refreshBtn = document.getElementById("refreshBtn");
const refreshSpinner = document.getElementById("refreshSpinner");

const unitC = document.getElementById("unitC");
const unitF = document.getElementById("unitF");
const themeToggle = document.getElementById("themeToggle");
const themeBall = document.getElementById("themeBall");

const statusOnlineText = document.getElementById("statusOnlineText");
const dotOnline = document.getElementById("dotOnline");
const logList = document.getElementById("logList");

let UNIT = "metric";
let FAVORITES = JSON.parse(localStorage.getItem("favorites") || "[]"); 
let currentCity = null;
let autoUpdateTimer = null;
let logs = [];

function setStatus(type, msg) {
  const base = "text-xs mt-3";
  let color = "text-slate-600";
  if (type === "success") color = "text-emerald-600";
  if (type === "error") color = "text-red-600";
  if (type === "loading") color = "text-sky-600";

  statusText.className = `${base} ${color}`;
  statusText.textContent = msg;

  if (type === "loading") {
    setLoading(true);
  } else {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (!refreshBtn) return;
  if (isLoading) {
    refreshSpinner.classList.remove("hidden");
    refreshBtn.classList.add("opacity-70", "cursor-wait");
    refreshBtn.disabled = true;
  } else {
    refreshSpinner.classList.add("hidden");
    refreshBtn.classList.remove("opacity-70", "cursor-wait");
    refreshBtn.disabled = false;
  }
}

function saveFavorites() {
  localStorage.setItem("favorites", JSON.stringify(FAVORITES));
}

function isFavoriteCity(name) {
  return FAVORITES.includes(name);
}

function addLog(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  logs.unshift(`[${timeStr}] ${message}`);
  if (logs.length > 80) logs = logs.slice(0, 80);
  renderLogs();
}

function renderLogs() {
  logList.innerHTML = logs
    .map((line) => `<div>${line}</div>`)
    .join("");
}

function formatDateTime(dt) {
  return dt.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


searchInput.addEventListener("input", async () => {
  const q = searchInput.value.trim();
  if (q.length < 2) {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    return;
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      q
    )}&limit=5&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      suggestions.classList.add("hidden");
      return;
    }

    suggestions.innerHTML = "";
    data.forEach((c) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "w-full text-left px-3 py-2 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer text-sm";
      item.textContent = `${c.name}, ${c.country}`;
      item.onclick = () => {
        suggestions.classList.add("hidden");
        searchInput.value = c.name;
        loadWeatherByCoords(c.lat, c.lon, c.name, c.country, "manual");
      };
      suggestions.appendChild(item);
    });

    suggestions.classList.remove("hidden");
  } catch (err) {
    console.error(err);
  }
});

document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== searchInput) {
    suggestions.classList.add("hidden");
  }
});

async function loadWeatherByCoords(lat, lon, name = null, country = null, mode = "auto") {
  if (!API_KEY) return;
  setStatus("loading", "Mengambil data cuaca...");

  currentCity = { lat, lon, name, country };

  if (autoUpdateTimer) clearTimeout(autoUpdateTimer);

  try {
    const urlCurrent = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${UNIT}&lang=id`;
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${UNIT}&lang=id`;

    const [cRes, fRes] = await Promise.all([fetch(urlCurrent), fetch(urlForecast)]);

    if (!cRes.ok || !fRes.ok) {
      throw new Error("Response API tidak OK");
    }

    const current = await cRes.json();
    const forecast = await fRes.json();

    renderCurrent(current, name, country);
    renderForecast(forecast);

    setStatus("success", "Data cuaca berhasil diperbarui.");
    statusOnlineText.textContent = "Online (API OK)";
    dotOnline.classList.remove("bg-red-400");
    dotOnline.classList.add("bg-emerald-400");

    const cityName = (name || current.name || "Kota tidak dikenal").trim();
    addLog(`Memuat cuaca untuk ${cityName} (${mode})`);

    // jadwalkan auto update
    autoUpdateTimer = setTimeout(() => {
      loadWeatherByCoords(lat, lon, name, country, "auto");
    }, AUTO_UPDATE_MINUTES * 60 * 1000);
  } catch (err) {
    console.error(err);
    setStatus("error", "Gagal mengambil data cuaca. Coba lagi.");
    statusOnlineText.textContent = "Offline / Error API";
    dotOnline.classList.remove("bg-emerald-400");
    dotOnline.classList.add("bg-red-400");
    addLog("Gagal mengambil data cuaca (error).");
  }
}

function renderCurrent(data, overrideName, overrideCountry) {
  const city = overrideName || data.name || "Tidak diketahui";
  const country = overrideCountry || (data.sys && data.sys.country) || "ID";

  const temp = Math.round(data.main.temp);
  const humidity = data.main.humidity;
  const windRaw = data.wind.speed;
  const pressure = data.main.pressure;
  const desc = data.weather[0].description;
  const icon = data.weather[0].icon;

  let windLabel = "";
  if (UNIT === "metric") {
    const kmh = windRaw * 3.6;
    windLabel = `${kmh.toFixed(1)} km/j`;
  } else {
    windLabel = `${windRaw.toFixed(1)} mph`;
  }

  const dateStr = formatDateTime(new Date());
  const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  const tempUnit = UNIT === "metric" ? "C" : "F";

  const cityIsFav = isFavoriteCity(city);

  currentWeather.innerHTML = `
    <div class="flex justify-between items-start gap-4 pb-4 border-b border-white/50 dark:border-slate-700">
      <div>
        <p class="uppercase text-[10px] tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-1">
          Cuaca Saat Ini
        </p>
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-semibold">${city}, ${country}</h2>
          <button id="btnStar"
            class="w-6 h-6 rounded-full flex items-center justify-center border ${
              cityIsFav
                ? "bg-amber-400/90 border-amber-300 text-white"
                : "bg-white/80 border-slate-200 text-amber-400"
            } hover:scale-105 transition-transform"
            title="${cityIsFav ? "Hapus dari favorit" : "Simpan sebagai favorit"}">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
              <path d="M12 .587l3.668 7.431L24 9.748l-6 5.854 1.416 8.26L12 18.896l-7.416 4.966L6 15.602 0 9.748l8.332-1.73z"/>
            </svg>
          </button>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${dateStr}</p>
      </div>

      <div class="text-right flex items-center gap-4">
        <img src="${iconUrl}" alt="ikon cuaca" class="weather-icon-lg" />
        <div>
          <p class="text-4xl sm:text-5xl font-bold text-sky-500">${temp}°${tempUnit}</p>
          <p class="capitalize text-xs text-slate-600 dark:text-slate-300 mt-1">${desc}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      <div class="bg-white/90 dark:bg-slate-900/90 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-500 dark:text-sky-300">
          <!-- droplet icon -->
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
            <path d="M12 2.69 7.05 9.64A6 6 0 1 0 16.95 9.64L12 2.69Z" />
          </svg>
        </div>
        <div>
          <p class="text-[11px] text-slate-500">Kelembapan</p>
          <p class="text-lg font-semibold">${humidity}%</p>
        </div>
      </div>

      <div class="bg-white/90 dark:bg-slate-900/90 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900 flex items-center justify-center text-emerald-500 dark:text-emerald-300">
          <!-- wind icon -->
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
            <path d="M4 10h9a3 3 0 1 0-3-3" />
            <path d="M2 16h13a3 3 0 1 1-3 3" />
          </svg>
        </div>
        <div>
          <p class="text-[11px] text-slate-500">Kecepatan Angin</p>
          <p class="text-lg font-semibold">${windLabel}</p>
        </div>
      </div>

      <div class="bg-white/90 dark:bg-slate-900/90 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-900 flex items-center justify-center text-violet-500 dark:text-violet-300">
          <!-- pressure icon -->
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
            <path d="M12 3a7 7 0 1 0 7 7" />
            <path d="M12 7v4l2 2" />
          </svg>
        </div>
        <div>
          <p class="text-[11px] text-slate-500">Tekanan Udara</p>
          <p class="text-lg font-semibold">${pressure} hPa</p>
        </div>
      </div>
    </div>

    <div class="mt-4 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 flex-wrap gap-2">
      <p>
        Real-time update setiap ${AUTO_UPDATE_MINUTES} menit menggunakan OpenWeather Public API.
      </p>
      <p id="favStatusText">
        ${
          cityIsFav
            ? "Kota ini telah disimpan sebagai favorit. Klik ikon ★ untuk menghapus."
            : "Kota ini belum disimpan sebagai favorit. Klik ikon ★ untuk menyimpan."
        }
      </p>
    </div>
  `;

  const btnStar = document.getElementById("btnStar");
  if (btnStar) {
    btnStar.onclick = () => {
      toggleFavorite(city);
    };
  }
}

function renderForecast(data) {
  forecastGrid.innerHTML = "";

  if (!data || !Array.isArray(data.list)) {
    forecastGrid.innerHTML = `<p class="text-xs text-slate-500">Data prakiraan tidak tersedia.</p>`;
    return;
  }

  const daily = {};
  data.list.forEach((item) => {
    if (item.dt_txt.includes("12:00:00")) {
      const date = item.dt_txt.split(" ")[0];
      daily[date] = item;
    }
  });

  const keys = Object.keys(daily).slice(0, 5);
  if (!keys.length) {
    forecastGrid.innerHTML = `<p class="text-xs text-slate-500">Data prakiraan tidak tersedia.</p>`;
    return;
  }

  keys.forEach((dateStr) => {
    const item = daily[dateStr];
    const d = new Date(dateStr);
    const dayLabel = d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const icon = item.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    const desc = item.weather[0].description;
    const tMin = Math.round(item.main.temp_min);
    const tMax = Math.round(item.main.temp_max);
    const unit = UNIT === "metric" ? "C" : "F";

    const card = document.createElement("div");
    card.className =
      "forecast-card text-center px-4 py-4 border border-white/70 dark:border-slate-700/80";

    card.innerHTML = `
      <p class="text-xs font-medium mb-2">${dayLabel}</p>
      <img src="${iconUrl}" alt="ikon cuaca" class="w-12 h-12 mx-auto mb-1" />
      <p class="capitalize text-[11px] text-slate-600 dark:text-slate-300 mb-1">${desc}</p>
      <p class="text-[11px] text-slate-500 dark:text-slate-400">
        ${tMin}°${unit} – ${tMax}°${unit}
      </p>
    `;

    forecastGrid.appendChild(card);
  });
}

function toggleFavorite(cityName) {
  const index = FAVORITES.indexOf(cityName);
  if (index === -1) {
    FAVORITES.push(cityName);
    addLog(`Menambahkan ${cityName} ke favorit.`);
  } else {
    FAVORITES.splice(index, 1);
    addLog(`Menghapus ${cityName} dari favorit.`);
  }
  saveFavorites();
  renderFavorites();

  const favStatusText = document.getElementById("favStatusText");
  if (favStatusText) {
    const isFav = FAVORITES.includes(cityName);
    favStatusText.textContent = isFav
      ? "Kota ini telah disimpan sebagai favorit. Klik ikon ★ untuk menghapus."
      : "Kota ini belum disimpan sebagai favorit. Klik ikon ★ untuk menyimpan.";
  }

  if (currentCity) {
    loadWeatherByCoords(
      currentCity.lat,
      currentCity.lon,
      currentCity.name || cityName,
      currentCity.country,
      "manual"
    );
  }
}

function renderFavorites() {
  favList.innerHTML = "";
  if (!FAVORITES.length) {
    favList.innerHTML =
      '<span class="text-xs text-slate-400">Belum ada kota favorit.</span>';
    return;
  }

  FAVORITES.forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = name;
    btn.className =
      "px-3 py-1 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm text-xs hover:bg-sky-50 dark:hover:bg-slate-700";
    btn.onclick = async () => {
      try {
        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          name
        )}&limit=1&appid=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.length) {
          loadWeatherByCoords(
            data[0].lat,
            data[0].lon,
            data[0].name,
            data[0].country,
            "manual"
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    favList.appendChild(btn);
  });
}

unitC.onclick = () => {
  if (UNIT === "metric") return;
  UNIT = "metric";
  unitC.className =
    "px-3 py-1 rounded-full bg-sky-500 text-white font-semibold text-xs";
  unitF.className =
    "px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 text-xs";

  if (currentCity) {
    loadWeatherByCoords(
      currentCity.lat,
      currentCity.lon,
      currentCity.name,
      currentCity.country,
      "manual"
    );
  }
};

unitF.onclick = () => {
  if (UNIT === "imperial") return;
  UNIT = "imperial";
  unitF.className =
    "px-3 py-1 rounded-full bg-sky-500 text-white font-semibold text-xs";
  unitC.className =
    "px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 text-xs";

  if (currentCity) {
    loadWeatherByCoords(
      currentCity.lat,
      currentCity.lon,
      currentCity.name,
      currentCity.country,
      "manual"
    );
  }
};

themeToggle.onclick = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  themeBall.style.transform = isDark ? "translateX(24px)" : "translateX(0)";
};

refreshBtn.onclick = () => {
  if (currentCity) {
    loadWeatherByCoords(
      currentCity.lat,
      currentCity.lon,
      currentCity.name,
      currentCity.country,
      "manual"
    );
  }
};

searchBtn.onclick = async () => {
  const q = searchInput.value.trim();
  if (!q) return;

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      q
    )}&limit=1&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.length) {
      setStatus("error", "Kota tidak ditemukan.");
      return;
    }

    loadWeatherByCoords(
      data[0].lat,
      data[0].lon,
      data[0].name,
      data[0].country,
      "manual"
    );
  } catch (err) {
    console.error(err);
    setStatus("error", "Terjadi kesalahan saat mencari kota.");
  }
};

window.onload = () => {
  renderFavorites();
  renderLogs();

  const isDark = document.documentElement.classList.contains("dark");
  themeBall.style.transform = isDark ? "translateX(24px)" : "translateX(0)";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        loadWeatherByCoords(latitude, longitude, null, null, "lokasi perangkat");
      },
      () => {
        setStatus(
          "error",
          "Izin lokasi ditolak. Silakan cari kota secara manual."
        );
      }
    );
  } else {
    setStatus(
      "error",
      "Geolocation tidak didukung browser. Silakan cari kota secara manual."
    );
  }
};
