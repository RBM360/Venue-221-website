import { createClient } from "@supabase/supabase-js";

const authPanel = document.querySelector("#manager-auth-panel");
const appPanel = document.querySelector("#manager-app-panel");
const loginForm = document.querySelector("#manager-login-form");
const authMessage = document.querySelector("#manager-auth-message");
const saveMessage = document.querySelector("#manager-save-message");
const userLine = document.querySelector("#manager-user");
const signoutButton = document.querySelector("#manager-signout");

const bookingForm = document.querySelector("#manager-booking-form");
const refreshButton = document.querySelector("#manager-refresh");
const applyRangeButton = document.querySelector("#manager-apply-range");
const openBookingModalButton = document.querySelector("#manager-open-booking-modal");
const bookingModal = document.querySelector("#manager-booking-modal");
const bookingModalCloseButton = document.querySelector("#manager-booking-modal-close");
const bookingModalDateLabel = document.querySelector("#manager-modal-date-label");
const dateInput = document.querySelector("#manager-date");
const fullDayInput = document.querySelector("#manager-full-day");
const halfMorningInput = document.querySelector("#manager-half-morning");
const halfEveningInput = document.querySelector("#manager-half-evening");
const reservationSlotInput = document.querySelector("#manager-reservation-slot");
const reservationStartTimeInput = document.querySelector("#manager-reservation-start-time");
const reservationEndTimeInput = document.querySelector("#manager-reservation-end-time");
const renterNameInput = document.querySelector("#manager-renter-name");
const renterEmailInput = document.querySelector("#manager-renter-email");
const renterPhoneInput = document.querySelector("#manager-renter-phone");
const eventTypeInput = document.querySelector("#manager-event-type");
const paymentStatusInput = document.querySelector("#manager-payment-status");
const agreementUrlInput = document.querySelector("#manager-agreement-url");
const agreementFileInput = document.querySelector("#manager-agreement-file");
const saveReservationButton = document.querySelector("#manager-save-reservation");
const reservationSummary = document.querySelector("#manager-reservation-summary");
const reservationsList = document.querySelector("#manager-reservations-list");
const slotDetailPanel = document.querySelector("#manager-slot-detail-panel");
const rangeStartDateInput = document.querySelector("#manager-range-start-date");
const rangeEndDateInput = document.querySelector("#manager-range-end-date");
const rangeStartTimeInput = document.querySelector("#manager-range-start-time");
const rangeEndTimeInput = document.querySelector("#manager-range-end-time");

const calendarGrid = document.querySelector("#manager-calendar-grid");
const monthSelect = document.querySelector("#manager-month");
const yearSelect = document.querySelector("#manager-year");
const prevMonthButton = document.querySelector("#manager-prev-month");
const nextMonthButton = document.querySelector("#manager-next-month");
const selectedDateTitle = document.querySelector("#manager-selected-date");
const blockStatus = document.querySelector("#manager-block-status");

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

let supabase = null;
let bookingData = {};
let reservationData = {};
let selectedKey = toDateKey(new Date());
let activeMonth = new Date().getMonth();
let activeYear = new Date().getFullYear();
let activeSlot = "";

if (loginForm && bookingForm && calendarGrid && monthSelect && yearSelect) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    setMessage(authMessage, "Supabase config missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.", true);
    disableForms();
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    const allowedEmails = parseAllowedEmails(import.meta.env.VITE_MANAGER_ALLOWED_EMAILS);

    initSelectors();
    wireEvents(allowedEmails);

    init().catch(() => {
      setMessage(authMessage, "Unable to initialize manager session.", true);
    });
  }
}

function initSelectors() {
  monthNames.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = month;
    monthSelect.append(option);
  });

  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 2; year <= currentYear + 3; year += 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.append(option);
  }

  monthSelect.value = String(activeMonth);
  yearSelect.value = String(activeYear);
  dateInput.value = selectedKey;
  if (rangeStartDateInput) rangeStartDateInput.value = selectedKey;
  if (rangeEndDateInput) rangeEndDateInput.value = selectedKey;
}

