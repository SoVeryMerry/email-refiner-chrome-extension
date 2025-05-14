let composingTextArea = null;

function findComposingTextArea() {
  // Gmail's DOM structure can be complex and change.
  // You might need to inspect the Gmail compose window's elements
  // to find a reliable selector for the main composing textarea.
  // Common attributes to look for might include role="textbox",
  // contenteditable="true", specific classes, or IDs.

  // This is a simplified example and might need adjustments based on Gmail's current structure.
  const textAreas = document.querySelectorAll('div[role="textbox"][contenteditable="true"]');

  // Try to find the one that is currently focused or visible within a compose window
  for (const ta of textAreas) {
    if (ta.offsetParent !== null && ta.offsetHeight > 0 && ta.offsetWidth > 0) {
      return ta;
    }
  }
  return null;
}

function handleInputChange() {
  if (composingTextArea) {
    const currentText = composingTextArea.textContent;
    // You can now send this text to your popup or background script
    // for processing when the user clicks the "Refine" button.
    // For example, you could store it in a variable or send a message.
    console.log("Current composing text:", currentText);

    // You might want to store this text in a way that the popup can access it.
    // One way is to send a message to the background script,
    // which can then store it or pass it to the popup when it opens.
    chrome.runtime.sendMessage({ action: "updateComposingText", text: currentText });
  }
}

function setupListeners() {
  // Observe changes to the DOM to detect when a new compose window appears
  const observer = new MutationObserver((mutationsList, observer) => {
    composingTextArea = findComposingTextArea();
    if (composingTextArea) {
      composingTextArea.addEventListener('input', handleInputChange);
      observer.disconnect(); // Stop observing once we find the textarea
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also try to find the textarea on initial load
  composingTextArea = findComposingTextArea();
  if (composingTextArea) {
    composingTextArea.addEventListener('input', handleInputChange);
  }
}

// Run the setup when the content script is injected
setupListeners();

// Handle messages from the popup (e.g., to request the current text)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getComposingText") {
    sendResponse({ text: composingTextArea ? composingTextArea.textContent : "" });
  }
});