import { createClient } from "@supabase/supabase-js";

const authPanel = document.querySelector("#manager-auth-panel");
const appPanel = document.querySelector("#manager-app-panel");
const loginForm = document.querySelector("#manager-login-form");
const authMessage = document.querySelector("#manager-auth-message");
const saveMessage = document.querySelector("#manager-save-message");
const userLine = document.querySelector("#manager-user");
const signoutButton = document.querySelector("#manager-signout");

const openBookingModalButton = document.querySelector("#manager-open-booking-modal");
const bookingModal = document.querySelector("#manager-booking-modal");
const bookingModalCloseButton = document.querySelector("#manager-booking-modal-close");
const bookingModalDateLabel = document.querySelector("#manager-modal-date-label");
const reservationDateInput = document.querySelector("#manager-reservation-date");
const reservationSlotInput = document.querySelector("#manager-reservation-slot");
const customTimeRow = document.querySelector("#manager-custom-time-row");
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

const calendarGrid = document.querySelector("#manager-calendar-grid");
const monthSelect = document.querySelector("#manager-month");
const yearSelect = document.querySelector("#manager-year");
const prevMonthButton = document.querySelector("#manager-prev-month");
const nextMonthButton = document.querySelector("#manager-next-month");
const selectedDateTitle = document.querySelector("#manager-selected-date");
const blockStatus = document.querySelector("#manager-block-status");
const markDateUnavailableButton = document.querySelector("#manager-mark-date-unavailable");
const markDateAvailableButton = document.querySelector("#manager-mark-date-available");

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
let bookingReasonColumnsAvailable = true;

if (loginForm && calendarGrid && monthSelect && yearSelect) {
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
}

