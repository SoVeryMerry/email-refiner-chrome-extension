// Content script for Email Refiner extension
console.log("Email Refiner content script loaded");

// Initialize a variable to track the currently focused compose area
let currentComposeArea = null;

// Function to find Gmail compose windows and attach listeners
function setupGmailListeners() {
  console.log("Setting up Gmail listeners");
  
  // Observer to watch for new elements (like when a compose window opens)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Check for new compose areas
        const composeAreas = document.querySelectorAll('[role="textbox"][g_editable="true"]');
        composeAreas.forEach(composeArea => {
          if (!composeArea.dataset.refinedTracked) {
            console.log("Found new compose area, attaching listeners");
            attachComposeListener(composeArea);
          }
        });
      }
    });
  });
  
  // Start observing the document body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check for any existing compose areas
  const composeAreas = document.querySelectorAll('[role="textbox"][g_editable="true"]');
  composeAreas.forEach(composeArea => {
    console.log("Found existing compose area, attaching listeners");
    attachComposeListener(composeArea);
  });
}

// Function to attach event listeners to a compose area
function attachComposeListener(composeArea) {
  // Mark this element as tracked to avoid attaching listeners multiple times
  composeArea.dataset.refinedTracked = "true";
  
  // Add focus listener to track which compose area is currently active
  composeArea.addEventListener('focus', () => {
    console.log("Compose area focused");
    currentComposeArea = composeArea;
    
    // Send the current text to the background script
    const composingText = composeArea.innerText || "";
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "updateComposingText",
        text: composingText
      });
    } else {
      console.error("Chrome runtime messaging API not available");
    }
  });
  
  // Add input listener to keep track of text changes
  composeArea.addEventListener('input', () => {
    if (composeArea === currentComposeArea) {
      console.log("Text changed in compose area");
      const composingText = composeArea.innerText || "";
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: "updateComposingText",
          text: composingText
        });
      } else {
        console.error("Chrome runtime messaging API not available");
      }
    }
  });
}

// Initialize when the page has fully loaded
window.addEventListener('load', () => {
  console.log("Page loaded, initializing Email Refiner content script");
  setupGmailListeners();
});

// Listen for messages from popup or background script
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request.action);
    
    if (request.action === "insertRefinedText") {
      console.log("Attempting to insert refined text into compose area");
      
      if (currentComposeArea) {
        // Insert the refined text into the current compose area
        currentComposeArea.innerText = request.text;
        
        // Try to trigger a change event to ensure Gmail recognizes the change
        const event = new Event('input', { bubbles: true });
        currentComposeArea.dispatchEvent(event);
        
        console.log("Text successfully inserted");
        sendResponse({ success: true });
      } else {
        // Try to find a compose area if none is currently tracked
        const composeAreas = document.querySelectorAll('[role="textbox"][g_editable="true"]');
        if (composeAreas.length > 0) {
          // Use the first available compose area
          currentComposeArea = composeAreas[0];
          
          // Insert the refined text
          currentComposeArea.innerText = request.text;
          
          // Trigger a change event
          const event = new Event('input', { bubbles: true });
          currentComposeArea.dispatchEvent(event);
          
          console.log("Text inserted into found compose area");
          sendResponse({ success: true });
        } else {
          console.error("No compose area found to insert text");
          sendResponse({ success: false, error: "No compose area found" });
        }
      }
    }
    
    return true; // Keep the message channel open for async response
  });
} else {
  console.error("Chrome runtime messaging API not available in content script");
}