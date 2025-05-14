// Content script for Email Refiner extension
// This script needs to run in all frames and access Gmail's compose area

console.log("Email Refiner content script loading...");

// Store the compose area when found
let composingTextArea = null;
let lastFoundText = "";
let observer = null;

// Gmail's DOM structure is complex - these are the possible selectors for compose box
const GMAIL_COMPOSE_SELECTORS = [
  // Main selectors
  'div[role="textbox"][g_editable="true"]',
  'div[role="textbox"][contenteditable="true"]',
  'div[aria-label="Message Body"][contenteditable="true"]',
  'div[aria-label="Message body"][contenteditable="true"]',
  // Less specific but still potentially valid
  '.Am.Al.editable[contenteditable="true"]',
  '.Ak.aXjCH div[role="textbox"]'
];

// Broader fallback selectors
const FALLBACK_SELECTORS = [
  'div[contenteditable="true"]',
  'div[g_editable="true"]'
];

// Find all iframes in the page
function getAllIframes() {
  try {
    const frames = Array.from(document.querySelectorAll('iframe'));
    console.log(`Found ${frames.length} iframes in the page`);
    return frames;
  } catch (error) {
    console.error("Error finding iframes:", error);
    return [];
  }
}

// Try to find compose area in the given context (document or iframe)
function findComposeAreaInContext(context) {
  if (!context || !context.querySelectorAll) {
    console.log("Invalid context for finding compose area");
    return null;
  }
  
  // First try with specific Gmail selectors
  for (const selector of GMAIL_COMPOSE_SELECTORS) {
    try {
      const elements = context.querySelectorAll(selector);
      for (const el of elements) {
        if (isVisibleElement(el)) {
          console.log(`Found compose area with selector: ${selector}`, el);
          return el;
        }
      }
    } catch (error) {
      console.error(`Error with selector ${selector}:`, error);
    }
  }
  
  // If not found, try fallback selectors
  for (const selector of FALLBACK_SELECTORS) {
    try {
      const elements = context.querySelectorAll(selector);
      for (const el of elements) {
        // Additional check that it's likely an email compose box (has some reasonable size)
        if (isVisibleElement(el) && isLikelyComposeArea(el)) {
          console.log(`Found potential compose area with fallback selector: ${selector}`, el);
          return el;
        }
      }
    } catch (error) {
      console.error(`Error with fallback selector ${selector}:`, error);
    }
  }
  
  return null;
}

// Check if element is visible
function isVisibleElement(el) {
  return el && 
    el.offsetParent !== null && 
    el.offsetHeight > 10 && // Must have some reasonable size
    el.offsetWidth > 10 &&
    window.getComputedStyle(el).display !== 'none' &&
    window.getComputedStyle(el).visibility !== 'hidden';
}

// Additional check for compose area (size, position, etc.)
function isLikelyComposeArea(el) {
  // Check dimensions - email compose areas are usually decently sized
  if (el.offsetHeight < 50 || el.offsetWidth < 100) {
    return false;
  }
  
  // Check if it's positioned in a reasonable area
  const rect = el.getBoundingClientRect();
  if (rect.top < 0 || rect.left < 0) {
    return false;
  }
  
  // Check if it has text content or placeholder (most compose areas do)
  const text = el.textContent || el.innerText || "";
  const placeholders = ["Write", "Type", "Compose", "Message", "Body", "Reply"];
  
  if (text.length > 0) {
    return true;
  }
  
  // Check attributes for hints it's a compose area
  for (const attr of ["aria-label", "placeholder", "data-tooltip"]) {
    const value = el.getAttribute(attr) || "";
    if (placeholders.some(p => value.includes(p))) {
      return true;
    }
  }
  
  // Look at parent elements for compose area indicators
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    const parentClasses = parent.className || "";
    if (parentClasses.includes("compose") || 
        parentClasses.includes("editable") ||
        parentClasses.includes("email")) {
      return true;
    }
    parent = parent.parentElement;
    depth++;
  }
  
  return false;
}

// Find compose area in all contexts (main document and all accessible iframes)
function findComposeArea() {
  // Try main document first
  composingTextArea = findComposeAreaInContext(document);
  if (composingTextArea) {
    return composingTextArea;
  }
  
  // Try all iframes if not found in main document
  const iframes = getAllIframes();
  for (const iframe of iframes) {
    try {
      // Only try iframes we can access (same-origin policy)
      if (iframe.contentDocument) {
        composingTextArea = findComposeAreaInContext(iframe.contentDocument);
        if (composingTextArea) {
          return composingTextArea;
        }
      }
    } catch (error) {
      // This is expected for cross-origin iframes
      console.log("Cannot access iframe content (likely cross-origin)");
    }
  }
  
  console.log("No compose area found in any context");
  return null;
}