function wireEvents(allowedEmails) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(authMessage, "Signing in...");

    const email = String(document.querySelector("#manager-email")?.value || "").trim();
    const password = String(document.querySelector("#manager-password")?.value || "");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(authMessage, error.message, true);
        return;
      }

      const signedInEmail = data.user?.email || data.session?.user?.email || "";
      if (!canUseManager(signedInEmail, allowedEmails)) {
        await supabase.auth.signOut();
        setMessage(authMessage, "This account is not approved for manager access.", true);
        return;
      }

      await setSignedInState(signedInEmail);
      await refreshCalendar();
    } catch (error) {
      const message = String(error?.message || error || "");
      if (/failed to fetch/i.test(message)) {
        setMessage(
          authMessage,
          "Unable to reach Supabase. Check VITE_SUPABASE_URL in .env (project URL) and restart the dev server.",
          true
        );
        return;
      }
      setMessage(authMessage, message || "Sign in failed.", true);
    }
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
    const button = event.target.closest("[data-load-reservation-id]");
    if (button) {
      const id = Number(button.getAttribute("data-load-reservation-id"));
      if (!Number.isFinite(id)) return;
      loadReservationIntoEditor(id);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-reservation-id]");
    if (deleteButton) {
      const id = Number(deleteButton.getAttribute("data-delete-reservation-id"));
      if (!Number.isFinite(id)) return;
      void deleteReservationById(id);
      return;
    }

    const addButton = event.target.closest("[data-add-slot]");
    if (addButton) {
      const slot = String(addButton.getAttribute("data-add-slot") || "");
      if (!slot) return;
      openBookingModalForSlot(slot);
      return;
    }

    const unavailableButton = event.target.closest("[data-mark-unavailable-slot]");
    if (unavailableButton) {
      const slot = String(unavailableButton.getAttribute("data-mark-unavailable-slot") || "");
      if (!slot) return;
      void markSlotUnavailable(selectedKey, slot);
      return;
    }

    const availableButton = event.target.closest("[data-mark-available-slot]");
    if (availableButton) {
      const slot = String(availableButton.getAttribute("data-mark-available-slot") || "");
      if (!slot) return;
      void markSlotAvailable(selectedKey, slot);
      return;
    }

    if (event.target.closest(".block-card-detail")) return;

    const card = event.target.closest(".block-card[data-slot]");
    if (!card) return;
    const slot = String(card.dataset.slot || "");
    if (!slot) return;
    activeSlot = slot;
    renderSlotReservationPanel(selectedKey, slot);
  });

  reservationSlotInput?.addEventListener("change", () => {
    updateCustomTimeVisibility();
  });

  openBookingModalButton?.addEventListener("click", () => {
    resetBookingModalFields();
    if (activeSlot && activeSlot !== "hourly") reservationSlotInput.value = activeSlot;
    openBookingModal();
  });

  markDateUnavailableButton?.addEventListener("click", () => {
    void markDateUnavailable(selectedKey);
  });
  markDateAvailableButton?.addEventListener("click", () => {
    void markDateAvailable(selectedKey);
  });

  reservationDateInput?.addEventListener("change", () => {
    const value = String(reservationDateInput.value || "");
    if (bookingModalDateLabel) bookingModalDateLabel.textContent = value || selectedKey;
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

  updateDateActionButtons(dateKey);
  const detail = getBlockDetail(dateKey);
  const customCards = getCustomCardsForDate(dateKey);
  const customCardsHtml = customCards
    .map((card) => `
      <article class="block-card" data-slot="${escapeHtml(card.slot)}" data-status="${escapeHtml(card.status)}">
        <h3>Custom Time</h3>
        <p class="muted">${escapeHtml(card.range)}</p>
        <p class="status-pill status-${escapeHtml(card.status)}">${escapeHtml(card.label)}</p>
      </article>
    `)
    .join("");

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
      <p class="muted">${escapeHtml(detail.hourly.note)}</p>
      <p class="status-pill status-${detail.hourly.status}">${detail.hourly.label}</p>
    </article>
    ${customCardsHtml}
  `;
  if (activeSlot && !blockStatus.querySelector(`.block-card[data-slot="${activeSlot}"]`)) {
    activeSlot = "";
  }
  renderSlotReservationPanel(dateKey, activeSlot);
}

function updateDateActionButtons(dateKey) {
  const dayStatus = getDayStatus(dateKey);
  const canMarkUnavailable = dayStatus === "available";
  const canMarkAvailable = dayStatus === "unavailable";
  markDateUnavailableButton?.classList.toggle("hidden", !canMarkUnavailable);
  markDateAvailableButton?.classList.toggle("hidden", !canMarkAvailable);
}

function populateEditorFromDate(dateKey) {
  resetBookingModalFields();
  if (bookingModalDateLabel) bookingModalDateLabel.textContent = dateKey;
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
  const fullExplicit = normalizeStatus(day.fullDay) || null;
  const amExplicit = normalizeStatus(day.halfMorning) || null;
  const pmExplicit = normalizeStatus(day.halfEvening) || null;

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
  const openWindows = getOpenHourlyWindows({
    fullExplicit,
    halfMorningStatus: halfMorning.status,
    halfEveningStatus: halfEvening.status,
    hourlySlots: hourly.valid,
  });
  const anyHourlyOpenWindow = openWindows.length > 0;
  const hourlyStatus = anyHourlyOpenWindow
    ? "available"
    : hourly.valid.some((slot) => slot.status === "tentative")
      ? "tentative"
      : hourly.valid.some((slot) => slot.status === "booked")
        ? "booked"
        : "unavailable";

  let hourlyNote = anyHourlyOpenWindow
    ? `Available hourly times: ${openWindows.map((window) => formatTimeWindow(window.start, window.end)).join(", ")}`
    : "No hourly windows available for this date.";
  if (hasInvalidHourly) {
    hourlyNote += " One or more holds need review.";
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

function getOpenHourlyWindows({ fullExplicit, halfMorningStatus, halfEveningStatus, hourlySlots }) {
  void halfMorningStatus;
  void halfEveningStatus;
  if (fullExplicit === "unavailable") return [];
  if ((fullExplicit === "booked" || fullExplicit === "tentative") && !hourlySlots.length) return [];
  const minWindow = 4;
  const bufferHours = 0.5;

  const blocked = [];
  hourlySlots
    .filter((slot) => slot.status === "booked" || slot.status === "tentative" || slot.status === "unavailable")
    .forEach((slot) => {
      blocked.push({
        start: Number(slot.start) - bufferHours,
        end: Number(slot.end) + bufferHours,
      });
    });

  const merged = mergeRanges(blocked, 8, 21);
  return invertRanges(merged, 8, 21).filter((window) => window.end - window.start >= minWindow);
}

function mergeRanges(ranges, min, max) {
  const normalized = ranges
    .map((range) => ({
      start: Math.max(min, Number(range.start)),
      end: Math.min(max, Number(range.end)),
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (!normalized.length) return [];

  const merged = [normalized[0]];
  for (let i = 1; i < normalized.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = normalized[i];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function invertRanges(blocked, min, max) {
  if (!blocked.length) return [{ start: min, end: max }];
  const open = [];
  let cursor = min;
  blocked.forEach((range) => {
    if (range.start > cursor) open.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  });
  if (cursor < max) open.push({ start: cursor, end: max });
  return open;
}

function formatTimeWindow(start, end) {
  return `${formatHour(start)} - ${formatHour(end)}`;
}

async function loadBookingData() {
  const selectFields = bookingReasonColumnsAvailable
    ? "date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason"
    : "date, full_day, half_morning, half_evening, hourly_slots";
  const { data, error } = await supabase
    .from("bookings")
    .select(selectFields)
    .order("date", { ascending: true });

  if (error && bookingReasonColumnsAvailable && isMissingColumnError(error)) {
    bookingReasonColumnsAvailable = false;
    return await loadBookingData();
  }
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
      fullDayReason: normalizeReason(row.full_day_reason),
      halfMorningReason: normalizeReason(row.half_morning_reason),
      halfEveningReason: normalizeReason(row.half_evening_reason),
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
  if (trimmed === "booked" || trimmed === "tentative" || trimmed === "available" || trimmed === "unavailable") return trimmed;
  return null;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "booked" || normalized === "tentative" || normalized === "available" || normalized === "unavailable") return normalized;
  return "";
}

function normalizeReason(value) {
  const reason = String(value || "").trim();
  return reason || "";
}

function isMissingColumnError(error) {
  const text = String(error?.message || "").toLowerCase();
  return text.includes("column") && text.includes("does not exist");
}

function setBookedUnlessTentative(currentStatus) {
  if (currentStatus === "tentative") return currentStatus;
  return "booked";
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
  void reservations;
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
    setMessage(saveMessage, `Unable to load reservations: ${error.message}`, true);
    renderSlotReservationPanel(dateKey, activeSlot);
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  reservationData[dateKey] = rows;
  renderReservationSummary(rows);
  renderDayDetails(dateKey);
}

function renderSlotReservationPanel(dateKey, slot) {
  blockStatus?.querySelectorAll(".block-card").forEach((card) => {
    const inlinePanel = card.querySelector(".block-card-detail");
    if (inlinePanel) inlinePanel.remove();
    card.classList.toggle("is-active", card.getAttribute("data-slot") === slot);
  });

  if (!slot) return;

  const targetCard = blockStatus?.querySelector(`.block-card[data-slot="${slot}"]`);
  if (!targetCard) return;
  const status = blockStatus?.querySelector(`.block-card[data-slot="${slot}"]`)?.getAttribute("data-status") || "available";
  const customReservation = getCustomReservationBySlot(dateKey, slot);
  const slotName = customReservation
    ? slotLabel("custom", customReservation.start_hour, customReservation.end_hour)
    : slotLabel(slot);
  let detailHtml = "";
  if (status === "available") {
    const unavailableButton = isCoreSlot(slot)
      ? `<button type="button" class="btn alt" data-mark-unavailable-slot="${escapeHtml(slot)}">Mark Unavailable</button>`
      : "";
    detailHtml = `
      <strong>${escapeHtml(slotName)}</strong><br />
      No booked customer record for this slot.<br />
      <button type="button" class="btn" data-add-slot="${escapeHtml(slot)}">Add Booking</button>
      ${unavailableButton}
    `;
  } else if (status === "unavailable") {
    const reason = getUnavailableReason(dateKey, slot);
    const availableButton = isCoreSlot(slot)
      ? `<button type="button" class="btn alt" data-mark-available-slot="${escapeHtml(slot)}">Mark Available</button>`
      : "";
    detailHtml = `
      <strong>${escapeHtml(slotName)}</strong><br />
      Slot is marked unavailable.${reason ? `<br /><span class="muted"><strong>Reason:</strong> ${escapeHtml(reason)}</span>` : ""}
      ${availableButton}
    `;
  } else {
    const reservations = getReservationsForSlot(dateKey, slot);
    if (!reservations.length) {
      detailHtml = `<strong>${escapeHtml(slotName)}</strong><br />Slot is marked ${escapeHtml(status)}, but no customer details are attached yet.`;
    } else {
      detailHtml = reservations
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
                <button type="button" class="btn alt" data-delete-reservation-id="${row.id}">Delete Booking</button>
              </details>
            </div>
          `;
        })
        .join("");
    }
  }

  const inlinePanel = document.createElement("div");
  inlinePanel.className = "manager-slot-detail-panel block-card-detail";
  inlinePanel.innerHTML = detailHtml;
  targetCard.append(inlinePanel);
}

