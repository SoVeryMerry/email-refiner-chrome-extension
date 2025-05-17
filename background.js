// Background script for Email Refiner extension
let currentComposingText = "";

// Wait for the extension to be fully loaded before creating context menu
chrome.runtime.onInstalled.addListener(() => {
  console.log("Email Refiner extension installed, setting up context menu");
  
  // Remove existing menu items to avoid duplicates
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "refineSelectedText",
        title: "Refine Selected Text with Email Refiner",
        contexts: ["selection"] // Only show when text is selected
      });
    });
    console.log("Context menu created");
  } else {
    console.error("Context menus API not available");
  }
});

// Handle context menu clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "refineSelectedText" && info.selectionText) {
      console.log("Context menu clicked, selected text:", info.selectionText.substring(0, 50) + "...");
      
      // First, store the selected text
      currentComposingText = info.selectionText;
      
      // Then open the popup
      if (chrome.action) {
        chrome.action.openPopup();
      } else {
        console.error("Chrome action API not available");
      }
    }
  });
}

// Handle messages between content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request.action);
  
  if (request.action === "updateComposingText" && request.text) {
    // Store the text from the content script
    currentComposingText = request.text;
    console.log("Updated composing text (length):", currentComposingText.length);
    sendResponse({ status: "success" });
    return true; // Indicate we sent a response
  } 
  else if (request.action === "getComposingText") {
    // Return the stored text to the popup
    console.log("Sending composing text to popup (length):", currentComposingText.length);
    sendResponse({ text: currentComposingText });
    return true; // Indicate we sent a response
  }
  else if (request.action === "clearComposingText") {
    // Clear the stored text (useful after refinement is complete)
    currentComposingText = "";
    console.log("Cleared composing text");
    sendResponse({ status: "success" });
    return true; // Indicate we sent a response
  }
});