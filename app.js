"use strict";

const STORAGE_KEY = "days-with-you:data:v1";
const SESSION_KEY = "days-with-you:unlocked";
const DEFAULT_AUTH = {
  salt: "33274a9f17d7779804e1a1ff6d698170",
  hash: "eb3c8c376fa2a9578bc13feb9256de5c11028f52d17cd4398668a3f7a900165e",
  iterations: 120000,
};

const DEFAULT_PROFILE = {
  siteName: "DAYS WITH YOU",
  displayName: "亲爱的你",
  kicker: "A LITTLE UNIVERSE FOR YOU",
  heroTitle: "把每一个普通日子，\n都过成纪念日。",
  heroDescription:
    "时间一直向前走，而我想把与你有关的日子，认真收藏在这里。",
  aboutTitle: "你是所有浪漫的\n标准答案。",
  aboutText:
    "这个网站没有宏大的故事，只有一些舍不得忘记的小事。\n想告诉你：无论日子过得快还是慢，我都会认真地站在你这一边。",
};

const DEFAULT_EVENTS = [
  {
    id: "together",
    title: "在一起",
    note: "从那一天开始，平凡的日子有了专属的意义。",
    target: "2025-05-20T20:00",
    mode: "elapsed",
    annual: false,
    featured: false,
    color: "rose",
  },
  {
    id: "next-meeting",
    title: "下一次见面",
    note: "提前开始期待，连等待也变成了甜甜的事。",
    target: "2026-11-15T18:30",
    mode: "countdown",
    annual: false,
    featured: true,
    color: "coral",
  },
  {
    id: "birthday",
    title: "你的生日",
    note: "希望每一年的这一天，都有新的快乐如约而至。",
    target: "2027-03-12T00:00",
    mode: "countdown",
    annual: true,
    featured: false,
    color: "lilac",
  },
  {
    id: "first-trip",
    title: "第一次一起出发",
    note: "去吹海风，看日落，把远方也写进我们的故事。",
    target: "2027-07-08T08:00",
    mode: "countdown",
    annual: false,
    featured: false,
    color: "sage",
  },
];

const COLOR_VALUES = {
  rose: "#d7a0a1",
  coral: "#df765e",
  sage: "#9ca98f",
  lilac: "#ab98b6",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  body: document.body,
  siteShell: $("#siteShell"),
  siteHeader: $("#siteHeader"),
  loginScreen: $("#loginScreen"),
  loginForm: $("#loginForm"),
  passwordInput: $("#passwordInput"),
  passwordToggle: $("#passwordToggle"),
  loginSubmit: $("#loginSubmit"),
  loginError: $("#loginError"),
  eventDialog: $("#eventDialog"),
  eventForm: $("#eventForm"),
  eventModalTitle: $("#eventModalTitle"),
  eventTitle: $("#eventTitle"),
  eventDate: $("#eventDate"),
  eventNote: $("#eventNote"),
  eventAnnual: $("#eventAnnual"),
  eventFeatured: $("#eventFeatured"),
  annualField: $("#annualField"),
  eventError: $("#eventError"),
  deleteEventButton: $("#deleteEventButton"),
  settingsDialog: $("#settingsDialog"),
  settingsForm: $("#settingsForm"),
  settingsError: $("#settingsError"),
  confirmDialog: $("#confirmDialog"),
  eventsGrid: $("#eventsGrid"),
  emptyState: $("#emptyState"),
  toast: $("#toast"),
};

