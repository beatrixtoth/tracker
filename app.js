const ACTIVITY_RATES = {
  hiking: { unit: "km", rate: 0.5 },
  cycling: { unit: "min", rate: 0.4 },
  swimming: { unit: "min", rate: 0.6 },
  strength: { unit: "min", rate: 0.5 },
  workout: { unit: "min", rate: 0.6 }
};

let activityEntries = { a: [], b: [] };
let activityIdCounter = 0;
let currentActivityPerson = "a";

function activityOptions(selected){
  return [
    ["hiking", "Hiking"],
    ["cycling", "Cycling"],
    ["swimming", "Swimming"],
    ["strength", "Strength training"],
    ["workout", "Workout"]
  ].map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function activityLabel(activity){
  return {
    hiking: "Hiking",
    cycling: "Cycling",
    swimming: "Swimming",
    strength: "Strength training",
    workout: "Workout"
  }[activity] || "Activity";
}

function updateActivityAddUnit(person){
  const type = document.getElementById("activityType");
  const input = document.getElementById("activityMinutes");
  const unit = document.getElementById("activityUnit");
  const selected = ACTIVITY_RATES[type.value];
  if(unit) unit.textContent = selected.unit;
  if(input) input.placeholder = selected.unit;
}

function setActivityPerson(person){
  currentActivityPerson = person;
  document.getElementById("activitySenderA").classList.toggle("active", person === "a");
  document.getElementById("activitySenderB").classList.toggle("active", person === "b");
  updateActivityAddUnit();
}

function renderActivityList(){
  const list = document.getElementById("activityList");
  if(!list) return;
  const entries = [
    ...activityEntries.a.map(entry => ({ ...entry, person: "a" })),
    ...activityEntries.b.map(entry => ({ ...entry, person: "b" }))
  ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
  list.innerHTML = entries.map(entry => `
    <div class="board-msg activity-msg sender-${entry.person}" data-id="${entry.id}" data-person="${entry.person}" data-activity="${entry.activity}">
      <div class="board-msg-head">
        <span class="name-dot ${entry.person === "b" ? "dot-b" : "dot-a"} "></span>
        <span class="board-msg-name">${escapeHtml(document.querySelector(".person-name-" + entry.person).textContent)}</span>
        <span class="board-msg-time">${formatTime(entry.ts)}</span>
        <button type="button" class="board-msg-del activity-remove" data-id="${entry.id}" title="Remove">×</button>
      </div>
      <div class="activity-msg-controls">
        <span class="activity-msg-label">${activityLabel(entry.activity)}</span>
      <input type="number" class="activity-input saved-activity-input" data-id="${entry.id}" min="1" step="1" value="${entry.minutes}" aria-label="Minutes">
      <span class="activity-unit">${ACTIVITY_RATES[entry.activity].unit}</span>
      </div>
    </div>`).join("");
}

function syncActivityState(){
  const list = document.getElementById("activityList");
  if(!list) return;
  list.querySelectorAll(".activity-msg").forEach(row => {
    const existing = activityEntries[row.dataset.person].find(entry => entry.id === row.dataset.id);
    if(existing){
      existing.minutes = row.querySelector(".saved-activity-input").value;
      existing.activity = row.dataset.activity;
    }
  });
}

function addActivity(person){
  person = currentActivityPerson;
  const type = document.getElementById("activityType");
  const minutes = document.getElementById("activityMinutes");
  const value = parseFloat(minutes.value) || 0;
  if(value <= 0) return;
  activityEntries[person].push({
    id: "activity-" + person + "-" + Date.now() + "-" + (++activityIdCounter),
    activity: type.value,
    minutes: value,
    checked: true,
    ts: Date.now()
  });
  minutes.value = "";
  renderActivityList();
  recomputeAndSave();
}

function migrateActivities(data){
  const migrated = { a: [], b: [] };
  if(data && data.activities){
    ["a", "b"].forEach(person => {
      if(Array.isArray(data.activities[person])){
        migrated[person] = data.activities[person].map(entry => ({
          id: entry.id || "activity-" + person + "-" + (++activityIdCounter),
          activity: ACTIVITY_RATES[entry.activity] ? entry.activity : "hiking",
          minutes: entry.minutes || entry.value || "",
          checked: entry.checked !== false,
          ts: entry.ts || Date.now()
        }));
      } else {
        migrated[person] = Object.entries(data.activities)
          .filter(([id, entry]) => id.indexOf("activity-" + person + "-") === 0 && (entry.checked || entry.value))
          .map(([id, entry]) => ({
            id: "activity-" + person + "-" + (++activityIdCounter),
            activity: ACTIVITY_RATES[entry.activity] ? entry.activity : id.split("-").pop(),
            minutes: entry.value || "",
            checked: !!entry.checked,
            ts: entry.ts || Date.now()
          }))
          .filter(entry => ACTIVITY_RATES[entry.activity]);
      }
    });
  }
  return migrated;
}

function updateActivityUnits(){
  document.querySelectorAll(".activity-unit").forEach(unit => { unit.textContent = "min"; });
}

function recompute(){
  const nameA = document.getElementById("nameA").value.trim() || "Beatrix";
  const nameB = document.getElementById("nameB").value.trim() || "Julian";
  document.querySelectorAll(".person-name-a").forEach(el => el.textContent = nameA);
  document.querySelectorAll(".person-name-b").forEach(el => el.textContent = nameB);
  document.querySelectorAll(".board-sender-label-a").forEach(el => el.textContent = nameA);
  document.querySelectorAll(".board-sender-label-b").forEach(el => el.textContent = nameB);

  const checksA = document.querySelectorAll(".check-a");
  const checksB = document.querySelectorAll(".check-b");
  let doneA=0, doneB=0, kmA=0, kmB=0, goalTotalA=0, goalTotalB=0;
  let ptsA=0, ptsB=0, ptsPossibleA=0, ptsPossibleB=0;

  function goalOf(runEl, selector){
    const input = runEl.querySelector(selector);
    const raw = input ? input.value.trim() : "";
    return raw !== "" ? (parseFloat(raw) || 0) : 0;
  }

  checksA.forEach(c => {
    const runEl = c.closest(".run");
    const g = goalOf(runEl, ".goal-a");
    const mult = parseFloat(runEl.dataset.mult) || 1;
    goalTotalA += g;
    ptsPossibleA += g * mult;
    if(c.checked){ doneA++; kmA += g; ptsA += g * mult; }
  });
  checksB.forEach(c => {
    const runEl = c.closest(".run");
    const g = goalOf(runEl, ".goal-b");
    const mult = parseFloat(runEl.dataset.mult) || 1;
    goalTotalB += g;
    ptsPossibleB += g * mult;
    if(c.checked){ doneB++; kmB += g; ptsB += g * mult; }
  });

  function activityPoints(person){
    let points = 0;
    activityEntries[person].forEach(entry => {
      const activity = entry.activity;
      const amount = parseFloat(entry.minutes) || 0;
      if(!ACTIVITY_RATES[activity]) return;
      points += activity === "hiking" ? amount * ACTIVITY_RATES[activity].rate : (amount / 30) * ACTIVITY_RATES[activity].rate;
    });
    return points;
  }

  ptsA += activityPoints("a");
  ptsB += activityPoints("b");

  const pctA = ptsPossibleA ? Math.round((ptsA/ptsPossibleA)*100) : 0;
  const pctB = ptsPossibleB ? Math.round((ptsB/ptsPossibleB)*100) : 0;
  document.getElementById("barA").style.width = pctA + "%";
  document.getElementById("barB").style.width = pctB + "%";
  document.getElementById("ptsA").textContent = Math.round(ptsA);
  document.getElementById("ptsB").textContent = Math.round(ptsB);
  document.getElementById("kmA").textContent = Math.round(kmA*10)/10 + " / " + Math.round(goalTotalA*10)/10 + " km";
  document.getElementById("kmB").textContent = Math.round(kmB*10)/10 + " / " + Math.round(goalTotalB*10)/10 + " km";

  reorderRuns();
  reorderWeeks();
}

function reorderWeeks(){
  document.querySelectorAll(".weeks").forEach(grid => {
    const weeks = Array.from(grid.querySelectorAll(".week"));

    weeks.forEach(w => {
      const a = w.querySelectorAll(".check-a");
      const b = w.querySelectorAll(".check-b");
      const fullyDone = a.length > 0 &&
        Array.from(a).every(c => c.checked) &&
        Array.from(b).every(c => c.checked);
      w.classList.toggle("week-done", fullyDone);
      let markEl = w.querySelector(".week-check");
      if(fullyDone && !markEl){
        markEl = document.createElement("span");
        markEl.className = "week-check";
        markEl.textContent = "✓";
        w.querySelector(".week-head-left").appendChild(markEl);
      } else if(!fullyDone && markEl){
        markEl.remove();
      }
      if(fullyDone) w.removeAttribute("open");
    });

    const sorted = weeks.slice().sort((w1, w2) => {
      const d1 = w1.classList.contains("week-done") ? 1 : 0;
      const d2 = w2.classList.contains("week-done") ? 1 : 0;
      if(d1 !== d2) return d1 - d2;
      return parseInt(w1.dataset.order) - parseInt(w2.dataset.order);
    });
    sorted.forEach(w => grid.appendChild(w));
  });
}

function reorderRuns(){
  document.querySelectorAll(".person-section .runs").forEach(container => {
    const runs = Array.from(container.querySelectorAll(".run"));
    runs.forEach(r => {
      const check = r.querySelector(".run-check");
      r.classList.toggle("completed", !!(check && check.checked));
    });
    const sorted = runs.slice().sort((r1, r2) => {
      const d1 = r1.classList.contains("completed") ? 1 : 0;
      const d2 = r2.classList.contains("completed") ? 1 : 0;
      if(d1 !== d2) return d1 - d2;
      return parseInt(r1.dataset.order) - parseInt(r2.dataset.order);
    });
    sorted.forEach(r => container.appendChild(r));
  });
}

const LS_KEY = "trailhead-tracker-v1";

const firebaseConfig = {
  apiKey: "AIzaSyANgEsY48vWMmcMta7Yov313MHJBk49VOY",
  authDomain: "tracker-1102c.firebaseapp.com",
  databaseURL: "https://tracker-1102c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tracker-1102c",
  storageBucket: "tracker-1102c.firebasestorage.app",
  messagingSenderId: "348410508185",
  appId: "1:348410508185:web:80253e5ade6e04ff6a5908"
};

let dbRef = null;
let applyingRemote = false;
let writeTimer = null;

try{
  firebase.initializeApp(firebaseConfig);
  dbRef = firebase.database().ref("trailhead-tracker-v1");
}catch(e){ console.error("Firebase init failed, falling back to local-only saving:", e); }

/* ---- Password gate ---- */
try{
  const AUTH_EMAIL = "shared@trailhead.local";
  let hasUnlocked = false;

  function showApp(){
    const gate = document.getElementById("authGate");
    const wrapEl = document.querySelector(".wrap");
    if(gate) gate.style.display = "none";
    if(wrapEl) wrapEl.style.display = "block";
    if(!hasUnlocked){
      hasUnlocked = true;
      document.dispatchEvent(new Event("trailhead-unlocked"));
    }
  }

  function showGate(msg){
    const gate = document.getElementById("authGate");
    const wrapEl = document.querySelector(".wrap");
    if(wrapEl) wrapEl.style.display = "none";
    if(gate) gate.style.display = "flex";
    const errEl = document.getElementById("authError");
    if(errEl){
      if(msg){ errEl.textContent = msg; errEl.style.display = "block"; }
      else{ errEl.style.display = "none"; }
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if(user) showApp(); else showGate();
  });

  const authFormEl = document.getElementById("authForm");
  if(authFormEl){
    authFormEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const pwEl = document.getElementById("authPassword");
      const btn = document.getElementById("authSubmit");
      btn.disabled = true;
      firebase.auth().signInWithEmailAndPassword(AUTH_EMAIL, pwEl.value)
        .then(() => { pwEl.value = ""; })
        .catch(err => {
          const msg = (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials")
            ? "Wrong password — try again."
            : "Couldn't log in: " + err.message;
          showGate(msg);
        })
        .finally(() => { btn.disabled = false; });
    });
  }

  const logoutBtnEl = document.getElementById("logoutBtn");
  if(logoutBtnEl){
    logoutBtnEl.addEventListener("click", () => {
      firebase.auth().signOut().catch(e => console.error("Sign out failed:", e));
    });
  }
}catch(e){
  console.error("Auth setup failed:", e);
  const gate = document.getElementById("authGate");
  const errEl = document.getElementById("authError");
  if(gate) gate.style.display = "flex";
  if(errEl){ errEl.textContent = "Couldn't reach the login system — check your connection and reload."; errEl.style.display = "block"; }
}

function collectData(){
  syncActivityState();
  const data = {
    nameA: document.getElementById("nameA").value,
    nameB: document.getElementById("nameB").value,
    checks: {},
    goals: {},
    activities: activityEntries
  };
  document.querySelectorAll(".run-check").forEach(c => {
    data.checks[c.dataset.id] = c.checked;
  });
  document.querySelectorAll(".goal-input").forEach(i => {
    data.goals[i.dataset.id] = i.value;
  });
  return data;
}

function applyData(data){
  if(!data) return;
  if(data.nameA) document.getElementById("nameA").value = data.nameA;
  if(data.nameB) document.getElementById("nameB").value = data.nameB;
  document.querySelectorAll(".run-check").forEach(c => {
    c.checked = !!(data.checks && data.checks[c.dataset.id]);
  });
  document.querySelectorAll(".goal-input").forEach(i => {
    if(data.goals && data.goals[i.dataset.id] !== undefined) i.value = data.goals[i.dataset.id];
  });
  activityEntries = migrateActivities(data);
  renderActivityList();
}

function saveLocal(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(collectData())); }
  catch(e){ console.error("Could not save locally:", e); }
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    applyData(JSON.parse(raw));
  }catch(e){ console.error("Could not load local save:", e); }
}

