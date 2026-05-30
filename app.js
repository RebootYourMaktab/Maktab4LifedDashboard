const API_BASE = "https://maktab4lifeworker.maktab4life.workers.dev";

const state = {
  portalType: null,
  uniqueid: null,
  token: localStorage.getItem("maktab_token") || "",
  userType: localStorage.getItem("maktab_user_type") || "",
  user: null
};

window.addEventListener("load", initApp);

function initApp() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "admin" && parts[1]) {
    state.portalType = "admin";
    state.uniqueid = parts[1];
    checkAdmin();
    return;
  }

  if (parts[0] === "u" && parts[1]) {
    state.portalType = "student";
    state.uniqueid = parts[1];
    checkStudent();
    return;
  }

  document.getElementById("portal-title").innerText = "UmmAbbad Academy";
  document.getElementById("portal-subtitle").innerText =
    "Please open your personal login link.";
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
}

function setError(message) {
  document.getElementById("auth-error").innerText = message || "";
}

async function apiPost(path, body = {}, token = "") {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  return response.json();
}

async function checkStudent() {
  try {
    const result = await apiPost("/api/check-student", {
      uniqueid: state.uniqueid
    });

    if (!result.success) {
      setError(result.error || "Invalid student link");
      return;
    }

    state.user = result.student;

    document.getElementById("portal-title").innerText = "Student Portal";
    document.getElementById("portal-subtitle").innerText =
      `Welcome ${result.student.username}`;

    if (result.student.pinsetup === true) {
      document.getElementById("login-pin-box").classList.remove("hidden");
    } else {
      document.getElementById("setup-pin-box").classList.remove("hidden");
    }
  } catch (err) {
    setError("Unable to connect. Please try again.");
  }
}

async function checkAdmin() {
  try {
    const result = await apiPost("/api/admin/check-admin", {
      uniqueid: state.uniqueid
    });

    if (!result.success) {
      setError(result.error || "Invalid admin link");
      return;
    }

    state.user = result.admin;

    document.getElementById("portal-title").innerText = "Staff Portal";
    document.getElementById("portal-subtitle").innerText =
      `${result.admin.username} · ${result.admin.role}`;

    document.body.classList.add("admin-body");

    if (result.admin.pinsetup === true) {
      document.getElementById("login-pin-box").classList.remove("hidden");
    } else {
      document.getElementById("setup-pin-box").classList.remove("hidden");
    }
  } catch (err) {
    setError("Unable to connect. Please try again.");
  }
}

async function submitSetupPin() {
  const pin = document.getElementById("setup-pin").value.trim();

  if (!/^\d{4}$/.test(pin)) {
    setError("PIN must be 4 digits.");
    return;
  }

  const path = state.portalType === "admin"
    ? "/api/admin/setup-pin"
    : "/api/setup-pin";

  const result = await apiPost(path, {
    uniqueid: state.uniqueid,
    pin
  });

  if (!result.success) {
    setError(result.error || "Could not set PIN.");
    return;
  }

  document.getElementById("setup-pin-box").classList.add("hidden");
  document.getElementById("login-pin-box").classList.remove("hidden");
  setError("");
}

async function submitLogin() {
  const pin = document.getElementById("login-pin").value.trim();

  if (!/^\d{4}$/.test(pin)) {
    setError("PIN must be 4 digits.");
    return;
  }

  const path = state.portalType === "admin"
    ? "/api/admin/login"
    : "/api/login";

  const result = await apiPost(path, {
    uniqueid: state.uniqueid,
    pin
  });

  if (!result.success) {
    setError(result.error || "Login failed.");
    return;
  }

  state.token = result.token;
  state.userType = state.portalType;
  state.user = state.portalType === "admin" ? result.admin : result.student;

  localStorage.setItem("maktab_token", state.token);
  localStorage.setItem("maktab_user_type", state.userType);

  if (state.portalType === "admin") {
    document.getElementById("admin-welcome").innerText =
      `${result.admin.username} · ${result.admin.role}`;
    showScreen("admin-home");
  } else {
    document.getElementById("student-welcome").innerText =
      `${result.student.username} · ${result.student.classgroup}`;
    showScreen("student-home");
  }
}

function logout() {
  localStorage.removeItem("maktab_token");
  localStorage.removeItem("maktab_user_type");
  location.reload();
}

function goHome() {
  if (state.userType === "admin" || state.portalType === "admin") {
    showScreen("admin-home");
  } else {
    showScreen("student-home");
  }
}

function showPlaceholder(title) {
  document.getElementById("placeholder-title").innerText = title;
  showScreen("placeholder-screen");
}

