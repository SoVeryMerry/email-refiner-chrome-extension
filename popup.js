document.addEventListener('DOMContentLoaded', () => {
  const refineButton = document.getElementById('refineButton');
  const originalEmailInput = document.getElementById('originalEmail');
  const refinedTextDiv = document.getElementById('refinedText');
  const refinedOutputParagraph = document.getElementById('refinedOutput');
  const copyButton = document.getElementById('copyButton');
  const pasteToGmailButton = document.getElementById('pasteToGmailButton');
  
  // Storage key for API key
  const API_KEY_STORAGE_KEY = 'openai_api_key';
  let apiKey = '';
  
  // Try to load the API key from storage
  chrome.storage.local.get([API_KEY_STORAGE_KEY], (result) => {
    if (result[API_KEY_STORAGE_KEY]) {
      apiKey = result[API_KEY_STORAGE_KEY];
      showApiKeyStatus(true);
    } else {
      showApiKeyStatus(false);
    }
  });
  
  // Add API key input element
  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.id = 'apiKeyInput';
  apiKeyInput.placeholder = 'Enter your OpenAI API key';
  apiKeyInput.style.width = '100%';
  apiKeyInput.style.marginBottom = '10px';
  
  const saveApiKeyButton = document.createElement('button');
  saveApiKeyButton.textContent = 'Save API Key';
  saveApiKeyButton.style.marginBottom = '10px';
  
  const apiKeyStatus = document.createElement('div');
  apiKeyStatus.id = 'apiKeyStatus';
  apiKeyStatus.style.marginBottom = '10px';
  
  // Insert elements after the h2 title
  const title = document.querySelector('h2');
  title.parentNode.insertBefore(apiKeyStatus, title.nextSibling);
  title.parentNode.insertBefore(saveApiKeyButton, apiKeyStatus);
  title.parentNode.insertBefore(apiKeyInput, saveApiKeyButton);
  
  function showApiKeyStatus(isSet) {
    apiKeyStatus.textContent = isSet ? 
      'API key is set ✓' : 
      'Please enter your OpenAI API key';
    apiKeyStatus.style.color = isSet ? 'green' : 'red';
  }
  
  function showStatusMessage(message, isError = false) {
    const statusDiv = document.createElement('div');
    statusDiv.className = isError ? 'status error' : 'status success';
    statusDiv.textContent = message;
    
    // Insert after the refine button
    refineButton.parentNode.insertBefore(statusDiv, refineButton.nextSibling);
    
    // Remove after 5 seconds
    setTimeout(() => {
      statusDiv.remove();
    }, 5000);
  }
  
  saveApiKeyButton.addEventListener('click', () => {
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey) {
      chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: newApiKey }, () => {
        apiKey = newApiKey;
        apiKeyInput.value = '';
        showApiKeyStatus(true);
        showStatusMessage('API key saved successfully');
      });
    } else {
      showStatusMessage('Please enter a valid API key', true);
    }
  });

  const getComposingText = async () => {
    console.log("Popup requesting composing text from background");
    
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: "getComposingText" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error getting composing text:", chrome.runtime.lastError);
            resolve("");
            return;
          }
          
          console.log("Received composing text response:", response ? "yes" : "no");
          resolve(response && response.text ? response.text : "");
        });
      } catch (error) {
        console.error("Exception getting composing text:", error);
        resolve("");
      }
    });
  };

  // Function to paste text directly into Gmail
  const pasteToGmail = async (text) => {
    console.log("Attempting to paste text to Gmail");
    
    try {
      // Query the current active tab to ensure we're targeting Gmail
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        throw new Error("No active tab found");
      }
      
      const activeTab = tabs[0];
      if (!activeTab.url || !activeTab.url.includes('mail.google.com')) {
        throw new Error("Active tab is not Gmail");
      }
      
      // Send message to content script to paste the text
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTab.id, { 
          action: "pasteIntoGmail", 
          text: text 
        }, (result) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending paste message:", chrome.runtime.lastError);
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(result || { success: false, error: "No response from content script" });
        });
      });
      
      return response;
    } catch (error) {
      console.error("Error in pasteToGmail:", error);
      return { success: false, error: error.message };
    }
  };

  const refineText = async (textToRefine) => {
    if (!textToRefine.trim()) {
      refinedOutputParagraph.textContent = "Please enter or type some text to refine.";
      refinedTextDiv.style.display = 'block';
      return;
    }

    if (!apiKey) {
      refinedOutputParagraph.textContent = "Please set your OpenAI API key first.";
      refinedTextDiv.style.display = 'block';
      return;
    }

    refinedOutputParagraph.textContent = "Refining...";
    refinedTextDiv.style.display = 'block';

    try {
      // Using the current OpenAI API format (chat completions)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a professional email editor. Improve the text for clarity, tone, and grammar, making it suitable for professional communication."
            },
            {
              role: "user",
              content: textToRefine
            }
          ],
          max_tokens: 500
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.status}`);
      }

      const data = await response.json();
      if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
        const refinedText = data.choices[0].message.content.trim();
        refinedOutputParagraph.textContent = refinedText;
      } else {
        refinedOutputParagraph.textContent = "Could not retrieve refined text.";
      }

    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      refinedOutputParagraph.textContent = `Error: ${error.message || "Failed to refine text"}`;
    }
  };

  // Auto-populate the textarea when popup opens
  window.addEventListener('load', async () => {
    console.log("Popup loaded, attempting to get composing text");
    try {
      const composingText = await getComposingText();
      if (composingText) {
        console.log("Found composing text, setting in textarea");
        originalEmailInput.value = composingText;
      } else {
        console.log("No composing text found");
      }
    } catch (error) {
      console.error("Error auto-populating textarea:", error);
    }
  });

  refineButton.addEventListener('click', async () => {
    console.log("Refine button clicked");
    
    // First check for text in the textarea
    if (originalEmailInput.value.trim()) {
      refineText(originalEmailInput.value);
      return;
    }
    
    // If no text in the textarea, try to get it from the background script
    const composingText = await getComposingText();
    if (composingText) {
      originalEmailInput.value = composingText;
      refineText(composingText);
    } else {
      refinedOutputParagraph.textContent = "Please start typing in Gmail or paste your email.";
      refinedTextDiv.style.display = 'block';
    }
  });

  // Copy refined text to clipboard
  copyButton.addEventListener('click', () => {
    const refinedText = refinedOutputParagraph.textContent;
    if (refinedText) {
      navigator.clipboard.writeText(refinedText)
        .then(() => {
          showStatusMessage('Copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          showStatusMessage('Failed to copy text', true);
        });
    }
  });
  
  // Handle paste to Gmail button click
  pasteToGmailButton.addEventListener('click', async () => {
    const refinedText = refinedOutputParagraph.textContent;
    if (!refinedText) {
      showStatusMessage('No refined text to paste', true);
      return;
    }
    
    const result = await pasteToGmail(refinedText);
    if (result.success) {
      showStatusMessage('Successfully pasted to Gmail!');
    } else {
      console.error("Failed to paste to Gmail:", result.error);
      showStatusMessage(`Failed to paste: ${result.error || "Unknown error"}`, true);
    }
  });
  
  // Listen for messages from the background script (for selected text refinement)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Popup received message:", request.action);
    
    if (request.action === "refineText" && request.selectedText) {
      // Set the text in the textarea
      originalEmailInput.value = request.selectedText;
      // Refine the text
      refineText(request.selectedText);
    }
    
    return true; // Indicate that we might send a response asynchronously
  });
});