function wireEvents(allowedEmails) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(authMessage, "Signing in...");

    const email = String(document.querySelector("#manager-email")?.value || "").trim();
    const password = String(document.querySelector("#manager-password")?.value || "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(authMessage, error.message, true);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const signedInEmail = data.user?.email || "";
    if (!canUseManager(signedInEmail, allowedEmails)) {
      await supabase.auth.signOut();
      setMessage(authMessage, "This account is not approved for manager access.", true);
      return;
    }

    await setSignedInState(signedInEmail);
    await refreshCalendar();
  });

  signoutButton?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    setSignedOutState();
    setMessage(authMessage, "Signed out.");
  });

  prevMonthButton?.addEventListener("click", () => {
    activeMonth -= 1;
    if (activeMonth < 0) {
      activeMonth = 11;
      activeYear -= 1;
    }
    syncSelectors();
    renderCalendar();
  });

  nextMonthButton?.addEventListener("click", () => {
    activeMonth += 1;
    if (activeMonth > 11) {
      activeMonth = 0;
      activeYear += 1;
    }
    syncSelectors();
    renderCalendar();
  });

  monthSelect.addEventListener("change", () => {
    activeMonth = Number(monthSelect.value);
    renderCalendar();
  });

  yearSelect.addEventListener("change", () => {
    activeYear = Number(yearSelect.value);
    renderCalendar();
  });

  blockStatus?.addEventListener("click", (event) => {
    const card = event.target.closest(".block-card[data-slot]");
    if (!card) return;
    const slot = String(card.dataset.slot || "");
    if (!slot) return;
    activeSlot = slot;
    renderSlotReservationPanel(selectedKey, slot);
  });

  slotDetailPanel?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-load-reservation-id]");
    if (!button) return;
    const id = Number(button.getAttribute("data-load-reservation-id"));
    if (!Number.isFinite(id)) return;
    loadReservationIntoEditor(id);
  });

  openBookingModalButton?.addEventListener("click", () => {
    resetBookingModalFields();
    if (activeSlot && activeSlot !== "hourly") reservationSlotInput.value = activeSlot;
    openBookingModal();
  });

  bookingModalCloseButton?.addEventListener("click", closeBookingModal);
  bookingModal?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute("data-modal-close")) {
      closeBookingModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bookingModal && !bookingModal.classList.contains("hidden")) {
      closeBookingModal();
    }
  });

  dateInput.addEventListener("change", () => {
    if (!dateInput.value) return;
    selectedKey = dateInput.value;
    const date = new Date(`${selectedKey}T00:00:00`);
    activeMonth = date.getMonth();
    activeYear = date.getFullYear();
    syncSelectors();
    renderCalendar();
    renderDayDetails(selectedKey);
    populateEditorFromDate(selectedKey);
    void loadAndRenderReservations(selectedKey);
  });

    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!dateInput.value) {
        setMessage(saveMessage, "Pick a date first.", true);
        return;
      }

      const payload = {
        date: dateInput.value,
        full_day: nullIfEmpty(fullDayInput.value),
        half_morning: nullIfEmpty(halfMorningInput.value),
        half_evening: nullIfEmpty(halfEveningInput.value),
      };

      const { error } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
      if (error) {
      setMessage(saveMessage, `Save failed: ${error.message}`, true);
      return;
    }

    setMessage(saveMessage, "Saved.");
    await refreshCalendar(dateInput.value);
  });

    refreshButton?.addEventListener("click", async () => {
      await refreshCalendar(dateInput.value || selectedKey);
      setMessage(saveMessage, "Calendar reloaded.");
    });

    applyRangeButton?.addEventListener("click", async () => {
      await applyCustomRange();
    });

    saveReservationButton?.addEventListener("click", async () => {
      await saveReservationForSelectedDate();
    });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const email = session?.user?.email || "";
    if (!email) {
      setSignedOutState();
      return;
    }
    if (!canUseManager(email, allowedEmails)) {
      await supabase.auth.signOut();
      setSignedOutState();
      setMessage(authMessage, "This account is not approved for manager access.", true);
      return;
    }
    await setSignedInState(email);
  });
}

