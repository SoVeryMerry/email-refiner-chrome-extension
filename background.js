let currentComposingText = "";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "refineSelectedText",
    title: "Refine Selected Text",
    contexts: ["selection"] // Only show when text is selected
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "refineSelectedText" && info.selectionText) {
    // Send the selected text to the popup for processing
    chrome.runtime.sendMessage({ action: "refineText", selectedText: info.selectionText });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateComposingText" && request.text) {
    currentComposingText = request.text;
  } else if (request.action === "getComposingText") {
    sendResponse({ text: currentComposingText });
  }
});