function saveRemote(){
  if(!dbRef) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    dbRef.set(collectData()).catch(e => console.error("Could not save to Firebase:", e));
  }, 300);
}

function recomputeAndSave(){
  recompute();
  saveLocal();
  if(!applyingRemote) saveRemote();
}

document.querySelectorAll(".run-check").forEach(c => c.addEventListener("change", recomputeAndSave));
document.querySelectorAll(".goal-input").forEach(i => i.addEventListener("input", recomputeAndSave));
document.getElementById("addActivity").addEventListener("click", () => addActivity());
document.getElementById("activitySenderA").addEventListener("click", () => setActivityPerson("a"));
document.getElementById("activitySenderB").addEventListener("click", () => setActivityPerson("b"));
document.getElementById("activityType").addEventListener("change", updateActivityAddUnit);
setActivityPerson("a");
const activityList = document.getElementById("activityList");
activityList.addEventListener("input", () => { syncActivityState(); recomputeAndSave(); });
activityList.addEventListener("change", () => { syncActivityState(); recomputeAndSave(); });
activityList.addEventListener("click", e => {
  if(!e.target.classList.contains("activity-remove")) return;
  const person = e.target.closest(".activity-msg").dataset.person;
  activityEntries[person] = activityEntries[person].filter(entry => entry.id !== e.target.dataset.id);
  renderActivityList();
  recomputeAndSave();
});
document.getElementById("nameA").addEventListener("input", recomputeAndSave);
document.getElementById("nameB").addEventListener("input", recomputeAndSave);