function getReservationsForSlot(dateKey, slot) {
  const rows = reservationData[dateKey] || [];
  const customId = parseCustomSlotId(slot);
  if (customId) return rows.filter((row) => row.booking_type === "custom" && Number(row.id) === customId);
  if (slot === "full_day") return rows.filter((row) => row.booking_type === "full_day");
  if (slot === "half_morning") return rows.filter((row) => row.booking_type === "half_morning" || (row.booking_type === "custom" && overlaps(Number(row.start_hour), Number(row.end_hour), 8, 14)));
  if (slot === "half_evening") return rows.filter((row) => row.booking_type === "half_evening" || (row.booking_type === "custom" && overlaps(Number(row.start_hour), Number(row.end_hour), 15, 21)));
  if (slot === "hourly") return rows.filter((row) => row.booking_type === "custom");
  return [];
}

function getCustomCardsForDate(dateKey) {
  const rows = reservationData[dateKey] || [];
  return rows
    .filter((row) => row.booking_type === "custom" && Number.isFinite(Number(row.id)))
    .sort((a, b) => Number(a.start_hour) - Number(b.start_hour))
    .map((row) => {
      const status = normalizeStatus(row.status) || "booked";
      return {
        slot: `custom:${Number(row.id)}`,
        status,
        label: toLabel(status),
        range: `${formatHour(row.start_hour)} - ${formatHour(row.end_hour)}`,
      };
    });
}

