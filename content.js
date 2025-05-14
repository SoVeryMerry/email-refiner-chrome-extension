let composingTextArea = null;
let observer = null;

function findComposingTextArea() {
  // More robust selectors for Gmail's compose area
  const possibleSelectors = [
    'div[role="textbox"][contenteditable="true"]', // Common Gmail composer
    'div[aria-label="Message Body"][contenteditable="true"]', // Another possible selector
    'div.Am.Al.editable[contenteditable="true"]' // Older Gmail layout
  ];
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    
    for (const el of elements) {
      // Check if element is visible and in the compose area
      if (el.offsetParent !== null && 
          el.offsetHeight > 0 && 
          el.offsetWidth > 0 &&
          isInComposeArea(el)) {
        console.log("Found composing text area:", el);
        return el;
      }
    }
  }
  
  console.log("No composing text area found");
  return null;
}

function isInComposeArea(element) {
  // Check if the element is within a compose dialog or area
  let parent = element.parentElement;
  let depth = 0;
  const maxDepth = 10; // Avoid infinite loops
  
  while (parent && depth < maxDepth) {
    // Look for common compose area containers
    if (parent.classList.contains('AD') || // Compose dialog
        parent.getAttribute('role') === 'dialog' ||
        parent.classList.contains('Am')) { // Message container
      return true;
    }
    parent = parent.parentElement;
    depth++;
  }
  
  return false;
}

function handleInputChange() {
  if (composingTextArea) {
    const currentText = composingTextArea.textContent || composingTextArea.innerText;
    
    // Only send non-empty text
    if (currentText && currentText.trim()) {
      console.log("Current composing text:", currentText);
      chrome.runtime.sendMessage({ 
        action: "updateComposingText", 
        text: currentText 
      });
    }
  }
}

function setupListeners() {
  // First, try to find the textarea on initial load
  composingTextArea = findComposingTextArea();
  if (composingTextArea) {
    console.log("Found composing text area on initial load");
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
    // Only look for the text area if we haven't found it yet
    if (!composingTextArea || !document.contains(composingTextArea)) {
      composingTextArea = findComposingTextArea();
      if (composingTextArea) {
        console.log("Found composing text area after DOM change");
        composingTextArea.addEventListener('input', handleInputChange);
        // Capture initial text if any
        handleInputChange();
      }
    }
  });
  
  // Observe changes to the entire document
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'] // Watch for style/class changes that might reveal compose areas
  });
}

// Run the setup when the content script is injected
console.log("Email Refiner content script loaded");
setTimeout(setupListeners, 1000); // Give Gmail a moment to initialize

// Periodically check for new compose windows (Gmail is very dynamic)
setInterval(() => {
  if (!composingTextArea || !document.contains(composingTextArea)) {
    console.log("Checking for new compose windows...");
    setupListeners();
  }
}, 5000);

// Handle messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getComposingText") {
    // Re-find the textarea if needed
    if (!composingTextArea || !document.contains(composingTextArea)) {
      composingTextArea = findComposingTextArea();
    }
    
    const text = composingTextArea ? 
      (composingTextArea.textContent || composingTextArea.innerText) : "";
    
    console.log("Sending composing text:", text);
    sendResponse({ text: text });
    return true; // Indicate we'll send a response asynchronously
  }
});