function showAdminAcademics() {
  showScreen("admin-academics");
}

async function showStudentTasks() {
  showScreen("student-tasks");

  const container = document.getElementById("student-task-list");
  container.innerHTML = `<p class="helper-text">Loading tasks...</p>`;

  const result = await apiPost("/api/tasks/student", {
    subjectid: "ALL"
  }, state.token);

  if (!result.success) {
    container.innerHTML = `<p class="error-message">${result.error || "Failed to load tasks"}</p>`;
    return;
  }

  if (result.tasks.length === 0) {
    container.innerHTML = `<p class="helper-text">No tasks assigned yet.</p>`;
    return;
  }

  container.innerHTML = result.tasks.map(task => `
    <div class="task-card">
      <div class="task-title">${escapeHtml(task.taskname)}</div>
      <div class="task-meta">${escapeHtml(task.subjectname)}</div>

      <div class="status-pill">
        ${escapeHtml(task.displayCompleteStatus)}
      </div>

      <div class="status-pill">
        ${escapeHtml(task.displayVerifyStatus)}
      </div>

      <button style="margin-top:12px;" onclick="toggleStudentTask('${task.studenttaskid}', ${task.completestatus ? "false" : "true"})">
        ${task.completestatus ? "Mark Not Complete" : "Mark Complete"}
      </button>
    </div>
  `).join("");
}