// Get text from compose area
function getComposeText() {
  if (!composingTextArea) {
    composingTextArea = findComposeArea();
  }
  
  if (!composingTextArea) {
    console.log("No compose area found for getting text");
    return "";
  }
  
  // Get text content from the compose area
  return composingTextArea.textContent || composingTextArea.innerText || "";
}

// Set text in compose area
function setComposeText(text) {
  if (!composingTextArea) {
    composingTextArea = findComposeArea();
  }
  
  if (!composingTextArea) {
    console.error("No compose area found for setting text");
    return false;
  }
  
  try {
    // Store the current selection/cursor position
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Set content and preserve formatting
    composingTextArea.innerHTML = text;
    
    // Focus the element
    composingTextArea.focus();
    
    // Dispatch events to notify Gmail that content changed
    const inputEvent = new Event('input', { bubbles: true });
    composingTextArea.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true });
    composingTextArea.dispatchEvent(changeEvent);
    
    // Simulate keypress events to trigger Gmail's internal handlers
    const keypressEvent = new Event('keypress', { bubbles: true });
    composingTextArea.dispatchEvent(keypressEvent);
    
    // Backup approach: try executing paste command
    document.execCommand('insertText', false, text);
    
    console.log("Successfully set compose text");
    return true;
  } catch (error) {
    console.error("Error setting compose text:", error);
    
    // Fallback approach
    try {
      composingTextArea.textContent = text;
      console.log("Used fallback approach to set text");
      return true;
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
      return false;
    }
  }
}

// Set up observers to detect changes and find compose area
function setupObservers() {
  // Clear any existing observers
  if (observer) {
    observer.disconnect();
  }
  
  // Create mutation observer for document
  observer = new MutationObserver((mutations) => {
    // Check if we need to find compose area
    if (!composingTextArea || !document.body.contains(composingTextArea)) {
      composingTextArea = findComposeArea();
    }
    
    // If found, check for text changes
    if (composingTextArea) {
      const currentText = getComposeText();
      if (currentText && currentText !== lastFoundText) {
        lastFoundText = currentText;
        // Send to background script
        chrome.runtime.sendMessage({
          action: "updateComposingText",
          text: currentText
        }, response => {
          if (chrome.runtime.lastError) {
            console.error("Error sending text update:", chrome.runtime.lastError);
          }
        });
      }
    }
  });
  
  // Observe document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
  
  // Also try to find compose area immediately
  setTimeout(() => {
    composingTextArea = findComposeArea();
    if (composingTextArea) {
      const initialText = getComposeText();
      if (initialText) {
        lastFoundText = initialText;
        chrome.runtime.sendMessage({
          action: "updateComposingText",
          text: initialText
        });
      }
    }
  }, 1000);
}

// Handle messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request.action);
  
  if (request.action === "getComposingText") {
    // Make sure we have the latest text
    const text = getComposeText();
    console.log("Sending compose text (length):", text.length);
    sendResponse({ text: text });
    return true;
  }
  else if (request.action === "pasteRefinedText") {
    const success = setComposeText(request.refinedText);
    if (success) {
      sendResponse({ success: true });
    } else {
      sendResponse({ 
        success: false, 
        error: "Could not paste text into Gmail. Try copying and pasting manually." 
      });
    }
    return true;
  }
  else if (request.action === "findComposeArea") {
    // Force a new search for the compose area
    composingTextArea = findComposeArea();
    const found = !!composingTextArea;
    sendResponse({ 
      found: found,
      text: found ? getComposeText() : ""
    });
    return true;
  }
});

// Initialize when content script loads
function initialize() {
  console.log("Initializing Email Refiner content script");
  
  // Set up observers to detect Gmail compose areas
  setupObservers();
  
  // Check periodically for new compose areas
  setInterval(() => {
    if (!composingTextArea || !document.body.contains(composingTextArea)) {
      console.log("Periodic check for compose areas...");
      composingTextArea = findComposeArea();
      
      if (composingTextArea) {
        const currentText = getComposeText();
        if (currentText && currentText !== lastFoundText) {
          lastFoundText = currentText;
          chrome.runtime.sendMessage({
            action: "updateComposingText",
            text: currentText
          });
        }
      }
    }
  }, 3000);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

console.log("Email Refiner content script loaded successfully");