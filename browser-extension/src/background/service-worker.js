chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(() => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/content-script.js"],
    }).then(() => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(() => {});
      }, 300);
    }).catch(() => {});
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  chrome.storage.local.get(["shamsu_recording", "shamsu_steps", "shamsu_extractions"], (data) => {
    if (!data.shamsu_recording) return;

    chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content-script.js"],
    }).then(() => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          type: "RESTORE_RECORDING",
          steps: data.shamsu_steps || [],
          extractions: data.shamsu_extractions || [],
        }).catch(() => {});
      }, 300);
    }).catch(() => {});
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RECORDING_STARTED") {
    chrome.storage.local.set({ shamsu_recording: true });
    if (sender.tab?.id) {
      chrome.action.setBadgeText({ text: "REC", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#ff3366", tabId: sender.tab.id });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "RECORDING_STOPPED") {
    chrome.storage.local.remove(["shamsu_recording", "shamsu_steps", "shamsu_extractions"]);
    
    // Clear badge on ALL tabs and send STOP to all content scripts
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.action.setBadgeText({ text: "", tabId: tab.id });
          // Send stop message to all tabs with our content script
          chrome.tabs.sendMessage(tab.id, { type: "FORCE_STOP" }).catch(() => {});
        }
      }
    });
    
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "GET_STATUS") {
    chrome.storage.local.get(["shamsu_recording", "shamsu_steps"], (data) => {
      sendResponse({
        isRecording: !!data.shamsu_recording,
        stepCount: (data.shamsu_steps || []).length,
      });
    });
    return true;
  }
});