let state = loadState();
let activeFilter = "all";
let toastTimer = null;
let confirmResolver = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        version: 1,
        profile: clone(DEFAULT_PROFILE),
        auth: clone(DEFAULT_AUTH),
        events: clone(DEFAULT_EVENTS),
      };
    }

    const stored = JSON.parse(raw);
    return {
      version: 1,
      profile: { ...DEFAULT_PROFILE, ...(stored.profile || {}) },
      auth:
        stored.auth && stored.auth.hash && stored.auth.salt
          ? { ...DEFAULT_AUTH, ...stored.auth }
          : clone(DEFAULT_AUTH),
      events: Array.isArray(stored.events)
        ? stored.events.map(normalizeEvent).filter(Boolean)
        : clone(DEFAULT_EVENTS),
    };
  } catch (error) {
    console.warn("无法读取本地纪念日数据，将使用初始内容。", error);
    return {
      version: 1,
      profile: clone(DEFAULT_PROFILE),
      auth: clone(DEFAULT_AUTH),
      events: clone(DEFAULT_EVENTS),
    };
  }
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object" || !event.title || !event.target) {
    return null;
  }

  return {
    id: String(event.id || createId()),
    title: String(event.title).slice(0, 30),
    note: String(event.note || "").slice(0, 120),
    target: String(event.target),
    mode: event.mode === "elapsed" ? "elapsed" : "countdown",
    annual: Boolean(event.annual),
    featured: Boolean(event.featured),
    color: COLOR_VALUES[event.color] ? event.color : "rose",
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("保存本地数据失败。", error);
    showToast("浏览器没有保存权限，修改只在本次打开时有效");
    return false;
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `day-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "日期未设置";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} · ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return "日期未设置";
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} · ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function toDateTimeInput(value) {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function getAnnualOccurrence(value, now = new Date()) {
  const original = parseDate(value);
  if (!original) return null;

  let candidate = new Date(
    now.getFullYear(),
    original.getMonth(),
    original.getDate(),
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    0,
  );

  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(
      now.getFullYear() + 1,
      original.getMonth(),
      original.getDate(),
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      0,
    );
  }

  return candidate;
}

function splitDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  return {
    days: Math.floor(safeSeconds / 86400),
    hours: Math.floor((safeSeconds % 86400) / 3600),
    minutes: Math.floor((safeSeconds % 3600) / 60),
    seconds: safeSeconds % 60,
    totalSeconds: safeSeconds,
  };
}

function getEventTiming(event, now = new Date()) {
  const original = parseDate(event.target);
  if (!original) {
    return {
      ...splitDuration(0),
      targetDate: null,
      isArrived: false,
      isAnnual: false,
    };
  }

  if (event.mode === "countdown") {
    const targetDate = event.annual ? getAnnualOccurrence(event.target, now) : original;
    const diffSeconds = (targetDate.getTime() - now.getTime()) / 1000;
    return {
      ...splitDuration(diffSeconds),
      targetDate,
      isArrived: diffSeconds <= 0,
      isAnnual: event.annual,
    };
  }

  const diffSeconds = (now.getTime() - original.getTime()) / 1000;
  return {
    ...splitDuration(diffSeconds),
    targetDate: original,
    isArrived: diffSeconds >= 0,
    isAnnual: false,
  };
}

function renderAll() {
  renderProfile();
  renderEvents();
  updateTimers();
}

function renderProfile() {
  const profile = state.profile;
  $("#headerBrand").textContent = profile.siteName || DEFAULT_PROFILE.siteName;
  $("#heroKicker").textContent = profile.kicker || DEFAULT_PROFILE.kicker;
  $("#heroDisplayName").textContent = profile.displayName || DEFAULT_PROFILE.displayName;
  $("#heroTitle").textContent = profile.heroTitle || DEFAULT_PROFILE.heroTitle;
  $("#heroDescription").textContent =
    profile.heroDescription || DEFAULT_PROFILE.heroDescription;
  $("#aboutTitle").textContent = profile.aboutTitle || DEFAULT_PROFILE.aboutTitle;
  $("#aboutText").textContent = profile.aboutText || DEFAULT_PROFILE.aboutText;
  $("#headerAvatar").textContent = (profile.displayName || "你").trim().slice(0, 1);
  document.title = `${profile.siteName || "Days With You"} · 我们的小宇宙`;
}

function getFeaturedEvent() {
  const featured = state.events.find(
    (event) => event.featured && event.mode === "countdown" && parseDate(event.target),
  );
  if (featured) return featured;

  const now = new Date();
  const upcoming = state.events
    .filter((event) => event.mode === "countdown" && !event.annual)
    .map((event) => ({ event, timing: getEventTiming(event, now) }))
    .filter(({ timing }) => timing.targetDate && timing.targetDate.getTime() > now.getTime())
    .sort((a, b) => a.timing.targetDate - b.timing.targetDate);

  return upcoming[0]?.event || state.events[0] || null;
}

function renderEvents() {
  const filteredEvents =
    activeFilter === "all"
      ? state.events
      : state.events.filter((event) => event.mode === activeFilter);

  elements.emptyState.hidden = filteredEvents.length > 0;
  elements.eventsGrid.hidden = filteredEvents.length === 0;

  elements.eventsGrid.innerHTML = filteredEvents
    .map((event, index) => {
      const timing = getEventTiming(event);
      const typeLabel =
        event.mode === "countdown"
          ? event.annual
            ? "COUNTDOWN · 每年"
            : "COUNTDOWN · 倒计时"
          : "ELAPSED · 正计时";
      const displayDate =
        event.annual && timing.targetDate
          ? `每年 ${formatShortDate(timing.targetDate)}`
          : formatDate(event.target);
      const accent = COLOR_VALUES[event.color] || COLOR_VALUES.rose;

      return `
        <article
          class="event-card${event.featured ? " is-featured" : ""}"
          data-event-id="${escapeHTML(event.id)}"
          data-color="${escapeHTML(event.color)}"
          style="--card-accent: ${accent}"
        >
          <div class="event-card-top">
            <span class="event-type"><i></i>${typeLabel}</span>
            <span class="event-index">${pad(index + 1)}</span>
          </div>
          <h3 title="${escapeHTML(event.title)}">${escapeHTML(event.title)}</h3>
          <span class="event-date">${escapeHTML(displayDate)}</span>
          <div class="event-timer" data-card-timer>
            <div class="event-time-main">
              <strong data-card-unit="days">${pad(timing.days, 2)}</strong>
              <span>天</span>
            </div>
            <div class="event-time-sub">
              <b data-card-unit="hours">${pad(timing.hours)}</b><span>时</span>
              <b data-card-unit="minutes">${pad(timing.minutes)}</b><span>分</span>
              <b data-card-unit="seconds">${pad(timing.seconds)}</b><span>秒</span>
            </div>
          </div>
          <p class="event-note">${escapeHTML(event.note || "把这一刻悄悄收好，以后再慢慢翻看。")}</p>
          <button
            class="card-edit"
            type="button"
            data-edit-event="${escapeHTML(event.id)}"
            aria-label="编辑${escapeHTML(event.title)}"
            title="编辑纪念日"
          >↗</button>
        </article>
      `;
    })
    .join("");

  updateTimers();
}

function setUnit(root, unit, value) {
  const element = $(`[data-${root}-unit="${unit}"]`);
  if (element) element.textContent = value;
}

function updateTimers() {
  const now = new Date();
  updateHero(now);
  updateCards(now);
  updateSummary(now);
}

function updateHero(now) {
  const event = getFeaturedEvent();
  const heroCard = $("#featuredCard");
  const editButton = $("#editFeaturedButton");
  const featuredPrefix = $("#featuredPrefix");
  const featuredMode = $("#featuredMode");

  if (!event) {
    heroCard.dataset.color = "coral";
    $("#featuredTitle").textContent = "等待一个特别的日子";
    $("#featuredDate").textContent = "点击下方按钮，写下第一份纪念";
    $("#featuredNote").textContent = "所有值得纪念的时刻，都从这里开始。";
    $("#featuredNumber").textContent = "00";
    featuredMode.textContent = "YOUR STORY STARTS HERE";
    featuredPrefix.textContent = "想记录";
    editButton.hidden = true;
    ["days", "hours", "minutes", "seconds"].forEach((unit) => setUnit("hero", unit, "00"));
    return;
  }

  const timing = getEventTiming(event, now);
  heroCard.dataset.color = event.color;
  editButton.hidden = false;
  editButton.dataset.editEvent = event.id;
  $("#featuredTitle").textContent = event.title;
  $("#featuredDate").textContent =
    event.mode === "countdown" && timing.targetDate
      ? formatDate(timing.targetDate)
      : formatDate(event.target);
  $("#featuredNote").textContent =
    event.note || "把这一刻悄悄收好，以后再慢慢翻看。";
  $("#featuredNumber").textContent = pad(
    Math.max(1, state.events.findIndex((item) => item.id === event.id) + 1),
  );

  if (event.mode === "countdown") {
    featuredMode.textContent = event.annual ? "ANNIVERSARY · 每年" : "NEXT MOMENT · 倒计时";
    featuredPrefix.textContent = timing.isArrived ? "终于等到" : "距离";
  } else {
    featuredMode.textContent = "TOGETHER · 正计时";
    featuredPrefix.textContent = "我们已经走过";
  }

  setUnit("hero", "days", pad(timing.days, 2));
  setUnit("hero", "hours", pad(timing.hours));
  setUnit("hero", "minutes", pad(timing.minutes));
  setUnit("hero", "seconds", pad(timing.seconds));
}

function updateCards(now) {
  $$(".event-card").forEach((card) => {
    const event = state.events.find((item) => item.id === card.dataset.eventId);
    if (!event) return;
    const timing = getEventTiming(event, now);
    const daysElement = $('[data-card-unit="days"]', card);
    const hoursElement = $('[data-card-unit="hours"]', card);
    const minutesElement = $('[data-card-unit="minutes"]', card);
    const secondsElement = $('[data-card-unit="seconds"]', card);

    if (daysElement) daysElement.textContent = pad(timing.days, 2);
    if (hoursElement) hoursElement.textContent = pad(timing.hours);
    if (minutesElement) minutesElement.textContent = pad(timing.minutes);
    if (secondsElement) secondsElement.textContent = pad(timing.seconds);
  });
}

function updateSummary(now) {
  const elapsedEvents = state.events
    .filter((event) => event.mode === "elapsed")
    .map((event) => ({ event, timing: getEventTiming(event, now) }))
    .filter(({ timing }) => timing.isArrived)
    .sort((a, b) => b.timing.totalSeconds - a.timing.totalSeconds);

  const togetherDays = elapsedEvents[0]
    ? Math.floor(elapsedEvents[0].timing.totalSeconds / 86400) + 1
    : 0;

  $("#totalDaysCount").textContent = pad(togetherDays, 3);
  $("#memoryCount").textContent = pad(state.events.length);

  const upcoming = state.events
    .filter((event) => event.mode === "countdown")
    .map((event) => ({ event, timing: getEventTiming(event, now) }))
    .filter(({ timing }) => timing.totalSeconds > 0)
    .sort((a, b) => a.timing.totalSeconds - b.timing.totalSeconds);

  const next = upcoming[0]?.timing;
  if (!next) {
    $("#nextEventDays").textContent = "--";
  } else if (next.days === 0) {
    $("#nextEventDays").textContent = "今天";
  } else {
    $("#nextEventDays").textContent = pad(next.days);
  }
}

function setTodayLabel() {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  $("#todayLabel").textContent = `今天 · ${formatted}`;
  $("#footerYear").textContent = now.getFullYear();
}

function setFilter(filter) {
  activeFilter = ["all", "elapsed", "countdown"].includes(filter) ? filter : "all";
  $$(".filter-pill").forEach((button) => {
    const isActive = button.dataset.filter === activeFilter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderEvents();
}

function openEventDialog(eventId = null) {
  elements.eventForm.reset();
  elements.eventError.textContent = "";
  elements.eventTitle.classList.remove("invalid");
  elements.eventDate.classList.remove("invalid");
  elements.deleteEventButton.hidden = !eventId;

  if (eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;

    elements.eventModalTitle.textContent = "编辑这个日子";
    elements.eventForm.dataset.editingId = event.id;
    elements.eventTitle.value = event.title;
    elements.eventDate.value = toDateTimeInput(event.target);
    elements.eventNote.value = event.note;
    elements.eventAnnual.checked = event.annual;
    elements.eventFeatured.checked = event.featured;

    const modeInput = $(`input[name="mode"][value="${event.mode}"]`, elements.eventForm);
    const colorInput = $(`input[name="color"][value="${event.color}"]`, elements.eventForm);
    if (modeInput) modeInput.checked = true;
    if (colorInput) colorInput.checked = true;
  } else {
    const defaultTarget = new Date();
    defaultTarget.setDate(defaultTarget.getDate() + 7);
    defaultTarget.setHours(18, 0, 0, 0);
    elements.eventModalTitle.textContent = "写下新的日子";
    delete elements.eventForm.dataset.editingId;
    elements.eventDate.value = toDateTimeInput(defaultTarget.toISOString());
    $('input[name="mode"][value="countdown"]', elements.eventForm).checked = true;
    $('input[name="color"][value="rose"]', elements.eventForm).checked = true;
    elements.eventAnnual.checked = false;
    elements.eventFeatured.checked = false;
  }

  updateAnnualField();
  elements.eventDialog.showModal();
  window.setTimeout(() => elements.eventTitle.focus(), 50);
}

function updateAnnualField() {
  const mode = $('input[name="mode"]:checked', elements.eventForm)?.value;
  elements.annualField.hidden = mode !== "countdown";
  if (mode !== "countdown") elements.eventAnnual.checked = false;
}

function handleEventSubmit(event) {
  event.preventDefault();
  elements.eventError.textContent = "";
  elements.eventTitle.classList.remove("invalid");
  elements.eventDate.classList.remove("invalid");

  const title = elements.eventTitle.value.trim();
  const targetValue = elements.eventDate.value;
  const targetDate = parseDate(targetValue);
  const mode = $('input[name="mode"]:checked', elements.eventForm)?.value || "countdown";
  const annual = mode === "countdown" && elements.eventAnnual.checked;

  if (!title) {
    elements.eventError.textContent = "先给这一天起一个名字吧。";
    elements.eventTitle.classList.add("invalid");
    elements.eventTitle.focus();
    return;
  }

  if (!targetDate) {
    elements.eventError.textContent = "请选择一个有效的日期和时间。";
    elements.eventDate.classList.add("invalid");
    elements.eventDate.focus();
    return;
  }

  const now = new Date();
  if (mode === "countdown" && !annual && targetDate.getTime() <= now.getTime()) {
    elements.eventError.textContent = "倒计时的日期需要晚于现在；若是每年纪念日，请勾选“每年重复”。";
    elements.eventDate.classList.add("invalid");
    elements.eventDate.focus();
    return;
  }

  if (mode === "elapsed" && targetDate.getTime() > now.getTime()) {
    elements.eventError.textContent = "正计时的起始日期需要早于现在。";
    elements.eventDate.classList.add("invalid");
    elements.eventDate.focus();
    return;
  }

  const editingId = elements.eventForm.dataset.editingId;
  const featured = elements.eventFeatured.checked;
  const eventData = {
    id: editingId || createId(),
    title: title.slice(0, 30),
    note: elements.eventNote.value.trim().slice(0, 120),
    target: targetValue,
    mode,
    annual,
    featured,
    color: $('input[name="color"]:checked', elements.eventForm)?.value || "rose",
  };

  if (featured) {
    state.events.forEach((item) => {
      item.featured = false;
    });
  }

  if (editingId) {
    const index = state.events.findIndex((item) => item.id === editingId);
    if (index >= 0) state.events[index] = eventData;
    showToast("这个日子已经更新");
  } else {
    state.events.unshift(eventData);
    showToast("新的纪念日已经收好");
  }

  saveState();
  renderAll();
  elements.eventDialog.close();
}

async function deleteEditingEvent() {
  const editingId = elements.eventForm.dataset.editingId;
  const event = state.events.find((item) => item.id === editingId);
  if (!event) return;

  const accepted = await askConfirm(`“${event.title}”将从时间轴中移除，这个操作无法撤销。`);
  if (!accepted) return;

  state.events = state.events.filter((item) => item.id !== editingId);
  if (event.featured && state.events.length) {
    state.events[0].featured = true;
  }
  saveState();
  renderAll();
  elements.eventDialog.close();
  showToast("这个日子已经删除");
}

function askConfirm(message) {
  if (confirmResolver) {
    confirmResolver(false);
    confirmResolver = null;
  }
  $("#confirmMessage").textContent = message;
  elements.confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  if (!confirmResolver) return;
  const resolve = confirmResolver;
  confirmResolver = null;
  if (elements.confirmDialog.open) elements.confirmDialog.close();
  resolve(value);
}

function openSettings(tab = "profile") {
  const profile = state.profile;
  $("#settingSiteName").value = profile.siteName;
  $("#settingDisplayName").value = profile.displayName;
  $("#settingHeroTitle").value = profile.heroTitle;
  $("#settingHeroDescription").value = profile.heroDescription;
  $("#settingAboutTitle").value = profile.aboutTitle;
  $("#settingAboutText").value = profile.aboutText;
  $("#settingNewPassword").value = "";
  $("#settingConfirmPassword").value = "";
  elements.settingsError.textContent = "";
  switchSettingsTab(tab);
  elements.settingsDialog.showModal();
}

function switchSettingsTab(tab) {
  const safeTab = tab === "security" ? "security" : "profile";
  $$('[data-settings-tab]').forEach((button) => {
    const isActive = button.dataset.settingsTab === safeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  $$("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== safeTab;
  });
}

function lockSite() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn("无法清除本次登录状态。", error);
  }
  window.location.reload();
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createSalt() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

async function derivePasswordHash(password, salt, iterations = 120000) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前浏览器不支持安全密码校验，请通过 localhost 或 HTTPS 打开。");
  }

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(password) {
  const auth = state.auth || DEFAULT_AUTH;
  const candidate = await derivePasswordHash(
    password,
    auth.salt,
    auth.iterations || 120000,
  );
  return candidate === auth.hash;
}

async function handleLogin(event) {
  event.preventDefault();
  const password = elements.passwordInput.value;
  elements.loginError.textContent = "";
  elements.passwordInput.closest(".password-field").classList.remove("has-error");

  if (!password) {
    elements.loginError.textContent = "先输入我们的暗号吧。";
    shakePasswordField();
    return;
  }

  elements.loginSubmit.disabled = true;
  elements.loginSubmit.querySelector("span").textContent = "正在打开...";

  try {
    const valid = await verifyPassword(password);
    if (!valid) {
      elements.loginError.textContent = "暗号好像不对，再想一想？";
      shakePasswordField();
      elements.passwordInput.select();
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch (error) {
      console.warn("无法保存本次登录状态。", error);
    }
    unlockSite();
  } catch (error) {
    console.error(error);
    elements.loginError.textContent = error.message || "暂时无法校验密码，请稍后再试。";
  } finally {
    elements.loginSubmit.disabled = false;
    elements.loginSubmit.querySelector("span").textContent = "进入小宇宙";
  }
}

function shakePasswordField() {
  const field = elements.passwordInput.closest(".password-field");
  field.classList.remove("has-error");
  void field.offsetWidth;
  field.classList.add("has-error");
}

function unlockSite(isInitial = true) {
  elements.body.classList.remove("is-locked");
  elements.siteShell.inert = false;
  elements.siteShell.setAttribute("aria-hidden", "false");
  elements.passwordInput.value = "";
  elements.loginError.textContent = "";
  renderAll();

  if (isInitial) {
    elements.loginScreen.classList.add("is-leaving");
    window.setTimeout(() => {
      elements.loginScreen.hidden = true;
    }, 620);
  } else {
    elements.loginScreen.hidden = true;
  }

  window.setTimeout(() => {
    initializeReveals();
    updateActiveNavigation();
  }, 50);
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  elements.settingsError.textContent = "";

  const newPassword = $("#settingNewPassword").value;
  const confirmPassword = $("#settingConfirmPassword").value;

  if (newPassword || confirmPassword) {
    if (newPassword.length < 4) {
      elements.settingsError.textContent = "新密码至少需要 4 个字符。";
      $("#settingNewPassword").focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      elements.settingsError.textContent = "两次输入的密码不一致。";
      $("#settingConfirmPassword").focus();
      return;
    }
  }

  const profile = {
    siteName: $("#settingSiteName").value.trim() || DEFAULT_PROFILE.siteName,
    displayName: $("#settingDisplayName").value.trim() || DEFAULT_PROFILE.displayName,
    kicker: state.profile.kicker || DEFAULT_PROFILE.kicker,
    heroTitle: $("#settingHeroTitle").value.trim() || DEFAULT_PROFILE.heroTitle,
    heroDescription:
      $("#settingHeroDescription").value.trim() || DEFAULT_PROFILE.heroDescription,
    aboutTitle: $("#settingAboutTitle").value.trim() || DEFAULT_PROFILE.aboutTitle,
    aboutText: $("#settingAboutText").value.trim() || DEFAULT_PROFILE.aboutText,
  };

  try {
    if (newPassword) {
      const salt = createSalt();
      const hash = await derivePasswordHash(newPassword, salt, 120000);
      state.auth = { salt, hash, iterations: 120000 };
    }

    state.profile = profile;
    saveState();
    renderAll();
    elements.settingsDialog.close();
    showToast(newPassword ? "主页文字和访问密码已更新" : "主页文字已更新");
  } catch (error) {
    console.error(error);
    elements.settingsError.textContent =
      error.message || "保存设置失败，请稍后再试。";
  }
}

function showToast(message) {
  const messageElement = $("p", elements.toast);
  messageElement.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function closeDialog(button) {
  const dialog = button.closest("dialog");
  if (dialog?.open) dialog.close();
}

function initializeReveals() {
  const revealElements = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  revealElements.forEach((element) => element.classList.add("is-visible"));
}

function updateActiveNavigation() {
  const sections = ["home", "timeline", "about"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      $$(".main-nav a").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    },
    { rootMargin: "-25% 0px -62% 0px", threshold: [0, 0.15, 0.4] },
  );

  sections.forEach((section) => observer.observe(section));
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.passwordInput.addEventListener("input", () => {
    elements.loginError.textContent = "";
    elements.passwordInput.closest(".password-field").classList.remove("has-error");
  });

  elements.passwordToggle.addEventListener("click", () => {
    const show = elements.passwordInput.type === "password";
    elements.passwordInput.type = show ? "text" : "password";
    elements.passwordToggle.setAttribute("aria-pressed", String(show));
    elements.passwordToggle.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
    elements.passwordInput.focus();
  });

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-event]");
    if (openButton) {
      openEventDialog();
      return;
    }

    const editButton = event.target.closest("[data-edit-event]");
    if (editButton) {
      openEventDialog(editButton.dataset.editEvent);
      return;
    }

    const eventCard = event.target.closest(".event-card");
    if (eventCard) {
      openEventDialog(eventCard.dataset.eventId);
      return;
    }

    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      closeDialog(closeButton);
      return;
    }

    const settingsButton = event.target.closest(
      "#openSettingsButton, #editProfileButton, #footerSettingsButton",
    );
    if (settingsButton) {
      openSettings("profile");
      return;
    }

    if (event.target.closest("#lockSiteButton")) {
      lockSite();
      return;
    }

    const filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      setFilter(filterButton.dataset.filter);
      return;
    }

    const settingsTab = event.target.closest("[data-settings-tab]");
    if (settingsTab) {
      switchSettingsTab(settingsTab.dataset.settingsTab);
    }
  });

  elements.eventForm.addEventListener("submit", handleEventSubmit);
  elements.eventForm.addEventListener("change", (event) => {
    if (event.target.name === "mode") updateAnnualField();
  });
  elements.deleteEventButton.addEventListener("click", deleteEditingEvent);
  elements.settingsForm.addEventListener("submit", handleSettingsSubmit);

  $("#confirmAccept").addEventListener("click", () => resolveConfirm(true));
  $("#confirmCancel").addEventListener("click", () => resolveConfirm(false));
  elements.confirmDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    resolveConfirm(false);
  });

  [elements.eventDialog, elements.settingsDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  elements.confirmDialog.addEventListener("click", (event) => {
    if (event.target === elements.confirmDialog) resolveConfirm(false);
  });

  elements.settingsDialog.addEventListener("close", () => {
    elements.settingsError.textContent = "";
  });

  window.addEventListener(
    "scroll",
    () => {
      elements.siteHeader.classList.toggle("scrolled", window.scrollY > 18);
    },
    { passive: true },
  );
}

function initializeTimerLoop() {
  updateTimers();
  window.setInterval(updateTimers, 1000);
}

function initialize() {
  setTodayLabel();
  bindEvents();
  renderAll();
  initializeTimerLoop();

  let unlocked = false;
  try {
    unlocked = sessionStorage.getItem(SESSION_KEY) === "true";
  } catch (error) {
    console.warn("无法读取本次登录状态。", error);
  }

  if (unlocked) {
    unlockSite(false);
  } else {
    elements.loginScreen.hidden = false;
    window.setTimeout(() => elements.passwordInput.focus(), 180);
  }
}

initialize();