document.getElementById("resetBtn").addEventListener("click", () => {
  if(!confirm("Reset all progress? This can't be undone.")) return;
  document.querySelectorAll(".run-check").forEach(c => { c.checked = false; });
  activityEntries = { a: [], b: [] };
  renderActivityList();
  recompute();
  saveLocal();
  saveRemote();
});

// Paint instantly from whatever's cached on this device, then let Firebase take over as the shared source of truth.
loadLocal();
recompute();

if(dbRef){
  document.addEventListener("trailhead-unlocked", () => {
    dbRef.on("value", snapshot => {
      applyingRemote = true;
      applyData(snapshot.val());
      recompute();
      saveLocal();
      applyingRemote = false;
    }, err => console.error("Firebase read failed:", err));
  });
}

/* ---- Message board ---- */
try{
const SENDER_KEY = "trailhead-tracker-sender";
let msgsRef = null;
try{
  if(firebase.apps && firebase.apps.length){
    msgsRef = firebase.database().ref("trailhead-tracker-v1-messages");
  }
}catch(e){ console.error("Firebase messages init failed:", e); }

let currentSender = localStorage.getItem(SENDER_KEY) || "a";
let pendingImage = null; // data URL of a compressed image, or null
let latestMessages = {};

function setSender(s){
  currentSender = s;
  localStorage.setItem(SENDER_KEY, s);
  const btnA = document.getElementById("senderBtnA");
  const btnB = document.getElementById("senderBtnB");
  if(btnA) btnA.classList.toggle("active", s === "a");
  if(btnB) btnB.classList.toggle("active", s === "b");
}
try{
  document.getElementById("senderBtnA").addEventListener("click", () => setSender("a"));
  document.getElementById("senderBtnB").addEventListener("click", () => setSender("b"));
  setSender(currentSender);
}catch(e){ console.error("Sender button setup failed:", e); }

function compressImage(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > h && w > maxDim){ h = Math.round(h * (maxDim / w)); w = maxDim; }
        else if(h > maxDim){ w = Math.round(w * (maxDim / h)); h = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.getElementById("boardImgInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    let quality = 0.7;
    let dataUrl = await compressImage(file, 900, quality);
    // Keep shrinking if still large, so it stays well under Realtime Database limits.
    while(dataUrl.length > 500000 && quality > 0.3){
      quality -= 0.15;
      dataUrl = await compressImage(file, 900, quality);
    }
    pendingImage = dataUrl;
    const preview = document.getElementById("boardImgPreview");
    preview.src = pendingImage;
    document.getElementById("boardImgPreviewWrap").style.display = "flex";
  }catch(err){
    console.error("Could not process image:", err);
    alert("Sorry, couldn't read that image — try a different file.");
  }
  e.target.value = "";
});

