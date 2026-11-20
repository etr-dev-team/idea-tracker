const STORAGE_KEY = "idea-tracker:v1";
const THEME_KEY = "idea-tracker:theme";

const ICONS = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 3h9A1.5 1.5 0 0 1 14.5 4.5V5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.6 3.6a2.1 2.1 0 0 1 3 3L7.2 19 3 20l1-4.2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z"/></svg>',
};

const els = {
  form: document.querySelector("#composer-form"),
  composer: document.querySelector("#composer"),
  hint: document.querySelector("#composer-hint"),
  search: document.querySelector("#search"),
  list: document.querySelector("#list"),
  empty: document.querySelector("#empty"),
  emptyTitle: document.querySelector(".empty-title"),
  emptyText: document.querySelector(".empty-text"),
  count: document.querySelector("#count"),
  theme: document.querySelector("#theme"),
  install: document.querySelector("#install"),
  exportBtn: document.querySelector("#export"),
  importBtn: document.querySelector("#importBtn"),
  importFile: document.querySelector("#importFile"),
  toast: document.querySelector("#toast"),
};

let ideas = loadIdeas();
let query = "";
let editingId = null;
let lastDeleted = null;
let toastTimer = null;
let deferredInstall = null;

const coarsePointer = window.matchMedia("(pointer: coarse)");

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `idea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeIdea(raw) {
  if (!raw || typeof raw.text !== "string") return null;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
    text: raw.text,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    pinned: Boolean(raw.pinned),
  };
}

function loadIdeas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeIdea).filter(Boolean);
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
  } catch {
    showToast("Couldn't save — device storage is full or blocked");
  }
}

function sortedIdeas(list) {
  return list.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function formatWhen(timestamp) {
  const diff = Date.now() - timestamp;
  const minute = 60000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

function iconButton(name, label, pressed) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-icon";
  if (name === "trash" || name === "delete") button.classList.add("danger");
  button.setAttribute("aria-label", label);
  button.title = label;
  if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = ICONS[name];
  button.append(span);
  return button;
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function createIdeaNode(idea) {
  const item = document.createElement("li");
  item.className = "idea";
  item.dataset.id = idea.id;
  if (idea.pinned) item.classList.add("is-pinned");

  const text = document.createElement("p");
  text.className = "idea-text";
  text.textContent = idea.text;
  item.append(text);

  const meta = document.createElement("div");
  meta.className = "idea-meta";
  const when = document.createElement("span");
  when.textContent = formatWhen(idea.updatedAt);
  when.title = new Date(idea.updatedAt).toLocaleString();
  if (idea.updatedAt - idea.createdAt > 60000) when.textContent += " · edited";
  meta.append(when);
  if (idea.pinned) {
    const pinned = document.createElement("span");
    pinned.className = "dot";
    pinned.textContent = "pinned";
    meta.append(pinned);
  }
  item.append(meta);

  const actions = document.createElement("div");
  actions.className = "idea-actions";

  const pin = iconButton(
    "pin",
    idea.pinned ? "Unpin idea" : "Pin idea",
    idea.pinned,
  );
  pin.addEventListener("click", () => togglePin(idea.id));

  const copy = iconButton("copy", "Copy idea");
  copy.addEventListener("click", () => copyIdea(idea));

  const edit = iconButton("edit", "Edit idea");
  edit.addEventListener("click", () => startEditing(idea.id));

  const remove = iconButton("trash", "Delete idea");
  remove.addEventListener("click", () => deleteIdea(idea.id));

  actions.append(pin, copy, edit, remove);
  item.append(actions);
  return item;
}

function createEditNode(idea) {
  const item = document.createElement("li");
  item.className = "idea is-editing";
  item.dataset.id = idea.id;

  const form = document.createElement("form");
  form.className = "idea-edit";

  const textarea = document.createElement("textarea");
  textarea.value = idea.text;
  textarea.rows = 3;
  textarea.setAttribute("aria-label", "Edit idea");
  textarea.enterKeyHint = "enter";

  const row = document.createElement("div");
  row.className = "edit-actions";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", stopEditing);

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn btn-primary";
  save.textContent = "Save";

  row.append(cancel, save);
  form.append(textarea, row);
  item.append(form);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    commitEdit(idea.id, textarea.value);
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commitEdit(idea.id, textarea.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  });

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autoGrow(textarea);
  });

  return item;
}

function render() {
  const trimmed = query.trim().toLowerCase();
  const matching = trimmed
    ? ideas.filter((idea) => idea.text.toLowerCase().includes(trimmed))
    : ideas;
  const visible = sortedIdeas(matching);

  els.list.replaceChildren();
  for (const idea of visible) {
    els.list.append(
      editingId === idea.id ? createEditNode(idea) : createIdeaNode(idea),
    );
  }

  els.count.textContent = visible.length
    ? `${visible.length} idea${visible.length === 1 ? "" : "s"}`
    : "";

  els.empty.hidden = visible.length > 0;
  if (visible.length === 0) {
    if (ideas.length === 0) {
      els.emptyTitle.textContent = "No ideas yet";
      els.emptyText.textContent =
        "Type above and press Enter. Everything stays on this device.";
    } else {
      els.emptyTitle.textContent = "No matches";
      els.emptyText.textContent = `Nothing found for “${query.trim()}”.`;
    }
  }
}

function addIdea() {
  const text = els.composer.value.trim();
  if (!text) {
    els.composer.focus();
    return;
  }
  const now = Date.now();
  ideas.push({ id: uid(), text, createdAt: now, updatedAt: now, pinned: false });
  els.composer.value = "";
  autoGrow(els.composer);
  persist();
  render();
  els.composer.focus();
}

function togglePin(id) {
  const idea = ideas.find((entry) => entry.id === id);
  if (!idea) return;
  idea.pinned = !idea.pinned;
  persist();
  render();
}

async function copyIdea(idea) {
  try {
    await navigator.clipboard.writeText(idea.text);
    showToast("Copied");
  } catch {
    const helper = document.createElement("textarea");
    helper.value = idea.text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    try {
      document.execCommand("copy");
      showToast("Copied");
    } catch {
      showToast("Copy isn't available here");
    }
    helper.remove();
  }
}

function startEditing(id) {
  editingId = id;
  render();
}

function stopEditing() {
  editingId = null;
  render();
}

function commitEdit(id, value) {
  const idea = ideas.find((entry) => entry.id === id);
  const text = value.trim();
  if (!idea) {
    stopEditing();
    return;
  }
  if (!text) {
    stopEditing();
    return;
  }
  if (text !== idea.text) {
    idea.text = text;
    idea.updatedAt = Date.now();
    persist();
  }
  editingId = null;
  render();
}

function deleteIdea(id) {
  const index = ideas.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const [removed] = ideas.splice(index, 1);
  lastDeleted = { idea: removed, index };
  if (editingId === id) editingId = null;
  persist();
  render();
  showToast("Idea deleted", "Undo", () => {
    if (!lastDeleted) return;
    const { idea, index: at } = lastDeleted;
    if (!ideas.some((entry) => entry.id === idea.id)) {
      ideas.splice(Math.min(at, ideas.length), 0, idea);
      persist();
      render();
    }
    lastDeleted = null;
  }, 6000);
}

function showToast(message, actionLabel, action, duration = 2600) {
  if (toastTimer) clearTimeout(toastTimer);
  els.toast.replaceChildren();

  const text = document.createElement("span");
  text.textContent = message;
  els.toast.append(text);

  if (actionLabel && action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      hideToast();
      action();
    });
    els.toast.append(button);
  }

  els.toast.hidden = false;
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  els.toast.hidden = true;
  els.toast.replaceChildren();
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function exportIdeas() {
  const payload = {
    app: "idea-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    ideas,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ideas-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Exported");
}

async function importIdeas(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : parsed?.ideas;
    if (!Array.isArray(incoming)) throw new Error("bad file");

    const byId = new Map(ideas.map((idea) => [idea.id, idea]));
    let added = 0;
    let updated = 0;

    for (const raw of incoming) {
      const idea = normalizeIdea(raw);
      if (!idea || !idea.text.trim()) continue;
      const existing = byId.get(idea.id);
      if (!existing) {
        ideas.push(idea);
        byId.set(idea.id, idea);
        added += 1;
      } else if (idea.updatedAt > existing.updatedAt && idea.text !== existing.text) {
        existing.text = idea.text;
        existing.updatedAt = idea.updatedAt;
        existing.pinned = existing.pinned || idea.pinned;
        updated += 1;
      }
    }

    persist();
    render();
    showToast(
      added || updated
        ? `Imported ${added} new, updated ${updated}`
        : "Nothing new to import",
    );
  } catch {
    showToast("That file isn't a valid ideas export");
  }
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  const dark =
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const span = els.theme.querySelector(".icon");
  span.innerHTML = dark ? ICONS.sun : ICONS.moon;
  els.theme.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }
  applyTheme(stored);

  els.theme.addEventListener("click", () => {
    const dark =
      document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (!document.documentElement.dataset.theme) applyTheme(null);
    });
}

function initEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addIdea();
  });

  els.composer.addEventListener("keydown", (event) => {
    const saveShortcut =
      event.key === "Enter" && (event.metaKey || event.ctrlKey);
    const plainEnter = event.key === "Enter" && !event.shiftKey;
    if (saveShortcut || (plainEnter && !coarsePointer.matches)) {
      event.preventDefault();
      addIdea();
    }
  });

  els.composer.addEventListener("input", () => autoGrow(els.composer));

  els.search.addEventListener("input", () => {
    query = els.search.value;
    render();
  });

  els.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.search.value = "";
      query = "";
      render();
      els.search.blur();
    }
  });

  els.exportBtn.addEventListener("click", exportIdeas);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files?.[0];
    if (file) importIdeas(file);
    els.importFile.value = "";
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    els.install.hidden = false;
  });

  els.install.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    els.install.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    els.install.hidden = true;
  });
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline features unavailable; app still works */
    });
  });
}

initTheme();
initEvents();
render();
autoGrow(els.composer);
if (!coarsePointer.matches) els.composer.focus();
initServiceWorker();

if (els.hint && coarsePointer.matches) {
  els.hint.textContent = "Tap Save to keep it";
}