async function init() {
  const allowedEmails = parseAllowedEmails(import.meta.env.VITE_MANAGER_ALLOWED_EMAILS);
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email || "";

  if (!email) {
    setSignedOutState();
    return;
  }

  if (!canUseManager(email, allowedEmails)) {
    await supabase.auth.signOut();
    setSignedOutState();
    setMessage(authMessage, "This account is not approved for manager access.", true);
    return;
  }

  await setSignedInState(email);
  await refreshCalendar(selectedKey);
}

async function refreshCalendar(dateToSelect = selectedKey) {
  bookingData = await loadBookingData();

  if (dateToSelect) selectedKey = dateToSelect;
  dateInput.value = selectedKey;
  const date = new Date(`${selectedKey}T00:00:00`);
  activeMonth = date.getMonth();
  activeYear = date.getFullYear();
  syncSelectors();
  renderCalendar();
  renderDayDetails(selectedKey);
  populateEditorFromDate(selectedKey);
  await loadAndRenderReservations(selectedKey);
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const today = new Date();
  const firstDay = new Date(activeYear, activeMonth, 1);
  const startIndex = firstDay.getDay();
  const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
  const prevMonthDays = new Date(activeYear, activeMonth, 0).getDate();

  const cells = [];
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    cells.push({ day: prevMonthDays - i, offset: -1 });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, offset: 0 });
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
    if (key === toDateKey(today)) button.classList.add("today");
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
      dateInput.value = selectedKey;
      activeMonth = cellDate.getMonth();
      activeYear = cellDate.getFullYear();
      syncSelectors();
      renderCalendar();
      renderDayDetails(selectedKey);
      populateEditorFromDate(selectedKey);
      void loadAndRenderReservations(selectedKey);
    });

    calendarGrid.append(button);
  });
}

function renderDayDetails(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  selectedDateTitle.textContent = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  const detail = getBlockDetail(dateKey);
  blockStatus.innerHTML = `
    <article class="block-card" data-slot="full_day" data-status="${detail.fullDay.status}">
      <h3>Full Day</h3>
      <p class="muted">8:00 AM - 9:00 PM</p>
      <p class="status-pill status-${detail.fullDay.status}">${detail.fullDay.label}</p>
    </article>
    <article class="block-card" data-slot="half_morning" data-status="${detail.halfMorning.status}">
      <h3>Half Day AM</h3>
      <p class="muted">8:00 AM - 2:00 PM</p>
      <p class="status-pill status-${detail.halfMorning.status}">${detail.halfMorning.label}</p>
    </article>
    <article class="block-card" data-slot="half_evening" data-status="${detail.halfEvening.status}">
      <h3>Half Day PM</h3>
      <p class="muted">3:00 PM - 9:00 PM</p>
      <p class="status-pill status-${detail.halfEvening.status}">${detail.halfEvening.label}</p>
    </article>
    <article class="block-card" data-slot="hourly" data-status="${detail.hourly.status}">
      <h3>Hourly</h3>
      <p class="muted">${detail.hourly.note}</p>
      <p class="status-pill status-${detail.hourly.status}">${detail.hourly.label}</p>
    </article>
  `;
  renderSlotReservationPanel(dateKey, activeSlot);
}

function populateEditorFromDate(dateKey) {
  const day = bookingData[dateKey] || {};
  const detail = getBlockDetail(dateKey);
  fullDayInput.value = detail.fullDay.status === "unavailable" ? "unavailable" : normalizeStatus(day.fullDay);
  halfMorningInput.value = detail.halfMorning.status === "unavailable" ? "unavailable" : normalizeStatus(day.halfMorning);
  halfEveningInput.value = detail.halfEvening.status === "unavailable" ? "unavailable" : normalizeStatus(day.halfEvening);
  if (reservationSlotInput) reservationSlotInput.value = "";
  if (renterNameInput) renterNameInput.value = "";
  if (renterEmailInput) renterEmailInput.value = "";
  if (renterPhoneInput) renterPhoneInput.value = "";
  if (eventTypeInput) eventTypeInput.value = "";
  if (paymentStatusInput) paymentStatusInput.value = "";
  if (agreementUrlInput) agreementUrlInput.value = "";
  if (agreementFileInput) agreementFileInput.value = "";
  renderReservationSummary([]);
}

