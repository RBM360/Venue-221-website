const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const header = document.querySelector(".site-header");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => nav.classList.remove("open"));
  });
}

window.addEventListener("scroll", () => {
  if (!header) return;
  if (window.scrollY > 24) header.classList.add("compact");
  else header.classList.remove("compact");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("reveal-in");
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll("[data-reveal], [data-stagger]").forEach((el) => {
  observer.observe(el);
});

const bookingGrid = document.querySelector("#booking-calendar-grid");
const bookingMonth = document.querySelector("#booking-month");
const bookingYear = document.querySelector("#booking-year");
const bookingPrev = document.querySelector("#booking-prev-month");
const bookingNext = document.querySelector("#booking-next-month");
const bookingSelectedDate = document.querySelector("#booking-selected-date");
const bookingBlockStatus = document.querySelector("#booking-block-status");

// Empty fallback keeps calendar visible even when Supabase is missing or errors.
const defaultBookingData = {};
let bookingData = { ...defaultBookingData };

if (bookingGrid && bookingMonth && bookingYear && bookingSelectedDate && bookingBlockStatus) {
  const today = new Date();
  let activeMonth = today.getMonth();
  let activeYear = today.getFullYear();
  let selectedKey = toDateKey(today);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  for (let m = 0; m < 12; m += 1) {
    const option = document.createElement("option");
    option.value = String(m);
    option.textContent = monthNames[m];
    bookingMonth.append(option);
  }

  for (let y = today.getFullYear() - 2; y <= today.getFullYear() + 3; y += 1) {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = String(y);
    bookingYear.append(option);
  }

  bookingMonth.value = String(activeMonth);
  bookingYear.value = String(activeYear);

  bookingPrev?.addEventListener("click", () => {
    activeMonth -= 1;
    if (activeMonth < 0) {
      activeMonth = 11;
      activeYear -= 1;
    }
    syncSelectors();
    renderCalendar();
  });

  bookingNext?.addEventListener("click", () => {
    activeMonth += 1;
    if (activeMonth > 11) {
      activeMonth = 0;
      activeYear += 1;
    }
    syncSelectors();
    renderCalendar();
  });

  bookingMonth.addEventListener("change", () => {
    activeMonth = Number(bookingMonth.value);
    renderCalendar();
  });

  bookingYear.addEventListener("change", () => {
    activeYear = Number(bookingYear.value);
    renderCalendar();
  });

  initBookingCalendar();

  async function initBookingCalendar() {
    bookingData = await loadBookingData();
    renderCalendar();
    renderDayDetails(selectedKey);
  }

  function syncSelectors() {
    bookingMonth.value = String(activeMonth);
    bookingYear.value = String(activeYear);
  }

  function renderCalendar() {
    bookingGrid.innerHTML = "";
    const firstDay = new Date(activeYear, activeMonth, 1);
    const startIndex = firstDay.getDay();
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
    const prevMonthDays = new Date(activeYear, activeMonth, 0).getDate();

    const cells = [];
    for (let i = startIndex - 1; i >= 0; i -= 1) {
      cells.push({ day: prevMonthDays - i, offset: -1 });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ day: d, offset: 0 });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: (cells.length % 7) + 1, offset: 1 });
    }

    cells.forEach((cell) => {
      const cellDate = new Date(activeYear, activeMonth + cell.offset, cell.day);
      const key = toDateKey(cellDate);
      const status = getDayStatus(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      if (cell.offset !== 0) button.classList.add("outside");
      if (toDateKey(cellDate) === toDateKey(today)) button.classList.add("today");
      if (key === selectedKey) button.classList.add("selected");

      const num = document.createElement("div");
      num.className = "calendar-day-num";
      num.textContent = String(cell.day);
      button.append(num);

      const dot = document.createElement("div");
      dot.className = `calendar-day-dot status-${status}-dot`;
      button.append(dot);

      button.addEventListener("click", () => {
        selectedKey = key;
        activeMonth = cellDate.getMonth();
        activeYear = cellDate.getFullYear();
        syncSelectors();
        renderCalendar();
        renderDayDetails(key);
      });

      bookingGrid.append(button);
    });
  }

  function renderDayDetails(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    bookingSelectedDate.textContent = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

    const detail = getBlockDetail(dateKey);
    bookingBlockStatus.innerHTML = `
      <article class="block-card">
        <h3>Full Day</h3>
        <p class="muted">8:00 AM - 9:00 PM</p>
        <p class="status-pill status-${detail.fullDay.status}">${detail.fullDay.label}</p>
      </article>
      <article class="block-card">
        <h3>Half Day AM</h3>
        <p class="muted">8:00 AM - 2:00 PM</p>
        <p class="status-pill status-${detail.halfMorning.status}">${detail.halfMorning.label}</p>
      </article>
      <article class="block-card">
        <h3>Half Day PM</h3>
        <p class="muted">3:00 PM - 9:00 PM</p>
        <p class="status-pill status-${detail.halfEvening.status}">${detail.halfEvening.label}</p>
      </article>
      <article class="block-card">
        <h3>Hourly</h3>
        <p class="muted">${detail.hourly.note}</p>
        <p class="status-pill status-${detail.hourly.status}">${detail.hourly.label}</p>
      </article>
    `;
  }

  function getDayStatus(dateKey) {
    const detail = getBlockDetail(dateKey);
    const core = [detail.fullDay.status, detail.halfMorning.status, detail.halfEvening.status];
    if (core.includes("available") || detail.hourly.status === "available") return "available";
    if (core.every((status) => status === "booked")) return "booked";
    if (core.every((status) => status === "unavailable") && detail.hourly.status === "unavailable") return "unavailable";
    if (core.includes("booked")) return "booked";
    if (core.includes("tentative")) return "tentative";
    return "available";
  }

  function getBlockDetail(dateKey) {
    const day = bookingData[dateKey] || {};
    const hourly = normalizeHourly(day.hourly || []);
    const fullExplicit = normalizeStatus(day.fullDay);
    const amExplicit = normalizeStatus(day.halfMorning);
    const pmExplicit = normalizeStatus(day.halfEvening);

    const fullDay = { status: "available", label: toLabel("available") };
    const halfMorning = { status: "available", label: toLabel("available") };
    const halfEvening = { status: "available", label: toLabel("available") };

    if (fullExplicit && fullExplicit !== "available") {
      fullDay.status = fullExplicit;
      fullDay.label = toLabel(fullExplicit);
    }
    if (amExplicit) {
      halfMorning.status = amExplicit;
      halfMorning.label = toLabel(amExplicit);
    }
    if (pmExplicit) {
      halfEvening.status = pmExplicit;
      halfEvening.label = toLabel(pmExplicit);
    }

    if (!(fullExplicit && fullExplicit !== "available")) {
      hourly.valid.forEach((slot) => {
        if (overlaps(slot.start, slot.end, 8, 14)) {
          halfMorning.status = setBookedUnlessTentative(halfMorning.status);
          halfMorning.label = toLabel(halfMorning.status);
        }
        if (overlaps(slot.start, slot.end, 15, 21)) {
          halfEvening.status = setBookedUnlessTentative(halfEvening.status);
          halfEvening.label = toLabel(halfEvening.status);
        }
      });

      const halfStatuses = [halfMorning.status, halfEvening.status];
      if (halfStatuses.some((status) => status === "tentative")) {
        fullDay.status = "tentative";
      } else if (halfStatuses.some((status) => status === "booked") || hourly.valid.length > 0) {
        fullDay.status = "booked";
      } else {
        fullDay.status = "available";
      }
      fullDay.label = toLabel(fullDay.status);
    }

    const hasInvalidHourly = hourly.invalid.length > 0;
    const anyHourlyOpenWindow = hasAnyOpenHourlyWindow(hourly.valid, fullExplicit);
    const hourlyStatus = anyHourlyOpenWindow
      ? "available"
      : hourly.valid.some((s) => s.status === "tentative")
        ? "tentative"
        : hourly.valid.some((s) => s.status === "booked")
          ? "booked"
          : fullExplicit === "unavailable"
            ? "unavailable"
            : "available";

    let hourlyNote = anyHourlyOpenWindow ? "Call to see available hourly times." : "No hourly windows available for this date.";
    if (hasInvalidHourly || hourly.valid.length > 0) {
      hourlyNote = "Call to see available hourly times.";
    }

    return {
      fullDay,
      halfMorning,
      halfEvening,
      hourly: {
        status: hourlyStatus,
        label: toLabel(hourlyStatus),
        note: hourlyNote,
      },
    };
  }

  function normalizeHourly(slots) {
    const valid = [];
    const invalid = [];
    slots.forEach((slot) => {
      const start = Number(slot.start);
      const end = Number(slot.end);
      const status = normalizeStatus(slot.status) || "booked";
      const inRange = start >= 8 && end <= 21 && end > start;
      if (!inRange) {
        invalid.push({ start, end, status });
      } else {
        valid.push({ start, end, status });
      }
    });
    return { valid, invalid };
  }

  function hasAnyOpenHourlyWindow(slots, fullExplicit) {
    const minWindow = 4;
    const bufferHours = 0.5;
    if (fullExplicit === "unavailable") return false;
    if ((fullExplicit === "booked" || fullExplicit === "tentative") && !slots.length) return false;

    const blocked = slots
      .filter((slot) => slot.status === "booked" || slot.status === "tentative" || slot.status === "unavailable")
      .map((slot) => ({ start: Number(slot.start) - bufferHours, end: Number(slot.end) + bufferHours }))
      .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end) && slot.end > slot.start)
      .sort((a, b) => a.start - b.start);

    if (!blocked.length) return 21 - 8 >= minWindow;

    let cursor = 8;
    for (const slot of blocked) {
      const start = Math.max(8, slot.start);
      const end = Math.min(21, slot.end);
      if (start - cursor >= minWindow) return true;
      if (end > cursor) cursor = end;
      if (cursor >= 21) return false;
    }
    return 21 - cursor >= minWindow;
  }

  function normalizeStatus(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).toLowerCase();
    if (normalized === "booked" || normalized === "tentative" || normalized === "available" || normalized === "unavailable") return normalized;
    return null;
  }

  function overlaps(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
  }

  function setBookedUnlessTentative(currentStatus) {
    if (currentStatus === "tentative") return currentStatus;
    return "booked";
  }

  function toLabel(status) {
    if (status === "booked") return "Booked";
    if (status === "tentative") return "Tentative";
    if (status === "unavailable") return "Unavailable";
    return "Available";
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatHour(hour24) {
    const raw = Number(hour24);
    if (!Number.isFinite(raw)) return "";
    const totalMinutes = Math.round(raw * 60);
    const hour = Math.floor(totalMinutes / 60);
    const minutes = Math.abs(totalMinutes % 60);
    const suffix = hour >= 12 ? "PM" : "AM";
    const normalized = hour % 12 === 0 ? 12 : hour % 12;
    const minuteText = minutes ? `:${String(minutes).padStart(2, "0")}` : "";
    return `${normalized}${minuteText}${suffix}`;
  }

  async function loadBookingData() {
    const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    const metaSupabaseUrl = document.querySelector('meta[name="supabase-url"]')?.getAttribute("content")?.trim();
    const metaSupabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute("content")?.trim();
    const supabaseUrl = envSupabaseUrl || metaSupabaseUrl;
    const supabaseAnonKey = envSupabaseAnonKey || metaSupabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { ...defaultBookingData };
    }

    const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/bookings?select=date,full_day,half_morning,half_evening,hourly_slots&order=date.asc`;
    try {
      const response = await fetch(endpoint, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      if (!response.ok) {
        return { ...defaultBookingData };
      }

      const rows = await response.json();
      const map = {};

      rows.forEach((row) => {
        if (!row?.date) return;

        const full = normalizeStatus(row.full_day);
        const am = normalizeStatus(row.half_morning);
        const pm = normalizeStatus(row.half_evening);
        const hourly = Array.isArray(row.hourly_slots)
          ? row.hourly_slots.map((slot) => ({
              start: Number(slot.start),
              end: Number(slot.end),
              status: normalizeStatus(slot.status) || "booked",
            }))
          : [];

        map[row.date] = {};
        if (full) map[row.date].fullDay = full;
        if (am) map[row.date].halfMorning = am;
        if (pm) map[row.date].halfEvening = pm;
        if (hourly.length) map[row.date].hourly = hourly;
      });

      return Object.keys(map).length ? map : { ...defaultBookingData };
    } catch (_error) {
      return { ...defaultBookingData };
    }
  }
}
