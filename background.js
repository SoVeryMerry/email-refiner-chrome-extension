// Background script for Email Refiner extension
let currentComposingText = "";

// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menu items to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "refineSelectedText",
      title: "Refine Selected Text with Email Refiner",
      contexts: ["selection"] // Only show when text is selected
    });
  });
  
  console.log("Email Refiner extension installed, context menu created");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "refineSelectedText" && info.selectionText) {
    console.log("Context menu clicked, selected text:", info.selectionText.substring(0, 50) + "...");
    
    // First, store the selected text
    currentComposingText = info.selectionText;
    
    // Then open the popup
    chrome.action.openPopup();
    
    // No need to send message here, the popup will request the text when it opens
  }
});

// Handle messages between content script, popup, and other extension components
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
  // For messages that need to be forwarded to content scripts or popup
  else if (request.action === "pasteIntoGmail" && request.text) {
    // This will be handled directly by the popup script sending to the content script
    // but we could add additional logic here if needed
    console.log("Background received paste request for forwarding");
    sendResponse({ status: "forwarding" });
    return true; // Indicate we sent a response
  }
});