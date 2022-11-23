var bootstraped = false;

function bootstrap() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    activeTabId = tabs[0].id

    chrome.tabs.insertCSS(activeTabId, {file: "src/style.css"});
    chrome.tabs.executeScript(activeTabId, {file: "src/typo.js"});
    chrome.tabs.executeScript(activeTabId, {file: "src/spell.js"});
    bootstraped = true;
  });
}

chrome.runtime.onMessage.addListener(bootstrap);