async function toggleStudentTask(studenttaskid, complete) {
  const result = await apiPost("/api/tasks/update-complete", {
    studenttaskid,
    complete
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not update task.");
    return;
  }

  showStudentTasks();
}

function showProgressReport() {
  showScreen("progress-report");
}

async function loadProgressReport() {
  const output = document.getElementById("progress-output");
  output.innerHTML = `<p class="helper-text">Loading report...</p>`;

  const result = await apiPost("/api/progress/tasks", {
    studentid: "ALL",
    classgroup: "ALL",
    subjectid: "ALL"
  }, state.token);

  if (!result.success) {
    output.innerHTML = `<p class="error-message">${result.error || "Failed to load progress"}</p>`;
    return;
  }

  output.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-number">${result.summary.completedPercent}%</div>
        <div class="mini-text">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${result.summary.verifiedPercent}%</div>
        <div class="mini-text">Verified</div>
      </div>
    </div>

    <div class="dashboard-section">
      <h3>Groups</h3>
      ${
        result.groups.length
          ? result.groups.map(group => `
            <div class="task-card admin-task-card">
              <div class="task-title">${escapeHtml(group.classgroup)}</div>
              <div class="task-meta">Completed: ${group.completedPercent}%</div>
              <div class="task-meta">Verified: ${group.verifiedPercent}%</div>
            </div>
          `).join("")
          : `<p class="helper-text">No group data yet.</p>`
      }
    </div>
  `;
}


let allSubjects = [];
let pendingSubjects = [];
let selectedSubject = null;
let selectedSubjectDraftActive = null;

async function showSubjectsScreen() {
  showScreen("subjects-screen");

  pendingSubjects = [];
  selectedSubject = null;
  selectedSubjectDraftActive = null;

  document.getElementById("subject-add-message").innerText = "";
  document.getElementById("modify-subject-box").classList.add("hidden");

  renderSubjectAddRows();
  await loadSubjectsForModify();
}

function renderSubjectAddRows() {
  const container = document.getElementById("subject-add-list");
  const submitBtn = document.getElementById("submit-subjects-btn");

  let html = "";

  pendingSubjects.forEach((name, index) => {
    html += `
      <div class="pending-subject-chip">
        <span>${escapeHtml(name)}</span>
        <button onclick="removePendingSubject(${index})">Remove</button>
      </div>
    `;
  });

  if (pendingSubjects.length < 5) {
    html += `
      <div class="subject-add-row">
        <input
          id="new-subject-input"
          type="text"
          placeholder="add a new subject"
          onkeydown="handleSubjectInputKey(event)"
        />
        <button class="enter-btn" onclick="addPendingSubject()">↵</button>
      </div>
    `;
  }

  container.innerHTML = html;

  if (pendingSubjects.length > 0) {
    submitBtn.classList.remove("hidden");
  } else {
    submitBtn.classList.add("hidden");
  }
}

function handleSubjectInputKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addPendingSubject();
  }
}

function addPendingSubject() {
  const input = document.getElementById("new-subject-input");
  const subjectName = input ? input.value.trim() : "";

  if (!subjectName) {
    alert("Enter a subject name.");
    return;
  }

  if (pendingSubjects.length >= 5) {
    alert("You can add up to 5 subjects at once.");
    return;
  }

  const normalizedNew = normalizeClientText(subjectName);

  const duplicatePending = pendingSubjects.some(
    name => normalizeClientText(name) === normalizedNew
  );

  if (duplicatePending) {
    alert("This subject is already in your pending list.");
    return;
  }

  const duplicateExisting = allSubjects.some(
    subject => normalizeClientText(subject.subjectname) === normalizedNew
  );

  if (duplicateExisting) {
    alert("This subject already exists.");
    return;
  }

  pendingSubjects.push(subjectName);
  renderSubjectAddRows();

  setTimeout(() => {
    const nextInput = document.getElementById("new-subject-input");
    if (nextInput) nextInput.focus();
  }, 50);
}

function removePendingSubject(index) {
  pendingSubjects.splice(index, 1);
  renderSubjectAddRows();
}

async function submitPendingSubjects() {
  if (pendingSubjects.length === 0) {
    return;
  }

  const added = [];
  const failed = [];

  for (const subjectName of pendingSubjects) {
    const result = await apiPost("/api/admin/subjects/create", {
      subjectName
    }, state.token);

    if (result.success) {
      added.push(result.subject.subjectname);
    } else {
      failed.push({
        subjectName,
        error: result.error || "Failed"
      });
    }
  }

  if (added.length > 0) {
    document.getElementById("subject-add-message").innerText =
      `${added.join(", ")} ${added.length === 1 ? "has" : "have"} been added.`;
  }

  if (failed.length > 0) {
    alert(
      "Some subjects were not added:\n" +
      failed.map(f => `${f.subjectName}: ${f.error}`).join("\n")
    );
  }

  pendingSubjects = [];
  renderSubjectAddRows();
  await loadSubjectsForModify();
}

async function loadSubjectsForModify() {
  const select = document.getElementById("modify-subject-select");

  select.innerHTML = `<option value="">Loading subjects...</option>`;

  const result = await apiPost("/api/admin/subjects/list", {}, state.token);

  if (!result.success) {
    select.innerHTML = `<option value="">Failed to load subjects</option>`;
    return;
  }

  allSubjects = result.subjects || [];

  select.innerHTML = `<option value="">Select subject...</option>`;

  allSubjects.forEach(subject => {
    const status = subject.active === true ? "ACTIVE" : "INACTIVE";

    const option = document.createElement("option");
    option.value = subject.subjectid;
    option.textContent = `${subject.subjectname} — ${status}`;

    select.appendChild(option);
  });
}

function selectSubjectToModify() {
  const subjectid = document.getElementById("modify-subject-select").value;

  selectedSubject = allSubjects.find(subject => subject.subjectid === subjectid);

  const box = document.getElementById("modify-subject-box");

  if (!selectedSubject) {
    box.classList.add("hidden");
    selectedSubjectDraftActive = null;
    return;
  }

  selectedSubjectDraftActive = selectedSubject.active === true;

  document.getElementById("modify-subject-name").value = selectedSubject.subjectname;

  renderSelectedSubjectStatus();

  box.classList.remove("hidden");
}

function renderSelectedSubjectStatus() {
  const statusDisplay = document.getElementById("selected-subject-status");
  const statusBtn = document.getElementById("toggle-subject-status-btn");

  if (!selectedSubject) {
    statusDisplay.innerText = "STATUS: -";
    statusBtn.innerText = "Change Status";
    return;
  }

  statusDisplay.innerText = selectedSubjectDraftActive
    ? "STATUS: ACTIVE"
    : "STATUS: INACTIVE";

  statusBtn.innerText = selectedSubjectDraftActive
    ? "Make Inactive"
    : "Make Active";
}

function toggleSubjectStatusLocal() {
  if (!selectedSubject) {
    alert("Select a subject first.");
    return;
  }

  selectedSubjectDraftActive = !selectedSubjectDraftActive;
  renderSelectedSubjectStatus();
}

async function saveSubjectChanges() {
  if (!selectedSubject) {
    alert("Select a subject first.");
    return;
  }

  const subjectName = document.getElementById("modify-subject-name").value.trim();

  if (!subjectName) {
    alert("Subject name cannot be empty.");
    return;
  }

  const result = await apiPost("/api/admin/subjects/update", {
    subjectid: selectedSubject.subjectid,
    subjectName,
    active: selectedSubjectDraftActive
  }, state.token);

  if (!result.success) {
    alert(result.error || "Could not update subject.");
    return;
  }

  alert("Subject changes saved.");

  await loadSubjectsForModify();

  document.getElementById("modify-subject-box").classList.add("hidden");
  selectedSubject = null;
  selectedSubjectDraftActive = null;
}

function normalizeClientText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}









function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
