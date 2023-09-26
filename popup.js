const buttonDownloadMarkdown = document.getElementById("download-markdown");
const buttonDownloadHTML = document.getElementById("download-html");


async function getCurrentTab() {
  const queryOptions = { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function downloadMarkdown() {
  function h(html) { // convert html to markdown is a hacky way
    return html // fix newlines
      .replace(/<p>/g, "\n") // replace p tags with newlines
      .replace(/<\/p>/g, "\n")
      .replace(/<b>/g, "**") // replace bold tags with markdown bold
      .replace(/<\/b>/g, "**")
      .replace(/<strong>/g, "**") // replace strong tags with markdown bold
      .replace(/<\/strong>/g, "**")
      .replace(/<i>/g, "_") // replace italic tags with markdown italic
      .replace(/<\/i>/g, "_")
      .replace(/<br>/g, "\n") // replace br tags with newlines
      .replace(/<br\/>/g, "\n")
      // fix lists
      .replace(/<ul>/g, "\n") // remove ul tags
      .replace(/<\/ul>/g, "")
      .replace(/<ol>/g, "\n") // remove ol tags
      .replace(/<\/ol>/g, "")
      .replace(/<li>/g, "- ") // replace li tags with markdown list
      .replace(/<\/li>/g, "\n")
      // fix headings
      .replace(/<h1>/g, "# ") // replace h1 tags with markdown h1
      .replace(/<\/h1>/g, "\n")
      .replace(/<h2>/g, "## ") // replace h2 tags with markdown h2
      .replace(/<\/h2>/g, "\n")
      .replace(/<h3>/g, "\n### ") // replace h3 tags with markdown h3
      .replace(/<\/h3>/g, "\n")
      .replace(/<h4>/g, "\n#### ") // replace h4 tags with markdown h4
      .replace(/<\/h4>/g, "\n")
      // fix code blocks")
      .replace(/<code>([^<]*)<\/code>/g, "`$1`") // replace inline code tags with markdown code
      .replace(/<code[^>]*>/g, (match) => { // replace code tags with a language with markdown code
        const lm = match.match(/class="[^"]*language-([^"]+)"/);
        return lm ? "\n```" + lm[1] + "\n" : "\n```plain\n";
      })
      .replace(/<\/code[^>]*>/g, "```\n")
      .replace(/<span>[^<]*<\/span>/g, "") // remove span tags
      .replace(/<[^>]*>/g, "") // remove all other html tags
      .replace(/Copy code/g, "") // remove copy code button
      .replace(
        /This content may violate our content policy. If you believe this to be in error, please submit your feedback — your input will aid our research in this area./g,
        ""
      )
      .replace(/-\n\*\*/g, "- **") // fix lists
      // fix entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  }(() => {
    const e = document.querySelectorAll(".text-base.flex");
    // set up the markdown file. Start with the title as the heading
    let t = `# ${
      document.querySelector("title")?.innerText || "Conversation with ChatGPT"
    }\n\n`;
    for (const s of e)
      s.querySelector(".whitespace-pre-wrap") &&
        ((t += t == "" ? "" : "--------\n"),
        (t += `**${
          s.querySelector("img")// if there is an image, use the alt text
            ? s.querySelector("img").alt
            : "ChatGPT" // otherwise use ChatGPT
        }**: ${h(s.querySelector(".whitespace-pre-wrap").innerHTML)}\n\n`));

    const o = document.createElement("a");
    (o.download =
      (document.querySelector("title")?.innerText ||
        "Conversation with ChatGPT") + ".md"),
      (o.href = URL.createObjectURL(new Blob([t]))),
      (o.style.display = "none"),
      document.body.appendChild(o),
      o.click();
  })();
}

function downloadHTML() {
  // get header and extract the model in use. This is a hacky way to do it
  const header = document.querySelector("header").innerHTML;
  const model = header.match(/<span>([^<]*)<\/span>/)[1];
  // each group is a message, so we can just download the whole thing... in theory
  const e = document.querySelectorAll(".group.text-token-text-primary");
  output = "";
  // loop through each message, and get the name and message, stripping out the div tags
  for (const s of e) {
    // if there is an image, use the alt text as the name
    const img = s.querySelector("img");
    const username = img ? img.alt : "ChatGPT";
    // get the message, stripping out the div tags
    const message = s.querySelector(".whitespace-pre-wrap").innerHTML;
    // strip out the div tags from the message (this is a hacky way to do it) - need to support bare <div> tags and <div class="..."> tags
    const html = message.replace(/<div[^\>]*>/g, "")
      .replace(/<\/div>/g, "\n")
      // copy code button has to be removed separately, as it is not a div
      // note that this will remove any other buttons as well
      .replace(/<button[^>]*>.*<\/button>/, "");
    // add the message to the output
    output += `<div><b>${username}</b>: ${html}</div>\n`;
  }
  // create a link to download the file
  const o = document.createElement("a");
  (o.download =
    (document.querySelector("title")?.innerText ||
      "Conversation with ChatGPT") + ".html"),
    (o.href = URL.createObjectURL(new Blob([output]))),
    (o.style.display = "none"),
    document.body.appendChild(o),
    o.click();
}

buttonDownloadMarkdown.addEventListener("click", async () => {
  const tab = await getCurrentTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: downloadMarkdown,
  });
});

buttonDownloadHTML.addEventListener("click", async () => {
  const tab = await getCurrentTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: downloadHTML,
  });
});