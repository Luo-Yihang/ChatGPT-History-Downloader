document.addEventListener("DOMContentLoaded", function () {
  const downloadButton = document.getElementById("download-markdown");
  const statusMessage = document.getElementById("status-message");

  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message show ${type}`;
  }

  function hideStatus() {
    statusMessage.className = 'status-message';
  }

  function setButtonState(state) {
    downloadButton.className = `download-button ${state}`;
    downloadButton.disabled = state === 'loading';
  }

  downloadButton.addEventListener("click", async function () {
    setButtonState('loading');
    showStatus('Processing conversation content...', 'info');
    
    try {
      const tab = await getCurrentTab();
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: downloadMarkdown,
      });
      
      showStatus('Download successful!', 'success');
      setButtonState('success');
      
      // Reset button state after 2 seconds
      setTimeout(() => {
        setButtonState('ready');
        hideStatus();
      }, 2000);
      
    } catch (error) {
      console.error('Error during download:', error);
      showStatus('Download failed, please check console.', 'error');
      setButtonState('ready');
      
      // Reset error message after 3 seconds
      setTimeout(() => {
        hideStatus();
      }, 3000);
    }
  });

  async function getCurrentTab() {
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    return tab;
  }

  function downloadMarkdown() {
    function h(html) {
      // Don't process if it's already markdown-like content
      if (html.includes('```') && !html.includes('<')) {
        return html.trim();
      }
      
      console.log('Processing HTML:', html);
      
      let result = html;
      
      // Process formatting tags FIRST (before code blocks)
      result = result
        .replace(/<strong[^>]*>/g, "**") // replace strong tags with markdown bold (including attributes)
        .replace(/<\/strong>/g, "**")
        .replace(/<b[^>]*>/g, "**") // replace b tags with markdown bold (including attributes)
        .replace(/<\/b>/g, "**")
        .replace(/<em[^>]*>/g, "*") // replace em tags with markdown italic (including attributes)
        .replace(/<\/em>/g, "*")
        .replace(/<i[^>]*>/g, "*") // replace i tags with markdown italic (including attributes)
        .replace(/<\/i>/g, "*");
      
      console.log('After formatting tags:', result);
      
      // Process other structural elements
      result = result
        .replace(/<p>/g, "\n\n") // replace p tags with double newlines
        .replace(/<\/p>/g, "")
        .replace(/<br\s*\/?>/g, "\n") // replace br tags with newlines
        .replace(/<ul>/g, "\n") // remove ul tags
        .replace(/<\/ul>/g, "\n")
        .replace(/<ol>/g, "\n") // remove ol tags
        .replace(/<\/ol>/g, "\n")
        .replace(/<li>/g, "- ") // replace li tags with markdown list
        .replace(/<\/li>/g, "\n")
        .replace(/<h1[^>]*>/g, "\n# ") // replace h1 tags with markdown h1
        .replace(/<\/h1>/g, "\n")
        .replace(/<h2[^>]*>/g, "\n## ") // replace h2 tags with markdown h2
        .replace(/<\/h2>/g, "\n")
        .replace(/<h3[^>]*>/g, "\n### ") // replace h3 tags with markdown h3
        .replace(/<\/h3>/g, "\n")
        .replace(/<h4[^>]*>/g, "\n#### ") // replace h4 tags with markdown h4
        .replace(/<\/h4>/g, "\n");
      
      console.log('After structural elements:', result);
      
      // Handle code blocks - process pre/code combinations FIRST
      result = result.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        const cleanCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ')
          .trim();
        console.log('Processing code block:', cleanCode);
        
        // Check for language class to determine markdown syntax
        const languageMatch = match.match(/class="[^"]*language-([^"\s]+)/);
        const language = languageMatch ? languageMatch[1] : '';
        
        if (language) {
          return "\n```" + language + "\n" + cleanCode + "\n```\n";
        } else {
          return "\n```\n" + cleanCode + "\n```\n";
        }
      });
      
      result = result.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (match, code) => {
        const cleanCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ')
          .trim();
        console.log('Processing inline code:', cleanCode);
        
        const languageMatch = match.match(/class="[^"]*language-([^"\s]+)/);
        const language = languageMatch ? languageMatch[1] : '';
        
        if (!cleanCode.includes('\n')) {
          return "`" + cleanCode + "`";
        }
        
        if (language) {
          return "\n```" + language + "\n" + cleanCode + "\n```\n";
        } else {
          return "\n```\n" + cleanCode + "\n```\n";
        }
      });
      
      console.log('After code blocks:', result);
      
      // Remove UI elements and clean HTML
      result = result
        .replace(/<button[^>]*>.*?<\/button>/g, "")
        .replace(/<div[^>]*class="[^"]*copy[^"]*"[^>]*>.*?<\/div>/g, "")
        .replace(/<div[^>]*class="[^"]*edit[^"]*"[^>]*>.*?<\/div>/g, "")
        .replace(/Copy code/g, "")
        .replace(/Edit/g, "")
        .replace(/Copy/g, "")
        .replace(/<span[^>]*class="[^"]*copy[^"]*"[^>]*>.*?<\/span>/g, "")
        .replace(/<span[^>]*class="[^"]*edit[^"]*"[^>]*>.*?<\/span>/g, "")
        .replace(/<div[^>]*class="[^"]*language[^"]*"[^>]*>.*?<\/div>/g, "")
        .replace(/<span[^>]*class="[^"]*language[^"]*"[^>]*>.*?<\/span>/g, "")
        .replace(/<span[^>]*>(.*?)<\/span>/g, "$1")
        .replace(/<[a-zA-Z][^>]*>/g, "")
        .replace(/<\/[a-zA-Z][^>]*>/g, "")
        .replace(
          /This content may violate our content policy\. If you believe this to be in error, please submit your feedback — your input will aid our research in this area\./g,
          ""
        )
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .replace(/^\s+|\s+$/g, "")
        .replace(/[a-zA-Z]+\*{4,}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      
      console.log('Final result:', result);
      return result;
    }

    async function processMessageContent(contentElement, messageIndex) {
      let content = contentElement.innerHTML;
      
      console.log('Processing message content:', contentElement);
      console.log('Content HTML:', content);
      
      // Check for images and replace with markdown references
      const images = contentElement.querySelectorAll('img');
      console.log(`Found ${images.length} images`);
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const src = img.src || img.getAttribute('src') || img.getAttribute('data-src');
        
        if (src) {
          console.log(`Image ${i}: ${src}`);
          const imgMarkdown = `![Image ${i + 1}](${src})`;
          content = content.replace(img.outerHTML, imgMarkdown);
          console.log(`Replaced image with: ${imgMarkdown}`);
        }
      }
      
      // Check for files and replace with markdown references
      const fileSelectors = [
        'a[download]',
        'a[href*="blob:"]',
        'div[class*="text-token-text-primary"] a',
        'div[class*="border-token-border"] a'
      ];
      
      let allFiles = [];
      fileSelectors.forEach(selector => {
        const files = contentElement.querySelectorAll(selector);
        allFiles = allFiles.concat(Array.from(files));
      });
      
      const uniqueFiles = [...new Set(allFiles)];
      console.log(`Found ${uniqueFiles.length} files`);
      
      for (let i = 0; i < uniqueFiles.length; i++) {
        const fileElement = uniqueFiles[i];
        const href = fileElement.href || fileElement.getAttribute('href');
        
        if (href) {
          let fileName = fileElement.download || 
                        fileElement.getAttribute('download');
          
          if (!fileName) {
            const filenameElement = fileElement.querySelector('div[class*="font-semibold"], .font-semibold, [class*="truncate"]');
            if (filenameElement) {
              fileName = filenameElement.textContent.trim();
            } else {
              fileName = fileElement.textContent.trim() || `file_${i}`;
            }
          }
          
          console.log(`File ${i}: ${fileName} - ${href}`);
          const fileMarkdown = `[📎 ${fileName}](${href})`;
          content = content.replace(fileElement.outerHTML, fileMarkdown);
          console.log(`Replaced file with: ${fileMarkdown}`);
        }
      }
      
      return {
        content: h(content),
        hasMedia: false,
        mediaFiles: []
      };
    }

    (async () => {
      console.log('Starting ChatGPT message extraction...');
      
      // Try multiple selectors for different ChatGPT versions
      const selectorSets = [
        '[data-message-author-role]',
        'article[data-testid*="conversation-turn"]',
        '.group.text-token-text-primary',
        '[class*="group"][class*="text-token"]',
        'article',
        '[class*="group"]'
      ];
      
      let messageElements = [];
      for (const selector of selectorSets) {
        messageElements = document.querySelectorAll(selector);
        console.log(`Selector "${selector}" found ${messageElements.length} elements`);
        if (messageElements.length > 0) break;
      }
      
      if (messageElements.length === 0) {
        console.error('No message elements found!');
        alert('Unable to find conversation content. Please ensure you are on a ChatGPT conversation page.');
        return;
      }

      // Setup markdown file with title
      let t = `# ${
        document.querySelector("title")?.innerText || "Conversation with ChatGPT"
      }\n\n`;
      
      let messageIndex = 0;
      
      console.log(`Processing ${messageElements.length} message elements...`);
      
      for (const s of messageElements) {
        const contentSelectors = [
          '[class*="whitespace-pre-wrap"]',
          '[class*="prose"]',
          '[class*="markdown"]',
          '.markdown',
          '[class*="text-base"]',
          '[data-testid*="content"]',
          'p',
          'div'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = s.querySelector(selector);
          if (contentElement && contentElement.textContent.trim()) {
            console.log(`Found content with selector: ${selector}`);
            break;
          }
        }
        
        if (contentElement && contentElement.textContent.trim()) {
          let isUser = false;
          
          const userIndicators = [
            s.querySelector('img[alt*="user"], img[alt*="User"]'),
            s.querySelector('[data-message-author-role="user"]'),
            s.querySelector('[data-testid*="user"]'),
            s.getAttribute('data-message-author-role') === 'user',
            s.getAttribute('data-turn') === 'user'
          ];
          
          isUser = userIndicators.some(indicator => indicator);
          
          const username = isUser ? "User" : "ChatGPT";
          
          console.log(`Processing ${username} message ${messageIndex}`);
          
          const processedContent = await processMessageContent(contentElement, messageIndex);
          
          t += messageIndex > 0 ? "\n---\n\n" : "";
          t += `**${username}**:\n\n${processedContent.content}\n\n`;
          
          messageIndex++;
        }
      }

      console.log('Downloading markdown file...');
      
      // Download markdown file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const o = document.createElement("a");
      o.download = `ChatGPT_Conversation_${timestamp}.md`;
      o.href = URL.createObjectURL(new Blob([t], {type: 'text/markdown'}));
      o.style.display = "none";
      document.body.appendChild(o);
      o.click();
      document.body.removeChild(o);
      console.log('Markdown file downloaded successfully');
    })();
  }
});