function isCoreSlot(slot) {
  return slot === "full_day" || slot === "half_morning" || slot === "half_evening";
}

function getUnavailableReason(dateKey, slot) {
  const day = bookingData[dateKey] || {};
  if (slot === "full_day") return String(day.fullDayReason || "").trim();
  if (slot === "half_morning") return String(day.halfMorningReason || "").trim();
  if (slot === "half_evening") return String(day.halfEveningReason || "").trim();
  return "";
}

function requireUnavailableReason(label) {
  while (true) {
    const input = window.prompt(`Reason for marking ${label} unavailable:`);
    if (input === null) return null;
    const reason = String(input).trim();
    if (reason) return reason;
    setMessage(saveMessage, "Reason for unavailable is required.", true);
  }
}

async function markSlotUnavailable(dateKey, slot) {
  if (!isCoreSlot(slot)) return;
  const detail = getBlockDetail(dateKey);
  const current =
    slot === "full_day"
      ? detail.fullDay.status
      : slot === "half_morning"
        ? detail.halfMorning.status
        : detail.halfEvening.status;

  if (current === "booked" || current === "tentative") {
    setMessage(saveMessage, "That slot is booked/tentative and cannot be set unavailable.", true);
    return;
  }

  const reason = requireUnavailableReason(slotLabel(slot));
  if (reason === null) return;

  const result = await applyManualUnavailable(dateKey, slot, reason);
  if (result?.error) {
    setMessage(saveMessage, `Unable to mark unavailable: ${result.error}`, true);
    return;
  }

  setMessage(saveMessage, `${slotLabel(slot)} marked unavailable.`);
  await refreshCalendar(dateKey);
}

async function markDateUnavailable(dateKey) {
  const detail = getBlockDetail(dateKey);
  const rows = reservationData[dateKey] || [];
  const hasBookedReservation = rows.some((row) => {
    const status = normalizeStatus(row.status) || "booked";
    return status === "booked" || status === "tentative";
  });
  const core = [detail.fullDay.status, detail.halfMorning.status, detail.halfEvening.status];
  const hasCoreBooked = core.includes("booked") || core.includes("tentative");
  if (hasCoreBooked || hasBookedReservation) {
    setMessage(saveMessage, "Date has booked/tentative records. Clear those first before marking date unavailable.", true);
    return;
  }

  const reason = requireUnavailableReason("this date");
  if (reason === null) return;

  const result = await applyManualDateUnavailable(dateKey, reason);
  if (result?.error) {
    setMessage(saveMessage, `Unable to mark date unavailable: ${result.error}`, true);
    return;
  }

  setMessage(saveMessage, "Date marked unavailable.");
  await refreshCalendar(dateKey);
}

async function markSlotAvailable(dateKey, slot) {
  if (!isCoreSlot(slot)) return;
  const result = await clearManualUnavailable(dateKey, slot);
  if (result?.error) {
    setMessage(saveMessage, `Unable to mark available: ${result.error}`, true);
    return;
  }
  setMessage(saveMessage, `${slotLabel(slot)} marked available.`);
  await refreshCalendar(dateKey);
}

async function markDateAvailable(dateKey) {
  const result = await clearManualDateUnavailable(dateKey);
  if (result?.error) {
    setMessage(saveMessage, `Unable to mark date available: ${result.error}`, true);
    return;
  }
  setMessage(saveMessage, "Date marked available.");
  await refreshCalendar(dateKey);
}

