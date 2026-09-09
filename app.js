import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, orderBy, query, runTransaction, where } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Cole aqui as credenciais do aplicativo Web criado no Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyAPqaUuNePl5FUW2vQWOMO1K5VmMmFGvOY",
  authDomain: "dudy-barbearia-online.firebaseapp.com",
  projectId: "dudy-barbearia-online",
  storageBucket: "dudy-barbearia-online.firebasestorage.app",
  messagingSenderId: "289030728896",
  appId: "1:289030728896:web:78a0bc5b9e580bfd139125"
};

const slots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const $ = (selector) => document.querySelector(selector);
const form = $("#booking-form"), dateInput = $("#booking-date"), timeSlots = $("#time-slots"), timeInput = $("#booking-time"), bookingStatus = $("#booking-status");
let app, auth, db;
let unsubscribeAppointments = null;

const today = new Date();
today.setHours(0, 0, 0, 0);
dateInput.min = toDateValue(today);

function toDateValue(date) { return date.toISOString().slice(0, 10); }
function isClosed(dateValue) { const day = new Date(`${dateValue}T12:00:00`).getDay(); return day === 0 || day === 1; }
function showStatus(element, message, type = "") { element.textContent = message; element.className = `form-status ${type}`; }
function configured() { return firebaseConfig.apiKey !== "COLE_AQUI" && firebaseConfig.projectId !== "COLE_AQUI"; }

if (configured()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  showStatus(bookingStatus, "Sistema em modo de configuração. A agenda ficará online assim que o Firebase for conectado.", "error");
}

async function loadSlots() {
  const date = dateInput.value;
  timeInput.value = "";
  if (!date) { timeSlots.innerHTML = "<p>Escolha um dia para ver os horários.</p>"; return; }
  if (isClosed(date)) { timeSlots.innerHTML = "<p>A barbearia não atende aos domingos e segundas.</p>"; return; }
  timeSlots.innerHTML = "<p>Consultando horários livres…</p>";
  try {
    const result = configured() ? await new Promise((resolve, reject) => {
      const slotsQuery = query(collection(db, "availability"), where("date", "==", date));
      const stop = onSnapshot(slotsQuery, (snapshot) => { stop(); resolve(snapshot.docs.map((item) => item.data().time)); }, reject);
    }) : [];
    const occupied = result;
    timeSlots.innerHTML = slots.map((time) => `<button class="time-slot" type="button" data-time="${time}" ${occupied.includes(time) ? "disabled" : ""}>${time}</button>`).join("");
  } catch (error) {
    timeSlots.innerHTML = "<p>Não foi possível consultar os horários. Tente novamente.</p>";
  }
}

dateInput.addEventListener("change", loadSlots);
timeSlots.addEventListener("click", (event) => {
  const button = event.target.closest(".time-slot");
  if (!button || button.disabled) return;
  timeSlots.querySelectorAll(".time-slot").forEach((slot) => slot.classList.remove("selected"));
  button.classList.add("selected");
  timeInput.value = button.dataset.time;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const date = dateInput.value;
  if (isClosed(date)) { showStatus(bookingStatus, "Escolha um dia de atendimento.", "error"); return; }
  if (!timeInput.value) { showStatus(bookingStatus, "Escolha um horário disponível.", "error"); return; }
  if (!configured()) { showStatus(bookingStatus, "A agenda ainda não foi conectada ao Firebase.", "error"); return; }
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  showStatus(bookingStatus, "Confirmando seu horário…");
  try {
    const time = timeInput.value;
    const bookingId = `${date}_${time.replace(":", "")}`;
    const booking = { date, time, service: $("#service").value, name: $("#client-name").value.trim(), phone: $("#client-phone").value.trim(), createdAt: new Date() };
    await runTransaction(db, async (transaction) => {
      const availabilityRef = doc(db, "availability", bookingId);
      const bookingRef = doc(db, "appointments", bookingId);
      if ((await transaction.get(availabilityRef)).exists()) throw new Error("already-exists");
      transaction.set(bookingRef, booking);
      transaction.set(availabilityRef, { date, time, bookingId, createdAt: new Date() });
    });
    showStatus(bookingStatus, `Pronto! Seu horário foi reservado para ${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} às ${timeInput.value}.`, "success");
    form.reset(); timeInput.value = ""; timeSlots.innerHTML = "<p>Escolha um dia para ver os horários.</p>";
  } catch (error) {
    showStatus(bookingStatus, error.message?.includes("already-exists") ? "Esse horário acabou de ser reservado. Escolha outro." : "Não foi possível concluir. Confira os dados e tente novamente.", "error");
    await loadSlots();
  } finally { submit.disabled = false; }
});

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const loginStatus = $("#login-status");
  if (!configured()) { showStatus(loginStatus, "Conecte o Firebase para ativar o acesso do dono.", "error"); return; }
  showStatus(loginStatus, "Entrando…");
  try { await signInWithEmailAndPassword(auth, $("#owner-email").value, $("#owner-password").value); }
  catch { showStatus(loginStatus, "E-mail ou senha inválidos.", "error"); }
});

function renderAppointments(items) {
  const target = $("#appointments-list");
  target.innerHTML = items.length ? items.map((item) => `<article class="appointment"><span class="appointment-time">${item.time}</span><div><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.service)} · ${escapeHtml(item.phone)}</p></div></article>`).join("") : '<p class="empty-appointments">Nenhum agendamento para hoje.</p>';
}
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function listenToToday() {
  if (unsubscribeAppointments) unsubscribeAppointments();
  const date = toDateValue(today);
  $("#agenda-title").textContent = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const appointments = query(collection(db, "appointments"), where("date", "==", date), orderBy("time"));
  unsubscribeAppointments = onSnapshot(appointments, (snapshot) => renderAppointments(snapshot.docs.map((doc) => doc.data())), () => renderAppointments([]));
}

if (configured()) onAuthStateChanged(auth, async (user) => {
  const login = $("#login-form"), dashboard = $("#dashboard");
  if (!user) { login.hidden = false; dashboard.hidden = true; if (unsubscribeAppointments) unsubscribeAppointments(); return; }
  const token = await user.getIdTokenResult(true);
  if (!token.claims.email) { showStatus($("#login-status"), "Esta conta não tem acesso de administrador.", "error"); await signOut(auth); return; }
  login.hidden = true; dashboard.hidden = false; listenToToday();
});
$("#logout-button").addEventListener("click", () => configured() && signOut(auth));
