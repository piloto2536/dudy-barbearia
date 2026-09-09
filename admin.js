import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, getFirestore, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPqaUuNePl5FUW2vQWOMO1K5VmMmFGvOY",
  authDomain: "dudy-barbearia-online.firebaseapp.com",
  projectId: "dudy-barbearia-online",
  storageBucket: "dudy-barbearia-online.firebasestorage.app",
  messagingSenderId: "289030728896",
  appId: "1:289030728896:web:78a0bc5b9e580bfd139125"
};

const $ = (selector) => document.querySelector(selector);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const today = new Date();
today.setHours(0, 0, 0, 0);
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = dateValue(today);
let monthlyAppointments = [];
let unsubscribeAppointments = null;

function dateValue(date) { return date.toISOString().slice(0, 10); }
function formatDate(date) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${date}T12:00:00`)); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function showStatus(message, type = "") { const status = $("#login-status"); status.textContent = message; status.className = `form-status ${type}`; }

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  $("#calendar-month").textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthDays = new Date(year, month + 1, 0).getDate();
  const counts = monthlyAppointments.reduce((total, item) => ({ ...total, [item.date]: (total[item.date] || 0) + 1 }), {});
  const cells = [];
  for (let blank = 0; blank < firstWeekday; blank += 1) cells.push('<span class="calendar-day empty" aria-hidden="true"></span>');
  for (let day = 1; day <= monthDays; day += 1) {
    const value = dateValue(new Date(year, month, day));
    const count = counts[value] || 0;
    const classes = ["calendar-day", value === selectedDate ? "selected" : "", value === dateValue(today) ? "today" : "", count ? "has-appointments" : ""].filter(Boolean).join(" ");
    cells.push(`<button class="${classes}" type="button" data-date="${value}" aria-label="${day} de ${month + 1}, ${count} agendamento${count === 1 ? "" : "s"}"><span>${day}</span>${count ? `<b>${count}</b>` : ""}</button>`);
  }
  $("#calendar-days").innerHTML = cells.join("");
}

function renderAppointments() {
  const appointments = monthlyAppointments.filter((item) => item.date === selectedDate).sort((first, second) => first.time.localeCompare(second.time));
  $("#agenda-title").textContent = formatDate(selectedDate);
  $("#agenda-summary").textContent = appointments.length ? `${appointments.length} atendimento${appointments.length === 1 ? "" : "s"} confirmado${appointments.length === 1 ? "" : "s"}.` : "Nenhum atendimento confirmado para esta data.";
  $("#appointments-list").innerHTML = appointments.length ? appointments.map((item) => `<article class="appointment"><span class="appointment-time">${escapeHtml(item.time)}</span><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.service)} · ${escapeHtml(item.phone)}</p></div></article>`).join("") : '<p class="empty-appointments">A agenda está livre neste dia.</p>';
}

function subscribeMonth() {
  if (unsubscribeAppointments) unsubscribeAppointments();
  const start = dateValue(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
  const end = dateValue(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0));
  const appointmentsQuery = query(collection(db, "appointments"), where("date", ">=", start), where("date", "<=", end));
  unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
    monthlyAppointments = snapshot.docs.map((entry) => entry.data());
    renderCalendar();
    renderAppointments();
  }, () => {
    monthlyAppointments = [];
    renderCalendar();
    renderAppointments();
  });
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("Entrando…");
  try { await signInWithEmailAndPassword(auth, $("#owner-email").value, $("#owner-password").value); }
  catch { showStatus("E-mail ou senha inválidos.", "error"); }
});

$("#calendar-days").addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  selectedDate = button.dataset.date;
  renderCalendar();
  renderAppointments();
});
$("#previous-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); selectedDate = dateValue(visibleMonth); subscribeMonth(); });
$("#next-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); selectedDate = dateValue(visibleMonth); subscribeMonth(); });
$("#logout-button").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) { $("#admin-login").hidden = false; $("#dashboard").hidden = true; if (unsubscribeAppointments) unsubscribeAppointments(); return; }
  $("#admin-login").hidden = true;
  $("#dashboard").hidden = false;
  subscribeMonth();
});