function getDayStatus(dateKey) {
  const detail = getBlockDetail(dateKey);
  if (detail.fullDay.status === "booked") return "booked";
  if (detail.fullDay.status === "tentative" || detail.halfMorning.status === "tentative" || detail.halfEvening.status === "tentative") return "tentative";
  if (detail.halfMorning.status === "booked" || detail.halfEvening.status === "booked") return "booked";
  if (detail.fullDay.status === "unavailable" && detail.hourly.status === "unavailable") return "unavailable";
  return "available";
}

function getBlockDetail(dateKey) {
  const day = bookingData[dateKey] || {};
  const hourly = normalizeHourly(day.hourly || []);
  const fullExplicit = normalizeStatus(day.fullDay) || null;
  const amExplicit = normalizeStatus(day.halfMorning) || null;
  const pmExplicit = normalizeStatus(day.halfEvening) || null;

  const fullDay = { status: "available", label: toLabel("available") };
  const halfMorning = { status: "available", label: toLabel("available") };
  const halfEvening = { status: "available", label: toLabel("available") };

  if (fullExplicit && fullExplicit !== "available") {
    fullDay.status = fullExplicit;
    fullDay.label = toLabel(fullExplicit);
    halfMorning.status = "unavailable";
    halfMorning.label = toLabel("unavailable");
    halfEvening.status = "unavailable";
    halfEvening.label = toLabel("unavailable");
  } else {
    if (amExplicit) {
      halfMorning.status = amExplicit;
      halfMorning.label = toLabel(amExplicit);
    }
    if (pmExplicit) {
      halfEvening.status = pmExplicit;
      halfEvening.label = toLabel(pmExplicit);
    }

    hourly.valid.forEach((slot) => {
      if (overlaps(slot.start, slot.end, 8, 14) && halfMorning.status === "available") {
        halfMorning.status = "unavailable";
        halfMorning.label = toLabel("unavailable");
      }
      if (overlaps(slot.start, slot.end, 15, 21) && halfEvening.status === "available") {
        halfEvening.status = "unavailable";
        halfEvening.label = toLabel("unavailable");
      }
    });

    const anyBlocker =
      halfMorning.status !== "available" ||
      halfEvening.status !== "available" ||
      hourly.valid.length > 0;
    if (anyBlocker) {
      fullDay.status = "unavailable";
      fullDay.label = toLabel("unavailable");
    }
  }

  const hasInvalidHourly = hourly.invalid.length > 0;
  const amOpenForHourly = halfMorning.status === "available";
  const pmOpenForHourly = halfEvening.status === "available";
  const anyHourlyOpenWindow = amOpenForHourly || pmOpenForHourly;
  const hourlyStatus = hourly.valid.some((slot) => slot.status === "tentative")
    ? "tentative"
    : hourly.valid.some((slot) => slot.status === "booked")
      ? "booked"
      : anyHourlyOpenWindow
        ? "available"
        : "unavailable";

  let hourlyNote = anyHourlyOpenWindow ? "Call for available times." : "No hourly windows available for this date.";
  if (hasInvalidHourly) {
    hourlyNote = "Call for available times (one or more holds need review).";
  } else if (hourly.valid.length > 0) {
    hourlyNote = `Filled hourly blocks: ${hourly.valid.map((slot) => `${formatHour(slot.start)}-${formatHour(slot.end)} (${toLabel(slot.status)})`).join(", ")}`;
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
    const crossesHalfBlocks = start < 14 && end > 15;
    const straddlesBreak = start < 15 && end > 14;

    if (!inRange || crossesHalfBlocks || straddlesBreak) {
      invalid.push({ start, end, status });
    } else {
      valid.push({ start, end, status });
    }
  });

  return { valid, invalid };
}

