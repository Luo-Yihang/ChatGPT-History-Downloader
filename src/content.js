(() => {
  const SCRIPT_VERSION = "2025.10.14-04";
  if (window.__chatgptDownloaderInjected) {
    return;
  }
  window.__chatgptDownloaderInjected = true;
  window.__chatgptDownloaderVersion = SCRIPT_VERSION;
  console.info(`[ChatGPT Downloader] Content script v${SCRIPT_VERSION} loaded`);

  const MESSAGE_BUTTON_CLASS = "chatgpt-message-download-button";
  const CONVERSATION_BUTTON_CLASS = "chatgpt-conversation-download-button";
  const MESSAGE_WRAPPER_ATTRIBUTE = "data-chatgpt-download-index";
  const COPY_BUTTON_SELECTOR = 'button[data-testid="copy-turn-action-button"]';
  const processedCopyButtons = new WeakSet();
  const boundMessages = new WeakSet();
  let lastCopyButtonCount = 0;
  const debugLog = (...args) => {
    if (!window.__chatgptDownloaderDebug) {
      return;
    }
    console.log("[ChatGPT Downloader]", ...args);
  };

  const MESSAGE_SELECTORS = [
    "[data-message-author-role]",
    "[data-message-id]",
    "article[data-testid*='conversation-turn']",
    "[data-testid*='conversation-turn']",
    ".group.text-token-text-primary",
    "[class*='group'][class*='text-token']",
    "article",
    "[class*='group']"
  ];
  const MESSAGE_NODE_SELECTOR = "[data-message-author-role], [data-message-id]";

  const CONTENT_SELECTORS = [
    "[class*='whitespace-pre-wrap']",
    "[class*='prose']",
    "[class*='markdown']",
    ".markdown",
    "[class*='text-base']",
    "[data-testid*='content']",
    "p",
    "div"
  ];

  const FILE_SELECTORS = [
    "a[download]",
    "a[href*='blob:']",
    "div[class*='text-token-text-primary'] a",
    "div[class*='border-token-border'] a"
  ];

  let turndownServiceInstance = null;

  function getTurndownService() {
    if (typeof TurndownService === "undefined") {
      throw new Error("TurndownService is not available in this context");
    }

    if (!turndownServiceInstance) {
      const service = new TurndownService({
        headingStyle: "atx",
        hr: "---",
        bulletListMarker: "*",
        codeBlockStyle: "fenced",
        fence: "```",
        emDelimiter: "*",
        strongDelimiter: "**",
        br: "\n"
      });

      if (typeof turndownPluginGfm !== "undefined" && turndownPluginGfm.gfm) {
        service.use(turndownPluginGfm.gfm);
      }

      service.addRule("chatgptListItem", {
        filter: "li",
        replacement: function (content, node, options) {
          const parent = node.parentNode;
          const lines = content
            .replace(/^\n+/, "")
            .replace(/\n+$/, "")
            .split("\n")
            .map((line, index) => (index === 0 ? line : `  ${line}`));

          const body = lines.join("\n");

          let prefix = `${options.bulletListMarker} `;
          if (parent && parent.nodeName === "OL") {
            const start = parent.getAttribute("start");
            const index = Array.prototype.indexOf.call(parent.children, node);
            prefix = `${start ? Number(start) + index : index + 1}. `;
          }

          const suffix = node.nextSibling ? "\n" : "";
          return prefix + body + suffix;
        }
      });

      service.addRule("chatgptMultilineCode", {
        filter: node =>
          node.nodeName === "CODE" &&
          node.textContent.includes("\n") &&
          node.parentNode?.nodeName !== "PRE",
        replacement: function (content, node, options) {
          const className = node.getAttribute("class") || "";
          const language = (className.match(/language-([\w-]+)/) || [null, ""])[1];
          const fence = options.fence || "```";
          const normalized = content.replace(/\n+$/, "").replace(/^\n+/, "");
          return `\n\n${fence}${language}\n${normalized}\n${fence}\n\n`;
        }
      });

      turndownServiceInstance = service;
    }

    return turndownServiceInstance;
  }

  function convertHtmlToMarkdown(element) {
    if (!element) {
      return "";
    }

    const service = getTurndownService();
    const markdown = service.turndown(element);
    return markdown.replace(/\r\n/g, "\n").trim();
  }

  function processMessageContent(contentElement, messageIndex) {
    if (!contentElement) {
      return "";
    }

    const clone = contentElement.cloneNode(true);

    clone.querySelectorAll(`.${MESSAGE_BUTTON_CLASS}`).forEach(node => node.remove());
    clone.querySelectorAll('[data-testid*="copy"], [data-testid*="toast"], [data-testid*="share"]').forEach(node => node.remove());
    clone.querySelectorAll('button, [role="button"]').forEach(node => node.remove());

    const images = clone.querySelectorAll("img");
    images.forEach((img, imageIndex) => {
      if (!img.getAttribute("alt") || !img.alt.trim()) {
        img.alt = `Image ${imageIndex + 1}`;
      }
      if (!img.getAttribute("src") && img.getAttribute("data-src")) {
        img.setAttribute("src", img.getAttribute("data-src"));
      }
    });

    const fileNodes = new Set();
    FILE_SELECTORS.forEach(selector => {
      clone.querySelectorAll(selector).forEach(node => fileNodes.add(node));
    });

    Array.from(fileNodes).forEach((fileElement, fileIndex) => {
      const href = fileElement.href || fileElement.getAttribute("href");
      if (!href) {
        return;
      }

      let fileName = fileElement.download || fileElement.getAttribute("download");
      if (!fileName) {
        const filenameNode = fileElement.querySelector("div[class*='font-semibold'], .font-semibold, [class*='truncate']");
        if (filenameNode) {
          fileName = filenameNode.textContent.trim();
        } else {
          const textContent = fileElement.textContent.trim();
          fileName = textContent || `file_${messageIndex}_${fileIndex}`;
        }
      }

      fileElement.innerHTML = "";
      fileElement.textContent = `📎 ${fileName}`;
      fileElement.setAttribute("data-chatgpt-download-link", "true");
      fileElement.setAttribute("href", href);
    });

    return convertHtmlToMarkdown(clone);
  }

  function downloadAsMarkdown(filename, markdown) {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilenameSegment(segment) {
    return segment.replace(/[^a-z0-9\-_.]/gi, "_").replace(/_{2,}/g, "_");
  }

  function getConversationTitle() {
    const rawTitle = document.querySelector("title")?.innerText?.trim();
    if (rawTitle) {
      return rawTitle;
    }
    return "Conversation with ChatGPT";
  }

  function detectAuthor(messageElement) {
    const directRole = messageElement.getAttribute("data-message-author-role");
    if (directRole === "user") return "User";
    if (directRole === "assistant") return "ChatGPT";

    const userIndicators = [
      messageElement.querySelector("img[alt*='user' i]"),
      messageElement.querySelector("[data-testid*='user']"),
      messageElement.querySelector("[data-message-author-role='user']"),
      messageElement.getAttribute("data-turn") === "user"
    ];

    if (userIndicators.some(Boolean)) {
      return "User";
    }

    return "ChatGPT";
  }

  function locateContentElement(messageElement) {
    for (const selector of CONTENT_SELECTORS) {
      const candidate = messageElement.querySelector(selector);
      if (candidate && candidate.textContent && candidate.textContent.trim()) {
        return candidate;
      }
    }
    return null;
  }

  function findMessageElements() {
    for (const selector of MESSAGE_SELECTORS) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) {
        return nodes;
      }
    }
    return [];
  }

  function findMessageCandidate(element) {
    if (!element) {
      return null;
    }
    if (element.matches?.(MESSAGE_NODE_SELECTOR)) {
      return element;
    }
    const candidates = element.querySelectorAll?.(MESSAGE_NODE_SELECTOR);
    if (candidates?.length) {
      return candidates[candidates.length - 1];
    }
    return null;
  }

  function findMessageInSiblings(start) {
    let current = start;
    while (current && current !== document.body) {
      let sibling = current.previousElementSibling;
      while (sibling) {
        const message = findMessageCandidate(sibling);
        if (message) {
          return message;
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return null;
  }

  function resolveMessageElementForButton(copyButton) {
    if (!copyButton) {
      return null;
    }

    const directMatch = findMessageCandidate(copyButton.closest?.(MESSAGE_NODE_SELECTOR));
    if (directMatch) {
      return directMatch;
    }

    const siblingMatch = findMessageInSiblings(copyButton.parentElement);
    if (siblingMatch) {
      return siblingMatch;
    }

    let current = copyButton.parentElement;
    while (current && current !== document.body) {
      if (MESSAGE_SELECTORS.some(selector => current.matches?.(selector))) {
        const candidate = findMessageCandidate(current);
        if (candidate) {
          return candidate;
        }
      }
      current = current.parentElement;
    }

    return null;
  }

  function indexMessages() {
    const messages = findMessageElements();
    messages.forEach((messageElement, index) => {
      messageElement.setAttribute(MESSAGE_WRAPPER_ATTRIBUTE, String(index));
    });
    debugLog("Indexed messages", messages.length);
  }

  function findCopyButtons(root) {
    if (!root) {
      return [];
    }
    const buttons = root.querySelectorAll ? root.querySelectorAll(COPY_BUTTON_SELECTOR) : [];
    const directMatch = root.matches?.(COPY_BUTTON_SELECTOR) ? [root] : [];
    return [...directMatch, ...buttons];
  }

  function attachDownloadButtons() {
    const copyButtons = findCopyButtons(document.body);
    if (copyButtons.length !== lastCopyButtonCount) {
      console.info(`[ChatGPT Downloader] copy buttons: ${copyButtons.length}`);
      lastCopyButtonCount = copyButtons.length;
    }
    copyButtons.forEach(processCopyButton);
  }

  function processCopyButton(copyButton) {
    if (processedCopyButtons.has(copyButton)) {
      return;
    }

    const messageElement = resolveMessageElementForButton(copyButton);
    if (!messageElement) {
      debugLog("Skipping copy button without message element", copyButton);
      return;
    }

    if (!messageElement.hasAttribute(MESSAGE_WRAPPER_ATTRIBUTE)) {
      indexMessages();
    }

    const actionHost = copyButton.parentElement;
    if (!actionHost) {
      debugLog("Skipping copy button without host", copyButton);
      return;
    }

    if (actionHost.querySelector(`.${MESSAGE_BUTTON_CLASS}`)) {
      processedCopyButtons.add(copyButton);
      return;
    }

    const downloadButton = copyButton.cloneNode(true);
    downloadButton.innerHTML = "";
    const iconWrapper = document.createElement("span");
    iconWrapper.className = copyButton.querySelector("span")?.className || "flex items-center justify-center touch:w-10 h-8 w-8";
    iconWrapper.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a.75.75 0 0 1 .75.75v8.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.53 3.53a.75.75 0 0 1-1.06 0L5.91 9.78a.75.75 0 1 1 1.06-1.06l2.28 2.28V2.75A.75.75 0 0 1 10 2zm-5 12.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75zm-.75 2.5a.75.75 0 0 1 .75-.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75z"></path>
      </svg>
    `;
    const icon = iconWrapper.querySelector("svg");
    if (icon) {
      icon.setAttribute("width", "20");
      icon.setAttribute("height", "20");
    }
    downloadButton.appendChild(iconWrapper);
    processedCopyButtons.add(copyButton);
    downloadButton.classList.add(MESSAGE_BUTTON_CLASS);
    downloadButton.setAttribute("aria-label", "Download message");
    downloadButton.setAttribute("data-testid", "download-turn-action-button");
    downloadButton.setAttribute("data-state", "closed");
    downloadButton.setAttribute("aria-pressed", "false");
    downloadButton.setAttribute("data-chatgpt-download-button", "true");
    downloadButton.removeAttribute("data-tooltip-id");

    downloadButton.addEventListener("click", event => {
      event.stopPropagation();
      event.preventDefault();
      downloadSingleMessage(messageElement);
    });

    processedCopyButtons.add(downloadButton);
    try {
      copyButton.insertAdjacentElement("afterend", downloadButton);
      console.info(`[ChatGPT Downloader] attached download button for message ${messageElement.getAttribute(MESSAGE_WRAPPER_ATTRIBUTE)}`);
    } catch (error) {
      console.error("ChatGPT Downloader: failed to insert download button", error);
      processedCopyButtons.delete(downloadButton);
    }
  }

  function ensureButtonsForMessage(messageElement, attempt = 0) {
    if (!messageElement) {
      console.info("[ChatGPT Downloader] ensureButtons: missing message element");
      return;
    }

    if (!messageElement.hasAttribute(MESSAGE_WRAPPER_ATTRIBUTE)) {
      indexMessages();
    }

    let copyButton = messageElement.querySelector(COPY_BUTTON_SELECTOR);
    if (!copyButton) {
      let context = messageElement;
      for (let depth = 0; depth < 5 && context; depth++) {
        let next = context.nextElementSibling;
        while (next) {
          let candidate = null;
          if (next.matches?.(COPY_BUTTON_SELECTOR)) {
            candidate = next;
          } else if (next.querySelector) {
            candidate = next.querySelector(COPY_BUTTON_SELECTOR);
          }
          if (candidate) {
            console.info(`[ChatGPT Downloader] copy found in sibling depth ${depth}`, next.className || next.tagName);
            copyButton = candidate;
            break;
          }
          next = next.nextElementSibling;
        }
        if (copyButton) {
          break;
        }
        context = context.parentElement;
      }
    }
    if (!copyButton) {
      console.info(`[ChatGPT Downloader] copy missing (attempt ${attempt})`);
      if (attempt >= 12) {
        debugLog("Copy button still missing after 12 retries", messageElement);
        return;
      }
      const rerun = () => ensureButtonsForMessage(messageElement, attempt + 1);
      if (attempt < 4) {
        setTimeout(rerun, 0);
      } else if (attempt < 8) {
        setTimeout(rerun, 50);
      } else {
        setTimeout(rerun, 100);
      }
      return;
    }

    if (processedCopyButtons.has(copyButton) && messageElement.querySelector(`.${MESSAGE_BUTTON_CLASS}`)) {
      return;
    }

    console.info(`[ChatGPT Downloader] copy found (attempt ${attempt})`);
    processCopyButton(copyButton);
  }

  function bindMessageActions() {
    const messages = findMessageElements();
    messages.forEach(messageElement => {
      if (boundMessages.has(messageElement)) {
        return;
      }

      boundMessages.add(messageElement);
      messageElement.addEventListener("mouseenter", () => ensureButtonsForMessage(messageElement));
      messageElement.addEventListener("focusin", () => ensureButtonsForMessage(messageElement));
    });
  }

  function buildMessageMarkdown(messageElement) {
    const index = Number(messageElement.getAttribute(MESSAGE_WRAPPER_ATTRIBUTE) || "0");
    const contentElement = locateContentElement(messageElement);
    if (!contentElement) {
      throw new Error("Unable to locate message content");
    }

    const markdown = processMessageContent(contentElement, index);
    const author = detectAuthor(messageElement);
    return {
      markdown,
      author,
      index
    };
  }

  function downloadSingleMessage(messageElement) {
    try {
      const { markdown, author, index } = buildMessageMarkdown(messageElement);
      const finalContent = markdown.trim();
      if (!finalContent) {
        throw new Error("Message content is empty");
      }
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const fileSegment = sanitizeFilenameSegment(`${author}_message_${index + 1}`);
      downloadAsMarkdown(`ChatGPT_${fileSegment}_${timestamp}.md`, finalContent);
    } catch (error) {
      console.error("ChatGPT Downloader: failed to export message", error);
    }
  }

  function downloadConversation() {
    const messages = findMessageElements();
    const parts = [];
    let messageIndex = 0;

    messages.forEach(messageElement => {
      const contentElement = locateContentElement(messageElement);
      if (!contentElement) {
        return;
      }

      const segment = processMessageContent(contentElement, messageIndex).trim();
      if (!segment) {
        return;
      }

      const author = detectAuthor(messageElement);
      const prefix = `**${author}**:\n\n${segment}`;
      parts.push(prefix);
      messageElement.setAttribute(MESSAGE_WRAPPER_ATTRIBUTE, String(messageIndex));
      messageIndex += 1;
    });

    if (!parts.length) {
      throw new Error("Unable to find any conversation content to download");
    }

    const title = `# ${getConversationTitle()}`;
    const body = parts.join("\n\n---\n\n");
    const markdown = `${title}\n\n${body}`.trim();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    downloadAsMarkdown(`ChatGPT_Conversation_${timestamp}.md`, markdown);
  }

  function createConversationButton() {
    if (document.querySelector(`.${CONVERSATION_BUTTON_CLASS}`)) {
      return;
    }

    const dictateButton = document.querySelector('button[aria-label="Dictate button"]');
    const dictateWrapper = dictateButton?.parentElement || null;
    const inlineContainer = dictateWrapper?.parentElement || null;

    const button = document.createElement("button");
    button.type = "button";
    button.className = dictateButton?.className || "composer-btn";
    button.classList.add(CONVERSATION_BUTTON_CLASS);
    button.setAttribute("aria-label", "Download chat");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2.5a.75.75 0 0 1 .75.75v8.01l2.2-2.19a.75.75 0 1 1 1.06 1.06l-3.53 3.53a.75.75 0 0 1-1.06 0l-3.53-3.53a.75.75 0 0 1 1.06-1.06l2.2 2.19V3.25A.75.75 0 0 1 10 2.5Zm-5.75 11.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5h-10a.75.75 0 0 1-.75-.75Zm1.5 3a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75Z"></path>
      </svg>
    `;
    const convoIcon = button.querySelector("svg");
    if (convoIcon) {
      convoIcon.setAttribute("width", "20");
      convoIcon.setAttribute("height", "20");
    }
    button.addEventListener("click", event => {
      event.stopPropagation();
      event.preventDefault();
      try {
        downloadConversation();
      } catch (error) {
        console.error("ChatGPT Downloader: failed to export conversation", error);
      }
    });

    if (inlineContainer) {
      const wrapper = document.createElement(dictateWrapper?.nodeName?.toLowerCase() === "span" ? "span" : "div");
      wrapper.className = dictateWrapper?.className || "";
      const state = dictateWrapper?.getAttribute("data-state");
      if (state) {
        wrapper.setAttribute("data-state", state);
      }
      wrapper.setAttribute("data-chatgpt-download-button", "true");
      wrapper.appendChild(button);
      inlineContainer.insertBefore(wrapper, dictateWrapper?.nextSibling || null);
      return;
    }

    const fallbackTargets = [
      "div[data-testid='composer-footer-actions']",
      "form[data-type*='composer'] div[data-testid='composer-footer-actions']",
      "form[data-type*='composer'] div[role='toolbar']",
      "form[data-type*='composer']"
    ];

    let container = null;
    for (const selector of fallbackTargets) {
      const candidate = document.querySelector(selector);
      if (candidate) {
        container = candidate;
        break;
      }
    }

    if (!container) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.marginLeft = "auto";
    wrapper.appendChild(button);
    container.appendChild(wrapper);
  }

  function enhancePage() {
    indexMessages();
    bindMessageActions();
    createConversationButton();
  }

  function observeMessages() {
    if (window.__chatgptDownloaderObserver || !document.body) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) {
            return;
          }

          if (node.matches?.('[data-message-author-role]')) {
            bindMessageActions();
            ensureButtonsForMessage(node);
          }

          node.querySelectorAll?.('[data-message-author-role]').forEach(message => {
            bindMessageActions();
            ensureButtonsForMessage(message);
          });

          const copyButtons = findCopyButtons(node);
          copyButtons.forEach(processCopyButton);
        });
      });
      createConversationButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.__chatgptDownloaderObserver = observer;
  }

  function init() {
    enhancePage();
    observeMessages();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) {
        return false;
      }

      if (message.type === "chatgpt-downloader:download-conversation") {
        console.info("[ChatGPT Downloader] Received request to download conversation");
        try {
          downloadConversation();
          sendResponse({ success: true });
        } catch (error) {
          console.error("ChatGPT Downloader: failed to export conversation", error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }
      return false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