document.getElementById("boardImgRemove").addEventListener("click", () => {
  pendingImage = null;
  document.getElementById("boardImgPreviewWrap").style.display = "none";
});

document.getElementById("boardSendBtn").addEventListener("click", () => {
  const textEl = document.getElementById("boardText");
  const statusEl = document.getElementById("boardStatus");
  const sendBtn = document.getElementById("boardSendBtn");
  const text = textEl.value.trim();
  if(!text && !pendingImage) return;

  function showStatus(msg){
    if(statusEl){ statusEl.textContent = msg; statusEl.style.display = "block"; }
  }
  function hideStatus(){
    if(statusEl){ statusEl.style.display = "none"; }
  }

  if(!msgsRef){
    showStatus("Not connected to Firebase right now — reload the page or check your connection, then try again.");
    return;
  }

  const nameA = document.getElementById("nameA").value.trim() || "Beatrix";
  const nameB = document.getElementById("nameB").value.trim() || "Julian";
  const payload = {
    sender: currentSender,
    name: currentSender === "a" ? nameA : nameB,
    text: text,
    image: pendingImage || null,
    ts: Date.now()
  };

  sendBtn.disabled = true;
  hideStatus();
  msgsRef.push(payload)
    .then(() => {
      textEl.value = "";
      pendingImage = null;
      document.getElementById("boardImgPreviewWrap").style.display = "none";
      hideStatus();
    })
    .catch(e => {
      console.error("Could not post message:", e);
      const reason = (e && e.code === "PERMISSION_DENIED")
        ? "Permission denied — check that your Realtime Database rules allow writes."
        : "Couldn't send — check your connection and try again.";
      showStatus(reason);
    })
    .finally(() => { sendBtn.disabled = false; });
});

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatTime(ts){
  try{
    return new Date(ts).toLocaleString(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
  }catch(e){ return ""; }
}

function renderBoard(){
  const feed = document.getElementById("boardFeed");
  if(!feed) return;
  const entries = Object.entries(latestMessages)
    .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
    .slice(0, 3);
  if(entries.length === 0){
    feed.innerHTML = '<div class="board-empty">No messages yet — be the first to say something.</div>';
    return;
  }
  feed.innerHTML = entries.map(([key, m]) => {
    const senderClass = m.sender === "b" ? "sender-b" : "sender-a";
    const img = m.image ? `<img class="board-msg-img" src="${m.image}" alt="shared photo">` : "";
    const text = m.text ? `<div class="board-msg-text">${escapeHtml(m.text)}</div>` : "";
    return `<div class="board-msg ${senderClass}" data-key="${key}">
      <div class="board-msg-head">
        <span class="name-dot ${m.sender === "b" ? "dot-b" : "dot-a"}"></span>
        <span class="board-msg-name">${escapeHtml(m.name || "")}</span>
        <span class="board-msg-time">${formatTime(m.ts)}</span>
        <button type="button" class="board-msg-del" data-key="${key}" title="Delete">×</button>
      </div>
      ${text}${img}
    </div>`;
  }).join("");
  feed.querySelectorAll(".board-msg-del").forEach(btn => {
    btn.addEventListener("click", () => {
      if(!msgsRef) return;
      if(!confirm("Delete this message?")) return;
      msgsRef.child(btn.dataset.key).remove().catch(e => console.error("Could not delete message:", e));
    });
  });
}

document.addEventListener("trailhead-unlocked", () => {
  if(msgsRef){
    msgsRef.on("value", snapshot => {
      latestMessages = snapshot.val() || {};
      renderBoard();
    }, err => console.error("Could not load messages:", err));
  } else {
    renderBoard();
    const statusEl = document.getElementById("boardStatus");
    if(statusEl){
      statusEl.textContent = "Couldn't connect to the shared message board — check your internet connection and reload the page.";
      statusEl.style.display = "block";
    }
  }
});
}catch(e){ console.error("Message board setup failed, tracker is unaffected:", e); }