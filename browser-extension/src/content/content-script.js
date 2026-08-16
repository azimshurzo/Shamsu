(function () {
  if (window.__shamsu_injected) return;
  window.__shamsu_injected = true;

  let isRecording = false;
  let isExtractMode = false;
  let steps = [];
  let extractionTargets = [];
  let panel = null;
  let panelVisible = false;
  let authToken = null;

  chrome.storage.local.get(["shamsu_auth_token"], (d) => {
    authToken = d.shamsu_auth_token || null;
  });

  function getSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    const testId = el.getAttribute("data-testid");
    if (testId) return `[data-testid="${testId}"]`;
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.length < 60) return `${el.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.length < 60) return `${el.tagName.toLowerCase()}[placeholder="${placeholder}"]`;
    if (el.className && typeof el.className === "string") {
      const stableClasses = el.className.trim().split(/\s+/).filter(
        (c) => !/^[a-f0-9]{6,}$/i.test(c) && c.length < 30
      );
      if (stableClasses.length > 0) {
        return `${el.tagName.toLowerCase()}.${stableClasses.slice(0, 3).join(".")}`;
      }
    }
    let path = [];
    let current = el;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) { selector = `#${current.id}`; path.unshift(selector); break; }
      const tid = current.getAttribute?.("data-testid");
      if (tid) { path.unshift(`[data-testid="${tid}"]`); break; }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ");
  }

  function getContainerInfo(el) {
    let current = el;
    for (let i = 0; i < 15; i++) {
      current = current.parentElement;
      if (!current || current === document.body) break;
      const parent = current.parentElement;
      if (!parent) break;
      const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
      if (siblings.length > 1) {
        return { selector: getSelector(current), count: siblings.length };
      }
    }
    return null;
  }

  function getElementLabel(el) {
    return el.closest("label")?.textContent?.trim() ||
      el.getAttribute("aria-label") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("title") ||
      el.closest("[data-label]")?.getAttribute("data-label") ||
      el.textContent?.trim().slice(0, 60) ||
      el.tagName.toLowerCase();
  }

  function saveState() {
    chrome.storage.local.set({
      shamsu_recording: isRecording,
      shamsu_steps: steps,
      shamsu_extractions: extractionTargets,
    });
  }

  function addStep(step) {
    steps.push(step);
    saveState();
    updatePanel();
  }

  function showFieldNamePopup(defaultName, onSave) {
    const existing = document.getElementById("shamsu-field-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.id = "shamsu-field-popup";
    popup.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 2147483646; width: 320px; background: #0a0a0f; color: #e2e8f0;
      border-radius: 12px; border: 1px solid rgba(0,212,255,0.25);
      box-shadow: 0 0 40px rgba(0,212,255,0.2), 0 8px 32px rgba(0,0,0,0.8);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px; padding: 20px;
    `;
    popup.innerHTML = `
      <div style="margin-bottom: 6px; font-weight: 700; font-size: 14px; background: linear-gradient(135deg, #00d4ff, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        Name Data Field
      </div>
      <div style="margin-bottom: 14px; font-size: 11px; color: #64748b;">
        Enter a name for this extracted data field:
      </div>
      <input id="shamsu-field-input" type="text" value="${defaultName}" style="
        width: 100%; padding: 10px 12px; background: #0d0d14;
        border: 1px solid rgba(0,212,255,0.15); border-radius: 6px;
        color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box;
        margin-bottom: 14px;
      " />
      <div style="display: flex; gap: 8px;">
        <button id="shamsu-field-save" style="
          flex: 1; padding: 9px; border: none; border-radius: 6px;
          background: linear-gradient(135deg, #00d4ff, #7c3aed);
          color: #0a0a0f; font-size: 12px; font-weight: 700; cursor: pointer;
        ">Save</button>
        <button id="shamsu-field-cancel" style="
          flex: 1; padding: 9px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
          background: transparent; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer;
        ">Cancel</button>
      </div>
    `;

    document.body.appendChild(popup);

    const input = popup.querySelector("#shamsu-field-input");
    input.focus();
    input.select();

    function cleanup() {
      popup.remove();
      document.removeEventListener("keydown", onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        cleanup();
        onSave(input.value.trim());
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    popup.querySelector("#shamsu-field-save").addEventListener("click", () => {
      cleanup();
      onSave(input.value.trim());
    });

    popup.querySelector("#shamsu-field-cancel").addEventListener("click", () => {
      cleanup();
    });
  }

  function handleClick(e) {
    if (!isRecording) return;
    if (panel && panel.contains(e.target)) return;
    if (document.getElementById("shamsu-field-popup")?.contains(e.target)) return;
    const el = e.target;

    if (isExtractMode) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const container = getContainerInfo(el);
      const autoLabel = getElementLabel(el);

      showFieldNamePopup(autoLabel, (fieldName) => {
        const target = {
          selector: getSelector(el),
          label: autoLabel,
          fieldName: fieldName || autoLabel,
          containerSelector: container?.selector || null,
          containerCount: container?.count || 1,
          url: window.location.href,
          timestamp: Date.now(),
        };

        extractionTargets.push(target);
        saveState();
        updatePanel();

        el.style.outline = "3px solid #00ff88";
        el.style.outlineOffset = "2px";
        setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 1500);
      });
      return;
    }

    const container = getContainerInfo(el);
    addStep({
      actionType: "CLICK",
      selector: getSelector(el),
      context: getElementLabel(el),
      text: el.textContent?.trim().slice(0, 100),
      url: window.location.href,
      container: container,
      timestamp: Date.now(),
    });
  }

  function handleInput(e) {
    if (!isRecording) return;
    if (isExtractMode) return;
    if (panel && panel.contains(e.target)) return;
    const el = e.target;
    const existing = steps.findIndex(
      (s) => s.selector === getSelector(el) && s.actionType === "INPUT" && s.url === window.location.href
    );
    const step = {
      actionType: "INPUT",
      selector: getSelector(el),
      value: el.value,
      context: getElementLabel(el),
      url: window.location.href,
      timestamp: Date.now(),
    };
    if (existing >= 0) {
      steps[existing] = step;
    } else {
      steps.push(step);
    }
    saveState();
    updatePanel();
  }

  function handleFormSubmit(e) {
    if (!isRecording || isExtractMode) return;
    if (panel && panel.contains(e.target)) return;
    addStep({
      actionType: "CLICK",
      selector: getSelector(e.target.querySelector("[type=submit]") || e.target),
      context: "Form Submission",
      url: window.location.href,
      timestamp: Date.now(),
    });
  }

  function attachListeners() {
    document.addEventListener("click", handleClick, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("submit", handleFormSubmit, true);
  }

  function detachListeners() {
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("submit", handleFormSubmit, true);
  }

  function createPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "shamsu-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <style>
        #shamsu-panel {
          position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
          width: 300px; background: #0a0a0f; color: #e2e8f0;
          border-radius: 12px; border: 1px solid rgba(0,212,255,0.2);
          box-shadow: 0 0 30px rgba(0,212,255,0.15), 0 8px 32px rgba(0,0,0,0.6);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px; user-select: none;
        }
        #shamsu-panel .sp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-bottom: 1px solid rgba(0,212,255,0.1);
        }
        #shamsu-panel .sp-logo {
          font-weight: 700; font-size: 14px;
          background: linear-gradient(135deg, #00d4ff, #7c3aed);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        #shamsu-panel .sp-rec-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
        }
        #shamsu-panel .sp-rec-badge.active { background: rgba(255,51,102,0.15); color: #ff3366; }
        #shamsu-panel .sp-rec-badge.idle { background: rgba(255,255,255,0.05); color: #64748b; }
        #shamsu-panel .sp-rec-badge .sp-dot {
          width: 6px; height: 6px; border-radius: 50%; background: currentColor;
        }
        #shamsu-panel .sp-rec-badge.active .sp-dot { animation: spPulse 1s infinite; }
        @keyframes spPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        #shamsu-panel .sp-body { padding: 12px 14px; max-height: 70vh; overflow-y: auto; }
        #shamsu-panel .sp-section { margin-bottom: 10px; }
        #shamsu-panel .sp-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        #shamsu-panel .sp-input {
          width: 100%; padding: 8px 10px; background: #0d0d14;
          border: 1px solid rgba(0,212,255,0.12); border-radius: 6px;
          color: #e2e8f0; font-size: 12px; outline: none; box-sizing: border-box;
        }
        #shamsu-panel .sp-input:focus { border-color: #00d4ff; }
        #shamsu-panel .sp-btn {
          width: 100%; padding: 9px; border: none; border-radius: 6px;
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        #shamsu-panel .sp-btn-primary { background: linear-gradient(135deg, #00d4ff, #7c3aed); color: #0a0a0f; }
        #shamsu-panel .sp-btn-primary:hover { opacity: 0.9; }
        #shamsu-panel .sp-btn-danger { background: rgba(255,51,102,0.15); color: #ff3366; border: 1px solid rgba(255,51,102,0.3); }
        #shamsu-panel .sp-btn-danger:hover { background: rgba(255,51,102,0.25); }
        #shamsu-panel .sp-btn-extract {
          background: rgba(0,255,136,0.1); color: #00ff88;
          border: 1px solid rgba(0,255,136,0.3);
        }
        #shamsu-panel .sp-btn-extract:hover { background: rgba(0,255,136,0.2); }
        #shamsu-panel .sp-btn-extract.active {
          background: #00ff88; color: #0a0a0f;
        }
        #shamsu-panel .sp-btn-secondary { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        #shamsu-panel .sp-btn-secondary:hover { border-color: rgba(0,212,255,0.3); color: #e2e8f0; }
        #shamsu-panel .sp-stats { display: flex; gap: 8px; margin-top: 8px; }
        #shamsu-panel .sp-stat {
          flex: 1; text-align: center; padding: 6px; border-radius: 6px;
          background: rgba(255,255,255,0.03);
        }
        #shamsu-panel .sp-stat-val { font-size: 16px; font-weight: 700; }
        #shamsu-panel .sp-stat-label { font-size: 9px; color: #64748b; margin-top: 2px; }
        #shamsu-panel .sp-extract-list { max-height: 80px; overflow-y: auto; margin-top: 6px; }
        #shamsu-panel .sp-extract-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 4px 8px; border-radius: 4px; margin-bottom: 3px;
          background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.1);
          font-size: 11px;
        }
        #shamsu-panel .sp-extract-item .sp-remove {
          cursor: pointer; color: #ff3366; font-size: 14px; line-height: 1;
        }
        #shamsu-panel .sp-divider { height: 1px; background: rgba(0,212,255,0.08); margin: 8px 0; }
        #shamsu-panel .sp-status { font-size: 11px; color: #64748b; text-align: center; padding: 4px; min-height: 20px; }
        #shamsu-panel .sp-close {
          cursor: pointer; color: #64748b; font-size: 16px; line-height: 1;
          background: none; border: none; padding: 0;
        }
        #shamsu-panel .sp-close:hover { color: #e2e8f0; }
        #shamsu-panel .sp-auth-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; border-radius: 6px; margin-bottom: 10px;
          background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.15);
          font-size: 11px; color: #00ff88;
        }
        #shamsu-panel .sp-auth-bar.logged-out {
          background: rgba(255,170,0,0.05); border-color: rgba(255,170,0,0.15); color: #ffaa00;
        }
      </style>
      <div class="sp-header">
        <span class="sp-logo">SHAMSU</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="sp-rec-badge idle" id="spBadge"><span class="sp-dot"></span><span id="spBadgeText">Idle</span></span>
          <button class="sp-close" id="spClose">&times;</button>
        </div>
      </div>
      <div class="sp-body" id="spBody"></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector("#spClose").addEventListener("click", (e) => {
      e.stopPropagation();
      hidePanel();
    });

    renderPanelContent();
  }

  function showPanel() {
    if (!panel) createPanel();
    panel.style.display = "block";
    panelVisible = true;
    renderPanelContent();
  }

  function hidePanel() {
    if (panel) panel.style.display = "none";
    panelVisible = false;
  }

  function togglePanel() {
    if (panelVisible) hidePanel();
    else showPanel();
  }

  function renderPanelContent() {
    if (!panel) return;
    const body = panel.querySelector("#spBody");
    if (!body) return;

    if (!authToken) {
      body.innerHTML = `
        <div class="sp-auth-bar logged-out">
          <span>Not logged in</span>
        </div>
        <div class="sp-section">
          <div class="sp-label">Email</div>
          <input class="sp-input" id="spEmail" type="email" placeholder="you@example.com" />
        </div>
        <div class="sp-section">
          <div class="sp-label">Password</div>
          <input class="sp-input" id="spPass" type="password" placeholder="Your password" />
        </div>
        <div class="sp-section">
          <div class="sp-label">Backend URL</div>
          <input class="sp-input" id="spApiUrl" value="http://localhost:4000" />
        </div>
        <button class="sp-btn sp-btn-primary" id="spLoginBtn">Log In</button>
        <div class="sp-status" id="spStatus"></div>
      `;
      body.querySelector("#spLoginBtn").addEventListener("click", doLogin);
      return;
    }

    if (!isRecording) {
      body.innerHTML = `
        <div class="sp-auth-bar">
          <span>Logged in</span>
          <button class="sp-btn-secondary" id="spLogoutBtn" style="width:auto;padding:3px 8px;font-size:10px;background:rgba(255,51,102,0.1);color:#ff3366;border:1px solid rgba(255,51,102,0.2);border-radius:4px;cursor:pointer;">Logout</button>
        </div>
        <div class="sp-section">
          <div class="sp-label">Workflow Name</div>
          <input class="sp-input" id="spName" placeholder="e.g., Hotel Search" />
        </div>
        <div class="sp-section">
          <div class="sp-label">Backend URL</div>
          <input class="sp-input" id="spApiUrl" value="http://localhost:4000" />
        </div>
        <button class="sp-btn sp-btn-primary" id="spStartBtn">Start Recording</button>
        <div class="sp-status" id="spStatus"></div>
      `;
      body.querySelector("#spStartBtn").addEventListener("click", startRecording);
      body.querySelector("#spLogoutBtn").addEventListener("click", doLogout);
    } else {
      body.innerHTML = `
        <div class="sp-stats">
          <div class="sp-stat">
            <div class="sp-stat-val" id="spStepCount" style="color:#00d4ff">${steps.length}</div>
            <div class="sp-stat-label">Steps</div>
          </div>
          <div class="sp-stat">
            <div class="sp-stat-val" id="spExtractCount" style="color:#00ff88">${extractionTargets.length}</div>
            <div class="sp-stat-label">Extract</div>
          </div>
          <div class="sp-stat">
            <div class="sp-stat-val" style="color:#94a3b8;font-size:12px">${window.location.hostname}</div>
            <div class="sp-stat-label">Page</div>
          </div>
        </div>
        <div class="sp-divider"></div>
        <button class="sp-btn sp-btn-extract ${isExtractMode ? 'active' : ''}" id="spExtractBtn">
          ${isExtractMode ? '✓ Extraction Mode ON' : '◎ Enable Extraction Mode'}
        </button>
        ${extractionTargets.length > 0 ? `
          <div class="sp-extract-list" id="spExtractList">
            ${extractionTargets.map((t, i) => `
              <div class="sp-extract-item">
                <span>${t.fieldName || t.label || t.selector}</span>
                <span class="sp-remove" data-idx="${i}">×</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="sp-divider"></div>
        <div style="display:flex;gap:6px">
          <button class="sp-btn sp-btn-secondary" id="spStopBtn" style="flex:1">Stop & Save</button>
          <button class="sp-btn sp-btn-danger" id="spCancelBtn" style="flex:1">Discard</button>
        </div>
        <div class="sp-status" id="spStatus">${isExtractMode ? 'Click data fields to mark. Toggle off when done.' : 'Recording... perform your workflow.'}</div>
      `;
      body.querySelector("#spExtractBtn").addEventListener("click", toggleExtractMode);
      body.querySelector("#spStopBtn").addEventListener("click", stopRecording);
      body.querySelector("#spCancelBtn").addEventListener("click", cancelRecording);

      body.querySelectorAll(".sp-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          extractionTargets.splice(parseInt(btn.dataset.idx), 1);
          saveState();
          updatePanel();
        });
      });
    }
  }

  function updatePanel() {
    if (!panel || panel.style.display === "none") return;
    const badge = panel.querySelector("#spBadge");
    const badgeText = panel.querySelector("#spBadgeText");
    if (badge && badgeText) {
      badge.className = `sp-rec-badge ${isRecording ? 'active' : 'idle'}`;
      badgeText.textContent = isRecording ? 'Recording' : 'Idle';
    }
    const stepCount = panel.querySelector("#spStepCount");
    const extractCount = panel.querySelector("#spExtractCount");
    if (stepCount) stepCount.textContent = steps.length;
    if (extractCount) extractCount.textContent = extractionTargets.length;
    const extractBtn = panel.querySelector("#spExtractBtn");
    if (extractBtn) {
      extractBtn.className = `sp-btn sp-btn-extract ${isExtractMode ? 'active' : ''}`;
      extractBtn.textContent = isExtractMode ? '✓ Extraction Mode ON' : '◎ Enable Extraction Mode';
    }
    const status = panel.querySelector("#spStatus");
    if (status && isRecording) {
      status.textContent = isExtractMode
        ? 'Click data fields to mark. Toggle off when done.'
        : 'Recording... perform your workflow.';
    }
  }

  function setStatus(msg) {
    if (!panel) return;
    const status = panel.querySelector("#spStatus");
    if (status) status.textContent = msg;
  }

  function doLogin() {
    const email = panel.querySelector("#spEmail")?.value?.trim();
    const pass = panel.querySelector("#spPass")?.value;
    const apiUrl = panel.querySelector("#spApiUrl")?.value?.trim() || "http://localhost:4000";
    if (!email || !pass) { setStatus("Enter email and password"); return; }
    setStatus("Logging in...");
    fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          authToken = data.token;
          chrome.storage.local.set({ shamsu_auth_token: data.token, shamsu_api_url: apiUrl });
          renderPanelContent();
        } else {
          setStatus(data.error || "Login failed");
        }
      })
      .catch(err => setStatus("Error: " + err.message));
  }

  function doLogout() {
    authToken = null;
    chrome.storage.local.remove(["shamsu_auth_token"]);
    renderPanelContent();
  }

  function startRecording() {
    const nameInput = panel.querySelector("#spName");
    const apiUrlInput = panel.querySelector("#spApiUrl");
    const workflowName = nameInput?.value?.trim() || "Untitled Workflow";
    const apiUrl = apiUrlInput?.value?.trim() || "http://localhost:4000";

    chrome.storage.local.set({ shamsu_api_url: apiUrl, shamsu_workflow_name: workflowName });

    isRecording = true;
    isExtractMode = false;
    steps = [];
    extractionTargets = [];

    steps.push({
      actionType: "NAVIGATE",
      selector: "url",
      value: window.location.href,
      url: window.location.href,
      timestamp: Date.now(),
    });

    attachListeners();
    saveState();
    renderPanelContent();
    updatePanel();

    chrome.runtime.sendMessage({ type: "RECORDING_STARTED" });
  }

  function toggleExtractMode() {
    isExtractMode = !isExtractMode;
    updatePanel();
  }

  function stopRecording() {
    isRecording = false;
    isExtractMode = false;
    detachListeners();
    saveState();

    const apiUrl = "http://localhost:4000";
    chrome.storage.local.get(["shamsu_api_url", "shamsu_workflow_name"], (data) => {
      const url = data.shamsu_api_url || apiUrl;
      const name = data.shamsu_workflow_name || "Untitled Workflow";

      const headers = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const payload = { name, steps, extractionTargets };
      setStatus("Importing...");

      fetch(`${url}/api/workflows/import`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
        .then(r => r.json())
        .then(data => {
          if (data.workflow) {
            setStatus("Imported! Review in dashboard.");
            chrome.runtime.sendMessage({ type: "RECORDING_STOPPED" });
            setTimeout(() => {
              renderPanelContent();
              updatePanel();
            }, 2000);
          } else {
            setStatus(data.error || "Import failed");
            renderPanelContent();
            updatePanel();
          }
        })
        .catch(err => {
          setStatus("Error: " + err.message);
          renderPanelContent();
          updatePanel();
        });
    });
  }

  function cancelRecording() {
    isRecording = false;
    isExtractMode = false;
    steps = [];
    extractionTargets = [];
    detachListeners();
    chrome.storage.local.remove(["shamsu_recording", "shamsu_steps", "shamsu_extractions"]);
    renderPanelContent();
    updatePanel();
    chrome.runtime.sendMessage({ type: "RECORDING_STOPPED" });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PING") {
      sendResponse({ alive: true, isRecording });
      return true;
    }
    if (msg.type === "TOGGLE_PANEL") {
      togglePanel();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "RESTORE_RECORDING") {
      isRecording = true;
      steps = msg.steps || [];
      extractionTargets = msg.extractions || [];
      attachListeners();
      showPanel();
      sendResponse({ restored: true });
      return true;
    }
    if (msg.type === "STOP_FROM_BACKGROUND" || msg.type === "FORCE_STOP") {
      if (isRecording) {
        isRecording = false;
        isExtractMode = false;
        detachListeners();
        saveState();
        updatePanel();
        if (panel) {
          setStatus("Recording stopped.");
          setTimeout(() => renderPanelContent(), 1000);
        }
      }
      sendResponse({ stopped: true });
      return true;
    }
  });

  chrome.storage.local.get(["shamsu_recording", "shamsu_steps", "shamsu_extractions", "shamsu_auth_token"], (data) => {
    authToken = data.shamsu_auth_token || null;
    if (data.shamsu_recording) {
      isRecording = true;
      steps = data.shamsu_steps || [];
      extractionTargets = data.shamsu_extractions || [];
      attachListeners();
      createPanel();
      showPanel();
    } else {
      createPanel();
    }
  });
})();