async function loadBookingData() {
  const { data, error } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots")
    .order("date", { ascending: true });

  if (error || !Array.isArray(data)) {
    return {};
  }

  const map = {};
  data.forEach((row) => {
    if (!row?.date) return;

    map[row.date] = {
      fullDay: normalizeStatus(row.full_day) || undefined,
      halfMorning: normalizeStatus(row.half_morning) || undefined,
      halfEvening: normalizeStatus(row.half_evening) || undefined,
      hourly: Array.isArray(row.hourly_slots)
        ? row.hourly_slots.map((slot) => ({
            start: Number(slot.start),
            end: Number(slot.end),
            status: normalizeStatus(slot.status) || "booked",
          }))
        : [],
    };
  });

  return map;
}

async function setSignedInState(email) {
  authPanel?.classList.add("hidden");
  appPanel?.classList.remove("hidden");
  if (userLine) userLine.textContent = `Signed in as ${email}`;
}

function setSignedOutState() {
  authPanel?.classList.remove("hidden");
  appPanel?.classList.add("hidden");
  if (userLine) userLine.textContent = "";
}

function setMessage(node, message, isError = false) {
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", isError);
}

function syncSelectors() {
  monthSelect.value = String(activeMonth);
  yearSelect.value = String(activeYear);
}

function nullIfEmpty(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "booked" || trimmed === "tentative" || trimmed === "available") return trimmed;
  return null;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "booked" || normalized === "tentative" || normalized === "available") return normalized;
  return "";
}