function parseCustomSlotId(slot) {
  const raw = String(slot || "");
  if (!raw.startsWith("custom:")) return 0;
  const id = Number(raw.split(":")[1]);
  return Number.isFinite(id) ? id : 0;
}

function getCustomReservationBySlot(dateKey, slot) {
  const id = parseCustomSlotId(slot);
  if (!id) return null;
  const rows = reservationData[dateKey] || [];
  return rows.find((row) => row.booking_type === "custom" && Number(row.id) === id) || null;
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
  if (reservationDateInput) reservationDateInput.value = String(record.date || selectedKey);
  if (bookingModalDateLabel) bookingModalDateLabel.textContent = String(record.date || selectedKey);

  updateCustomTimeVisibility();
  setMessage(saveMessage, "Loaded reservation details into the editor.");
  openBookingModal();
}

async function deleteReservationById(reservationId) {
  const rows = reservationData[selectedKey] || [];
  const record = rows.find((row) => Number(row.id) === Number(reservationId));
  if (!record) {
    setMessage(saveMessage, "Reservation record not found.", true);
    return;
  }

  const summary = `${slotLabel(record.booking_type, record.start_hour, record.end_hour)} for ${record.renter_name || "Unknown"}`;
  const confirmed = window.confirm(`Delete booking: ${summary}? This cannot be undone.`);
  if (!confirmed) return;

  const bookingDate = String(record.date || selectedKey);
  const { error } = await supabase
    .from("booking_reservations")
    .delete()
    .eq("id", reservationId);

  if (error) {
    setMessage(saveMessage, `Delete failed: ${error.message}`, true);
    return;
  }

  const recalcResult = await rebuildAvailabilityForDate(bookingDate);
  if (recalcResult?.error) {
    setMessage(saveMessage, `Booking deleted, but availability rebuild failed: ${recalcResult.error}`, true);
    return;
  }

  setMessage(saveMessage, "Booking deleted.");
  await refreshCalendar(bookingDate);
}

