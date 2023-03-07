const buttonDownloadMarkdown = document.getElementById('download-markdown');

async function getCurrentTab() {
  const queryOptions = { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function downloadMarkdown() {
  function h(html) {
    console.log(html)
    return html.replace(/<p>/g, '\n\n').replace(/<\/p>/g, '').replace(/<b>/g, '**').replace(/<\/b>/g, '**').replace(/<i>/g, '_').replace(/<\/i>/g, '_').replace(/<code[^>]*>/g, (match) => {
      const lm = match.match(/class="[^"]*language-([^"]*)"/);
      return lm ? '\n```' + lm[1] + '\n' : '```';
    }).replace(/<\/code[^>]*>/g, '```').replace(/<[^>]*>/g, '').replace(/Copy code/g, '').replace(/This content may violate our content policy. If you believe this to be in error, please submit your feedback — your input will aid our research in this area./g, '').trim();
  }(() => {
    const e = document.querySelectorAll(".text-base");
    let t = "";
    for (const s of e) s.querySelector(".whitespace-pre-wrap") && (t += t == "" ? "" : "--------\n", t += `**${s.querySelectorAll('img').length>1?s.querySelectorAll('img')[1].alt:'ChatGPT'}**: ${h(s.querySelector(".whitespace-pre-wrap").innerHTML)}\n\n`);
    const o = document.createElement("a");
    o.download = (document.querySelector(".pr-14.bg-gray-800")?.innerText || "Conversation with ChatGPT") + ".md", o.href = URL.createObjectURL(new Blob([t])), o.style.display = "none", document.body.appendChild(o), o.click()
  })();
}

buttonDownloadMarkdown.addEventListener('click', async () => {
  const tab = await getCurrentTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: downloadMarkdown
  });
});

