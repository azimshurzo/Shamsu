const API_URL = "http://localhost:4000";
let recordedSteps = [];

const $ = (id) => document.getElementById(id);

function showView(view) {
  $("loginView").classList.toggle("hidden", view !== "login");
  $("mainView").classList.toggle("hidden", view !== "main");
}

function setStatus(text, type) {
  const badge = $("statusBadge");
  badge.textContent = text;
  badge.className = `status status-${type}`;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  chrome.runtime.sendMessage({ type: "GET_USER" }, async (res) => {
    if (res?.user) {
      showView("main");
      $("userName").textContent = res.user.name;
    } else {
      showView("login");
    }
  });

  const tab = await getCurrentTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (res) => {
      if (res?.isRecording) {
        setStatus("Recording", "recording");
        $("recordingControls").classList.add("hidden");
        $("recordedControls").classList.remove("hidden");
        $("stepCount").textContent = `${res.stepCount} steps recorded`;
      }
    });
  }
}

$("loginBtn").addEventListener("click", () => {
  const email = $("loginEmail").value;
  const password = $("loginPassword").value;
  if (!email || !password) { $("loginError").textContent = "Fill all fields"; return; }

  $("loginBtn").textContent = "Signing in...";
  $("loginError").textContent = "";

  chrome.runtime.sendMessage({ type: "LOGIN", apiUrl: API_URL, email, password }, (res) => {
    if (res?.success) {
      showView("main");
      $("userName").textContent = res.user.name;
    } else {
      $("loginError").textContent = res?.error || "Login failed";
    }
    $("loginBtn").textContent = "Sign In";
  });
});

$("logoutBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
    showView("login");
  });
});

$("startBtn").addEventListener("click", async () => {
  const tab = await getCurrentTab();
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "START_RECORDING" }, (res) => {
    if (res?.status === "started") {
      setStatus("Recording", "recording");
      $("recordingControls").classList.add("hidden");
      $("recordedControls").classList.remove("hidden");
      $("stepCount").textContent = "0 steps recorded";
      $("tutorialBox").classList.add("hidden");
    }
  });
});

$("stopBtn").addEventListener("click", async () => {
  const tab = await getCurrentTab();
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "STOP_RECORDING" }, (res) => {
    recordedSteps = res?.steps || [];
    setStatus("Idle", "idle");
    $("recordedControls").classList.add("hidden");
    $("importControls").classList.remove("hidden");
    $("stepCount").textContent = `${recordedSteps.length} steps captured`;
  });
});

$("importBtn").addEventListener("click", () => {
  const name = $("workflowName").value.trim();
  if (!name) { $("importStatus").textContent = "Enter a workflow name"; $("importStatus").style.color = "#ff3366"; return; }
  if (recordedSteps.length === 0) { $("importStatus").textContent = "No steps recorded"; $("importStatus").style.color = "#ff3366"; return; }

  $("importBtn").textContent = "Importing...";
  $("importStatus").textContent = "";

  chrome.runtime.sendMessage({
    type: "IMPORT_WORKFLOW",
    apiUrl: API_URL,
    name,
    steps: recordedSteps,
  }, (res) => {
    if (res?.success) {
      $("importStatus").textContent = "Imported! Go to dashboard to review.";
      $("importStatus").style.color = "#00ff88";
      $("importControls").classList.add("hidden");
      $("recordingControls").classList.remove("hidden");
      $("tutorialBox").classList.remove("hidden");
      recordedSteps = [];
    } else {
      $("importStatus").textContent = res?.error || "Import failed";
      $("importStatus").style.color = "#ff3366";
    }
    $("importBtn").textContent = "Import to Shamsu";
  });
});

$("resetBtn").addEventListener("click", () => {
  recordedSteps = [];
  $("importControls").classList.add("hidden");
  $("recordingControls").classList.remove("hidden");
  $("tutorialBox").classList.remove("hidden");
  $("workflowName").value = "";
  $("importStatus").textContent = "";
});

init();