function parseAllowedEmails(raw) {
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function canUseManager(email, allowedEmails) {
  if (!email) return false;
  if (!allowedEmails.size) return true;
  return allowedEmails.has(email.toLowerCase());
}

async function applyCustomRange() {
  const startDate = String(rangeStartDateInput?.value || "");
  const endDate = String(rangeEndDateInput?.value || "");
  const startTime = String(rangeStartTimeInput?.value || "");
  const endTime = String(rangeEndTimeInput?.value || "");

  if (!startDate || !endDate || !startTime || !endTime) {
    setMessage(saveMessage, "Set start/end date and start/end time for the range.", true);
    return;
  }
  if (endDate < startDate) {
    setMessage(saveMessage, "End date must be on or after start date.", true);
    return;
  }

  const startHour = timeToHour(startTime);
  const endHour = timeToHour(endTime);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
    setMessage(saveMessage, "Time range is invalid.", true);
    return;
  }

  setMessage(saveMessage, "Applying custom time range...");

  const { data: existingRows, error: fetchError } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots")
    .gte("date", startDate)
    .lte("date", endDate);

  if (fetchError) {
    setMessage(saveMessage, `Range load failed: ${fetchError.message}`, true);
    return;
  }

  const existingMap = new Map((existingRows || []).map((row) => [row.date, row]));
  const updates = [];
  const fullDayRange = startHour <= 8 && endHour >= 21;

  for (const date of eachDateKey(startDate, endDate)) {
    const row = existingMap.get(date) || {};
    const payload = {
      date,
      full_day: normalizeStatus(row.full_day) || null,
      half_morning: normalizeStatus(row.half_morning) || null,
      half_evening: normalizeStatus(row.half_evening) || null,
      hourly_slots: Array.isArray(row.hourly_slots) ? row.hourly_slots : [],
    };

    if (fullDayRange) {
      payload.full_day = "booked";
      payload.half_morning = null;
      payload.half_evening = null;
      payload.hourly_slots = [];
    } else if (payload.full_day !== "booked") {
      payload.full_day = null;
      if (overlaps(startHour, endHour, 8, 14)) payload.half_morning = "booked";
      if (overlaps(startHour, endHour, 15, 21)) payload.half_evening = "booked";
    }

    updates.push(payload);
  }

  if (!updates.length) {
    setMessage(saveMessage, "No dates in range to update.", true);
    return;
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(updates, { onConflict: "date" });
  if (upsertError) {
    setMessage(saveMessage, `Range apply failed: ${upsertError.message}`, true);
    return;
  }

  await refreshCalendar(startDate);
  setMessage(saveMessage, `Applied booked range to ${updates.length} date(s).`);
}

async function resolveAgreementUrl(dateKey) {
  const manualUrl = cleanText(agreementUrlInput?.value);
  const file = agreementFileInput?.files?.[0];
  if (!file) return { value: manualUrl };

  const bucket = (import.meta.env.VITE_SUPABASE_AGREEMENTS_BUCKET || "rental-agreements").trim();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `agreements/${dateKey}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (uploadError) {
    return { error: `File upload failed: ${uploadError.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { value: data?.publicUrl || manualUrl };
}

function renderReservationSummary(reservations) {
  if (!reservationSummary) return;
  if (!reservations.length) {
    reservationSummary.innerHTML = "<strong>Reservation Details</strong><br />No reservations stored for this date yet.";
    return;
  }
  reservationSummary.innerHTML = `<strong>Reservation Details</strong><br />${reservations.length} reservation(s) on this date.`;
}

async function loadAndRenderReservations(dateKey) {
  const { data, error } = await supabase
    .from("booking_reservations")
    .select("id, date, booking_type, start_hour, end_hour, status, renter_name, renter_email, renter_phone, event_type, payment_status, rental_agreement_url")
    .eq("date", dateKey)
    .order("start_hour", { ascending: true });

  if (error) {
    reservationData[dateKey] = [];
    renderReservationSummary([]);
    if (reservationsList) {
      reservationsList.innerHTML = `<a href="#"><strong>Unable to load reservations</strong><span>${escapeHtml(error.message)}</span></a>`;
    }
    renderSlotReservationPanel(dateKey, activeSlot);
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  reservationData[dateKey] = rows;
  renderReservationSummary(rows);
  renderSlotReservationPanel(dateKey, activeSlot);

  if (!reservationsList) return;
  if (!rows.length) {
    reservationsList.innerHTML = `<a href="#"><strong>No reservation records yet</strong><span>Add details and click Save Reservation Details</span></a>`;
    return;
  }

  reservationsList.innerHTML = rows
    .map((row) => {
      const agreement = row.rental_agreement_url
        ? `<span><a href="${row.rental_agreement_url}" target="_blank" rel="noopener noreferrer">Agreement</a></span>`
        : "<span>No agreement</span>";
      return `<div class="manager-reservation-item"><strong>${escapeHtml(slotLabel(row.booking_type, row.start_hour, row.end_hour))} | ${escapeHtml(toLabel(row.status || "booked"))}</strong><span>${escapeHtml(row.renter_name || "Unknown")} | ${escapeHtml(paymentLabel(row.payment_status))}</span>${agreement}</div>`;
    })
    .join("");
}

function renderSlotReservationPanel(dateKey, slot) {
  if (!slotDetailPanel) return;

  blockStatus?.querySelectorAll(".block-card").forEach((card) => {
    card.classList.toggle("is-active", card.getAttribute("data-slot") === slot);
  });

  if (!slot) {
    slotDetailPanel.innerHTML = "Click a status card to view reservation details for that slot.";
    return;
  }

  const status = blockStatus?.querySelector(`.block-card[data-slot="${slot}"]`)?.getAttribute("data-status") || "available";
  if (status !== "booked" && status !== "tentative") {
    slotDetailPanel.innerHTML = `<strong>${escapeHtml(slotLabel(slot))}</strong><br />No booked customer record for this slot.`;
    return;
  }

  const reservations = getReservationsForSlot(dateKey, slot);
  if (!reservations.length) {
    slotDetailPanel.innerHTML = `<strong>${escapeHtml(slotLabel(slot))}</strong><br />Slot is marked ${escapeHtml(status)}, but no customer details are attached yet.`;
    return;
  }

  slotDetailPanel.innerHTML = reservations
    .map((row) => {
      const agreementLink = row.rental_agreement_url
        ? `<a href="${row.rental_agreement_url}" target="_blank" rel="noopener noreferrer">Open Agreement</a>`
        : "No agreement uploaded";
      return `
        <div class="manager-slot-record">
          <details>
            <summary>${escapeHtml(row.renter_name || "Unknown")} | ${escapeHtml(slotLabel(row.booking_type, row.start_hour, row.end_hour))}</summary>
            <p class="muted">Email: ${escapeHtml(row.renter_email || "Not set")}</p>
            <p class="muted">Phone: ${escapeHtml(row.renter_phone || "Not provided")}</p>
            <p class="muted">Event: ${escapeHtml(row.event_type || "Not set")}</p>
            <p class="muted">Payment: ${escapeHtml(paymentLabel(row.payment_status))}</p>
            <p class="muted">Agreement: ${agreementLink}</p>
            <button type="button" class="btn alt" data-load-reservation-id="${row.id}">Load Full Customer Card</button>
          </details>
        </div>
      `;
    })
    .join("");
}

function getReservationsForSlot(dateKey, slot) {
  const rows = reservationData[dateKey] || [];
  if (slot === "full_day") return rows.filter((row) => row.booking_type === "full_day");
  if (slot === "half_morning") return rows.filter((row) => row.booking_type === "half_morning" || (row.booking_type === "custom" && overlaps(Number(row.start_hour), Number(row.end_hour), 8, 14)));
  if (slot === "half_evening") return rows.filter((row) => row.booking_type === "half_evening" || (row.booking_type === "custom" && overlaps(Number(row.start_hour), Number(row.end_hour), 15, 21)));
  if (slot === "hourly") return rows.filter((row) => row.booking_type === "custom");
  return [];
}

function loadReservationIntoEditor(reservationId) {
  const rows = reservationData[selectedKey] || [];
  const record = rows.find((row) => Number(row.id) === Number(reservationId));
  if (!record) {
    setMessage(saveMessage, "Reservation record not found.", true);
    return;
  }

  if (reservationSlotInput) reservationSlotInput.value = record.booking_type || "";
  if (reservationStartTimeInput && Number.isFinite(Number(record.start_hour))) reservationStartTimeInput.value = hourToTime(Number(record.start_hour));
  if (reservationEndTimeInput && Number.isFinite(Number(record.end_hour))) reservationEndTimeInput.value = hourToTime(Number(record.end_hour));
  if (renterNameInput) renterNameInput.value = record.renter_name || "";
  if (renterEmailInput) renterEmailInput.value = record.renter_email || "";
  if (renterPhoneInput) renterPhoneInput.value = record.renter_phone || "";
  if (eventTypeInput) eventTypeInput.value = record.event_type || "";
  if (paymentStatusInput) paymentStatusInput.value = normalizePaymentStatus(record.payment_status) || "";
  if (agreementUrlInput) agreementUrlInput.value = record.rental_agreement_url || "";
  if (agreementFileInput) agreementFileInput.value = "";

  setMessage(saveMessage, "Loaded reservation details into the editor.");
}
async function saveReservationForSelectedDate() {
  if (!dateInput.value) {
    setMessage(saveMessage, "Pick a date first.", true);
    return;
  }

  const renterName = cleanText(renterNameInput?.value);
  const renterEmail = cleanText(renterEmailInput?.value);
  const slot = cleanText(reservationSlotInput?.value);
  const paymentStatus = normalizePaymentStatus(paymentStatusInput?.value);

  if (!slot) {
    setMessage(saveMessage, "Choose a booking slot for this reservation.", true);
    return;
  }
  if (!renterName || !renterEmail) {
    setMessage(saveMessage, "Renter name and email are required.", true);
    return;
  }

  const slotRange = getSlotRange(slot, reservationStartTimeInput?.value, reservationEndTimeInput?.value);
  if (slotRange.error) {
    setMessage(saveMessage, slotRange.error, true);
    return;
  }

  const agreementUrl = await resolveAgreementUrl(dateInput.value);
  if (agreementUrl.error) {
    setMessage(saveMessage, agreementUrl.error, true);
    return;
  }

  const payload = {
    date: dateInput.value,
    booking_type: slotRange.bookingType,
    start_hour: slotRange.start,
    end_hour: slotRange.end,
    status: "booked",
    renter_name: renterName,
    renter_email: renterEmail,
    renter_phone: cleanText(renterPhoneInput?.value),
    event_type: cleanText(eventTypeInput?.value),
    payment_status: paymentStatus || "needs_payment",
    rental_agreement_url: agreementUrl.value,
  };

  const { error } = await supabase
    .from("booking_reservations")
    .upsert(payload, { onConflict: "date,start_hour,end_hour" });

  if (error) {
    setMessage(saveMessage, `Reservation save failed: ${error.message}`, true);
    return;
  }

  await applyReservationToAvailability(dateInput.value, slotRange);
  setMessage(saveMessage, "Reservation details saved.");
  await loadAndRenderReservations(dateInput.value);
  await refreshCalendar(dateInput.value);
}

function disableForms() {
  document.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = true;
  });
}

function toLabel(status) {
  if (status === "booked") return "Booked";
  if (status === "tentative") return "Tentative";
  if (status === "unavailable") return "Unavailable";
  return "Available";
}

function paymentLabel(status) {
  if (status === "paid_in_full") return "Paid In Full";
  if (status === "paid_down_payment") return "Paid Down Payment";
  if (status === "needs_payment") return "Needs Payment";
  return "Not set";
}

function slotLabel(type, startHour, endHour) {
  if (type === "full_day") return "Full Day (8:00 AM - 9:00 PM)";
  if (type === "half_morning") return "Half Day AM (8:00 AM - 2:00 PM)";
  if (type === "half_evening") return "Half Day PM (3:00 PM - 9:00 PM)";
  if (Number.isFinite(Number(startHour)) && Number.isFinite(Number(endHour))) {
    return `${formatHour(startHour)}-${formatHour(endHour)}`;
  }
  return "Custom Slot";
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function formatHour(hour24) {
  const hour = Number(hour24);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

function timeToHour(value) {
  const [h, m] = String(value).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h + m / 60;
}

function hourToTime(hourValue) {
  const hour = Math.floor(Number(hourValue));
  const minutes = Math.round((Number(hourValue) - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getSlotRange(slot, customStartValue, customEndValue) {
  if (slot === "full_day") return { bookingType: "full_day", start: 8, end: 21 };
  if (slot === "half_morning") return { bookingType: "half_morning", start: 8, end: 14 };
  if (slot === "half_evening") return { bookingType: "half_evening", start: 15, end: 21 };
  if (slot === "custom") {
    const start = timeToHour(customStartValue);
    const end = timeToHour(customEndValue);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { error: "Custom start/end time is invalid." };
    }
    if (start < 8 || end > 21) {
      return { error: "Custom time must stay between 8:00 AM and 9:00 PM." };
    }
    return { bookingType: "custom", start, end };
  }
  return { error: "Invalid booking slot." };
}

function* eachDateKey(startDate, endDate) {
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (current <= last) {
    yield toDateKey(current);
    current.setDate(current.getDate() + 1);
  }
}

function cleanText(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function normalizePaymentStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "paid_in_full" || normalized === "paid_down_payment" || normalized === "needs_payment") {
    return normalized;
  }
  return null;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function applyReservationToAvailability(date, slotRange) {
  const { data: existing } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots")
    .eq("date", date)
    .maybeSingle();

  const payload = {
    date,
    full_day: normalizeStatus(existing?.full_day) || null,
    half_morning: normalizeStatus(existing?.half_morning) || null,
    half_evening: normalizeStatus(existing?.half_evening) || null,
    hourly_slots: Array.isArray(existing?.hourly_slots) ? existing.hourly_slots : [],
  };

  if (slotRange.bookingType === "full_day") {
    payload.full_day = "booked";
    payload.half_morning = null;
    payload.half_evening = null;
    payload.hourly_slots = [];
  } else if (payload.full_day !== "booked") {
    payload.full_day = null;
    if (slotRange.bookingType === "half_morning") payload.half_morning = "booked";
    if (slotRange.bookingType === "half_evening") payload.half_evening = "booked";
    if (slotRange.bookingType === "custom") {
      const exists = payload.hourly_slots.some((slot) => Number(slot.start) === slotRange.start && Number(slot.end) === slotRange.end);
      if (!exists) payload.hourly_slots.push({ start: slotRange.start, end: slotRange.end, status: "booked" });
    }
  }

  await supabase.from("bookings").upsert(payload, { onConflict: "date" });
}

