// Improved content script for Email Refiner extension
let composingTextArea = null;
let observer = null;

function findComposingTextArea() {
  // Updated selectors for Gmail's compose area with more specific targeting
  const possibleSelectors = [
    // Common Gmail composer selectors
    'div[role="textbox"][g_editable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="Message Body"][contenteditable="true"]',
    'div[aria-label*="message body"][contenteditable="true"]',
    'div.Am.Al.editable[contenteditable="true"]',
    // Try to locate specific Gmail compose box elements
    '.Ar.Au div[contenteditable="true"]',
    '.Am.Al.editable',
    '.Ak.aXjCH div[role="textbox"]'
  ];
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`Checking selector: ${selector}, found ${elements.length} elements`);
    
    for (const el of elements) {
      // Check if element is visible and active in the DOM
      if (el.offsetParent !== null && 
          el.offsetHeight > 0 && 
          el.offsetWidth > 0) {
        console.log("Found composing text area:", el);
        return el;
      }
    }
  }
  
  // If still not found, try a broader approach
  const allEditables = document.querySelectorAll('[contenteditable="true"]');
  for (const el of allEditables) {
    if (el.offsetParent !== null && 
        el.offsetHeight > 0 && 
        el.offsetWidth > 0 &&
        (el.innerText || el.textContent)) {
      console.log("Found editable area using broader approach:", el);
      return el;
    }
  }
  
  console.log("No composing text area found");
  return null;
}

function handleInputChange() {
  if (composingTextArea) {
    const currentText = composingTextArea.textContent || composingTextArea.innerText;
    
    // Only send non-empty text
    if (currentText && currentText.trim()) {
      console.log("Current composing text detected:", currentText.substring(0, 50) + (currentText.length > 50 ? "..." : ""));
      
      // Send to background script with error handling
      try {
        chrome.runtime.sendMessage({ 
          action: "updateComposingText", 
          text: currentText 
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error sending message:", chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        console.error("Failed to send message to background script:", error);
      }
    }
  }
}

function setupListeners() {
  // First, try to find the textarea on initial load
  composingTextArea = findComposingTextArea();
  if (composingTextArea) {
    console.log("Found composing text area on initial load");
    // Remove any existing listeners to prevent duplicates
    composingTextArea.removeEventListener('input', handleInputChange);
    composingTextArea.addEventListener('input', handleInputChange);
    // Capture initial text if any
    handleInputChange();
  }
  
  // Disconnect any existing observer
  if (observer) {
    observer.disconnect();
  }
  
  // Set up mutation observer to detect when compose window appears
  observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    for (const mutation of mutations) {
      // Check if relevant DOM changes occurred
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      } else if (mutation.type === 'attributes' && 
                 (mutation.attributeName === 'style' || 
                  mutation.attributeName === 'class')) {
        shouldCheck = true;
        break;
      }
    }
    
    if (shouldCheck) {
      // Only look for the text area if we haven't found it yet or it's no longer valid
      if (!composingTextArea || !document.contains(composingTextArea)) {
        composingTextArea = findComposingTextArea();
        if (composingTextArea) {
          console.log("Found composing text area after DOM change");
          // Remove any existing listeners to prevent duplicates
          composingTextArea.removeEventListener('input', handleInputChange);
          composingTextArea.addEventListener('input', handleInputChange);
          // Capture initial text if any
          handleInputChange();
        }
      }
    }
  });
  
  // Observe changes to the entire document
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'aria-label', 'role'] // Watch for relevant attribute changes
  });
}

// Direct document ready check
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("Email Refiner content script loaded on DOMContentLoaded");
    setupListeners();
  });
} else {
  console.log("Email Refiner content script loaded (document already ready)");
  setupListeners();
}

// Run the setup when the content script is injected
// Small delay to let Gmail initialize first
setTimeout(() => {
  console.log("Running initial setup after timeout");
  setupListeners();
}, 2000);

// Periodically check for new compose windows (Gmail is very dynamic)
setInterval(() => {
  if (!composingTextArea || !document.contains(composingTextArea)) {
    console.log("Periodic check for new compose windows...");
    setupListeners();
  }
}, 5000);

// Handle messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action);
  
  if (request.action === "getComposingText") {
    try {
      // Re-find the textarea if needed
      if (!composingTextArea || !document.contains(composingTextArea)) {
        composingTextArea = findComposingTextArea();
      }
      
      const text = composingTextArea ? 
        (composingTextArea.textContent || composingTextArea.innerText) : "";
      
      console.log("Sending composing text (length):", text.length);
      sendResponse({ text: text });
    } catch (error) {
      console.error("Error in getComposingText handler:", error);
      sendResponse({ text: "", error: error.message });
    }
    return true; // Indicate we'll send a response asynchronously
  }
});