function openBookingModalForSlot(slot) {
  resetBookingModalFields();
  if (reservationDateInput) reservationDateInput.value = selectedKey;
  if (bookingModalDateLabel) bookingModalDateLabel.textContent = selectedKey;
  if (reservationSlotInput) reservationSlotInput.value = parseCustomSlotId(slot) ? "custom" : slot;
  updateCustomTimeVisibility();
  openBookingModal();
}
async function saveReservationForSelectedDate() {
  const bookingDate = String(reservationDateInput?.value || selectedKey || "");
  if (!bookingDate) {
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

  const agreementUrl = await resolveAgreementUrl(bookingDate);
  if (agreementUrl.error) {
    setMessage(saveMessage, agreementUrl.error, true);
    updateSaveButtonState(false);
    return;
  }

  updateSaveButtonState(false, true);

  const payload = {
    date: bookingDate,
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
    updateSaveButtonState(false);
    return;
  }

  const availabilityResult = await applyReservationToAvailability(bookingDate, slotRange);
  if (availabilityResult?.error) {
    setMessage(saveMessage, `Saved reservation, but calendar update failed: ${availabilityResult.error}`, true);
    updateSaveButtonState(false);
    return;
  }
  selectedKey = bookingDate;
  setMessage(saveMessage, "Reservation details saved.");
  updateSaveButtonState(true);
  await loadAndRenderReservations(bookingDate);
  await refreshCalendar(bookingDate);
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

function openBookingModal() {
  if (!bookingModal) return;
  const dateValue = String(selectedKey || "");
  if (reservationDateInput) reservationDateInput.value = dateValue;
  if (bookingModalDateLabel) bookingModalDateLabel.textContent = dateValue;
  updateSaveButtonState(false);
  bookingModal.classList.remove("hidden");
  bookingModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeBookingModal() {
  if (!bookingModal) return;
  bookingModal.classList.add("hidden");
  bookingModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function resetBookingModalFields() {
  if (reservationDateInput) reservationDateInput.value = String(selectedKey || "");
  if (bookingModalDateLabel) bookingModalDateLabel.textContent = String(selectedKey || "");
  if (reservationSlotInput) reservationSlotInput.value = "";
  if (reservationStartTimeInput) reservationStartTimeInput.value = "08:00";
  if (reservationEndTimeInput) reservationEndTimeInput.value = "09:00";
  if (renterNameInput) renterNameInput.value = "";
  if (renterEmailInput) renterEmailInput.value = "";
  if (renterPhoneInput) renterPhoneInput.value = "";
  if (eventTypeInput) eventTypeInput.value = "";
  if (paymentStatusInput) paymentStatusInput.value = "";
  if (agreementUrlInput) agreementUrlInput.value = "";
  if (agreementFileInput) agreementFileInput.value = "";
  updateSaveButtonState(false);
  updateCustomTimeVisibility();
}

function updateSaveButtonState(isSaved, isSaving = false) {
  if (!saveReservationButton) return;
  if (isSaving) {
    saveReservationButton.textContent = "Saving...";
    saveReservationButton.disabled = true;
    return;
  }
  if (isSaved) {
    saveReservationButton.textContent = "Saved";
    saveReservationButton.disabled = false;
    return;
  }
  saveReservationButton.textContent = "Save Reservation Details";
  saveReservationButton.disabled = false;
}

function updateCustomTimeVisibility() {
  const isCustom = reservationSlotInput?.value === "custom";
  customTimeRow?.classList.toggle("hidden", !isCustom);
}

async function applyReservationToAvailability(date, slotRange) {
  const selectFields = bookingReasonColumnsAvailable
    ? "date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason"
    : "date, full_day, half_morning, half_evening, hourly_slots";
  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select(selectFields)
    .eq("date", date)
    .maybeSingle();
  if (loadError && bookingReasonColumnsAvailable && isMissingColumnError(loadError)) {
    bookingReasonColumnsAvailable = false;
    return await applyReservationToAvailability(date, slotRange);
  }
  if (loadError) return { error: loadError.message };

  const payload = {
    date,
    full_day: normalizeStatus(existing?.full_day) || null,
    half_morning: normalizeStatus(existing?.half_morning) || null,
    half_evening: normalizeStatus(existing?.half_evening) || null,
    hourly_slots: Array.isArray(existing?.hourly_slots) ? existing.hourly_slots : [],
  };
  if (bookingReasonColumnsAvailable) {
    payload.full_day_reason = normalizeReason(existing?.full_day_reason) || null;
    payload.half_morning_reason = normalizeReason(existing?.half_morning_reason) || null;
    payload.half_evening_reason = normalizeReason(existing?.half_evening_reason) || null;
  }

  if (slotRange.bookingType === "full_day") {
    payload.full_day = "booked";
    payload.half_morning = null;
    payload.half_evening = null;
    if (bookingReasonColumnsAvailable) {
      payload.full_day_reason = null;
      payload.half_morning_reason = null;
      payload.half_evening_reason = null;
    }
    payload.hourly_slots = [];
  } else if (payload.full_day !== "booked") {
    payload.full_day = null;
    if (bookingReasonColumnsAvailable) payload.full_day_reason = null;
    if (slotRange.bookingType === "half_morning") {
      payload.half_morning = "booked";
      if (bookingReasonColumnsAvailable) payload.half_morning_reason = null;
    }
    if (slotRange.bookingType === "half_evening") {
      payload.half_evening = "booked";
      if (bookingReasonColumnsAvailable) payload.half_evening_reason = null;
    }
    if (slotRange.bookingType === "custom") {
      const hitsMorning = overlaps(slotRange.start, slotRange.end, 8, 14);
      const hitsEvening = overlaps(slotRange.start, slotRange.end, 15, 21);

      if (hitsMorning && hitsEvening) {
        payload.full_day = setBookedUnlessTentative(payload.full_day);
        payload.half_morning = setBookedUnlessTentative(payload.half_morning);
        payload.half_evening = setBookedUnlessTentative(payload.half_evening);
        if (bookingReasonColumnsAvailable) {
          payload.full_day_reason = null;
          payload.half_morning_reason = null;
          payload.half_evening_reason = null;
        }
        const exists = payload.hourly_slots.some((slot) => Number(slot.start) === slotRange.start && Number(slot.end) === slotRange.end);
        if (!exists) payload.hourly_slots.push({ start: slotRange.start, end: slotRange.end, status: "booked" });
      } else {
        if (hitsMorning) {
          payload.half_morning = setBookedUnlessTentative(payload.half_morning);
          if (bookingReasonColumnsAvailable) payload.half_morning_reason = null;
        }
        if (hitsEvening) {
          payload.half_evening = setBookedUnlessTentative(payload.half_evening);
          if (bookingReasonColumnsAvailable) payload.half_evening_reason = null;
        }
        payload.full_day = setBookedUnlessTentative(payload.full_day);
        if (bookingReasonColumnsAvailable) payload.full_day_reason = null;
        const exists = payload.hourly_slots.some((slot) => Number(slot.start) === slotRange.start && Number(slot.end) === slotRange.end);
        if (!exists) payload.hourly_slots.push({ start: slotRange.start, end: slotRange.end, status: "booked" });
      }
    }
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

function mergeStatus(current, incoming) {
  if (incoming === "booked") return "booked";
  if (incoming === "tentative") return current === "booked" ? "booked" : "tentative";
  return current;
}

function toStoredStatus(status) {
  return status === "available" ? null : status;
}

async function rebuildAvailabilityForDate(date) {
  const reservationQuery = await supabase
    .from("booking_reservations")
    .select("id, date, booking_type, start_hour, end_hour, status")
    .eq("date", date);
  if (reservationQuery.error) return { error: reservationQuery.error.message };
  const reservations = Array.isArray(reservationQuery.data) ? reservationQuery.data : [];

  const selectFields = bookingReasonColumnsAvailable
    ? "date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason"
    : "date, full_day, half_morning, half_evening, hourly_slots";
  const existingQuery = await supabase
    .from("bookings")
    .select(selectFields)
    .eq("date", date)
    .maybeSingle();
  if (existingQuery.error && bookingReasonColumnsAvailable && isMissingColumnError(existingQuery.error)) {
    bookingReasonColumnsAvailable = false;
    return await rebuildAvailabilityForDate(date);
  }
  if (existingQuery.error) return { error: existingQuery.error.message };

  const existing = existingQuery.data || {};
  const manualFullUnavailable = normalizeStatus(existing.full_day) === "unavailable";
  const manualAmUnavailable = normalizeStatus(existing.half_morning) === "unavailable";
  const manualPmUnavailable = normalizeStatus(existing.half_evening) === "unavailable";

  let fullDay = manualFullUnavailable ? "unavailable" : "available";
  let halfMorning = manualAmUnavailable ? "unavailable" : "available";
  let halfEvening = manualPmUnavailable ? "unavailable" : "available";
  const hourlySlots = [];

  const fullReservationStatus = reservations
    .filter((row) => row.booking_type === "full_day")
    .reduce((acc, row) => mergeStatus(acc, normalizeStatus(row.status) || "booked"), "available");
  if (fullReservationStatus !== "available") {
    fullDay = fullReservationStatus;
  } else {
    reservations.forEach((row) => {
      const rowStatus = normalizeStatus(row.status) || "booked";
      const start = Number(row.start_hour);
      const end = Number(row.end_hour);
      const type = row.booking_type;
      if (type === "half_morning") halfMorning = mergeStatus(halfMorning, rowStatus);
      if (type === "half_evening") halfEvening = mergeStatus(halfEvening, rowStatus);
      if (type === "custom" && Number.isFinite(start) && Number.isFinite(end) && end > start) {
        if (overlaps(start, end, 8, 14)) halfMorning = mergeStatus(halfMorning, rowStatus);
        if (overlaps(start, end, 15, 21)) halfEvening = mergeStatus(halfEvening, rowStatus);
        hourlySlots.push({ start, end, status: rowStatus });
      }
    });

    const halves = [halfMorning, halfEvening];
    if (halves.includes("tentative")) fullDay = "tentative";
    else if (halves.includes("booked") || hourlySlots.length > 0) fullDay = "booked";
    else if (manualFullUnavailable) fullDay = "unavailable";
    else fullDay = "available";
  }

  const payload = {
    date,
    full_day: toStoredStatus(fullDay),
    half_morning: toStoredStatus(halfMorning),
    half_evening: toStoredStatus(halfEvening),
    hourly_slots: hourlySlots,
  };

  if (bookingReasonColumnsAvailable) {
    payload.full_day_reason = fullDay === "unavailable" ? normalizeReason(existing.full_day_reason) || null : null;
    payload.half_morning_reason = halfMorning === "unavailable" ? normalizeReason(existing.half_morning_reason) || null : null;
    payload.half_evening_reason = halfEvening === "unavailable" ? normalizeReason(existing.half_evening_reason) || null : null;
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

async function applyManualUnavailable(date, slot, reason) {
  if (!bookingReasonColumnsAvailable) {
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason")
    .eq("date", date)
    .maybeSingle();
  if (loadError && bookingReasonColumnsAvailable && isMissingColumnError(loadError)) {
    bookingReasonColumnsAvailable = false;
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  if (loadError) return { error: loadError.message };

  const payload = {
    date,
    full_day: normalizeStatus(existing?.full_day) || null,
    half_morning: normalizeStatus(existing?.half_morning) || null,
    half_evening: normalizeStatus(existing?.half_evening) || null,
    full_day_reason: normalizeReason(existing?.full_day_reason) || null,
    half_morning_reason: normalizeReason(existing?.half_morning_reason) || null,
    half_evening_reason: normalizeReason(existing?.half_evening_reason) || null,
    hourly_slots: Array.isArray(existing?.hourly_slots) ? existing.hourly_slots : [],
  };

  if (slot === "full_day") {
    payload.full_day = "unavailable";
    payload.full_day_reason = reason;
  } else if (slot === "half_morning") {
    payload.half_morning = "unavailable";
    payload.half_morning_reason = reason;
  } else if (slot === "half_evening") {
    payload.half_evening = "unavailable";
    payload.half_evening_reason = reason;
  } else {
    return { error: "Invalid slot for unavailable action." };
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

async function clearManualUnavailable(date, slot) {
  if (!bookingReasonColumnsAvailable) {
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason")
    .eq("date", date)
    .maybeSingle();
  if (loadError && bookingReasonColumnsAvailable && isMissingColumnError(loadError)) {
    bookingReasonColumnsAvailable = false;
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  if (loadError) return { error: loadError.message };

  const payload = {
    date,
    full_day: normalizeStatus(existing?.full_day) || null,
    half_morning: normalizeStatus(existing?.half_morning) || null,
    half_evening: normalizeStatus(existing?.half_evening) || null,
    full_day_reason: normalizeReason(existing?.full_day_reason) || null,
    half_morning_reason: normalizeReason(existing?.half_morning_reason) || null,
    half_evening_reason: normalizeReason(existing?.half_evening_reason) || null,
    hourly_slots: Array.isArray(existing?.hourly_slots) ? existing.hourly_slots : [],
  };

  if (slot === "full_day") {
    if (payload.full_day === "unavailable") {
      payload.full_day = null;
      payload.full_day_reason = null;
    }
  } else if (slot === "half_morning") {
    if (payload.half_morning === "unavailable") {
      payload.half_morning = null;
      payload.half_morning_reason = null;
    }
  } else if (slot === "half_evening") {
    if (payload.half_evening === "unavailable") {
      payload.half_evening = null;
      payload.half_evening_reason = null;
    }
  } else {
    return { error: "Invalid slot for available action." };
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

async function applyManualDateUnavailable(date, reason) {
  if (!bookingReasonColumnsAvailable) {
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason")
    .eq("date", date)
    .maybeSingle();
  if (loadError && bookingReasonColumnsAvailable && isMissingColumnError(loadError)) {
    bookingReasonColumnsAvailable = false;
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  if (loadError) return { error: loadError.message };

  const payload = {
    date,
    full_day: "unavailable",
    half_morning: "unavailable",
    half_evening: "unavailable",
    full_day_reason: reason,
    half_morning_reason: reason,
    half_evening_reason: reason,
    hourly_slots: [],
  };

  if (normalizeStatus(existing?.full_day) === "booked" || normalizeStatus(existing?.full_day) === "tentative") {
    return { error: "Date has booked/tentative records. Clear those first before marking date unavailable." };
  }

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

async function clearManualDateUnavailable(date) {
  if (!bookingReasonColumnsAvailable) {
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  const { data: existing, error: loadError } = await supabase
    .from("bookings")
    .select("date, full_day, half_morning, half_evening, hourly_slots, full_day_reason, half_morning_reason, half_evening_reason")
    .eq("date", date)
    .maybeSingle();
  if (loadError && bookingReasonColumnsAvailable && isMissingColumnError(loadError)) {
    bookingReasonColumnsAvailable = false;
    return { error: "Unavailable reasons require DB migration. Run Database-Migrations/2026-03-24-bookings-unavailable-reasons.sql first." };
  }
  if (loadError) return { error: loadError.message };

  const payload = {
    date,
    full_day: normalizeStatus(existing?.full_day) === "unavailable" ? null : normalizeStatus(existing?.full_day) || null,
    half_morning: normalizeStatus(existing?.half_morning) === "unavailable" ? null : normalizeStatus(existing?.half_morning) || null,
    half_evening: normalizeStatus(existing?.half_evening) === "unavailable" ? null : normalizeStatus(existing?.half_evening) || null,
    full_day_reason: null,
    half_morning_reason: null,
    half_evening_reason: null,
    hourly_slots: Array.isArray(existing?.hourly_slots) ? existing.hourly_slots : [],
  };

  const { error: upsertError } = await supabase.from("bookings").upsert(payload, { onConflict: "date" });
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

