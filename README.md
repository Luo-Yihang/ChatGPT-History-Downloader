<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/Luo-Yihang/ChatGPT-History-Downloader">
    <img src="./src/assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">ChatGPT-History-Downloader (Enhanced Fork)</h3>

  <p align="center">
   Never lose a conversation with <a href="https://chat.openai.com"><strong>OpenAI ChatGPT</strong></a> again! With the ChatGPT-History-Downloader, you can easily save your chat history as Markdown files locally. The extension automatically detects and references images and files in your conversations. ChatGPT-History-Downloader is a browser extension that supports Google Chrome / Microsoft Edge.
    <br />
  </p>
</div>

## What's new in this fork?

- Inline download buttons appear next to every ChatGPT message, mirroring the built-in copy action.
- Single-message downloads now include Deep Research results and any other multi-part answers rendered within the same turn.
- Popup UI was removed to streamline the extension; everything happens directly inside the chat interface.

<!-- GETTING STARTED -->
## Getting Started
**Google Chrome / Microsoft Edge** 
1. Clone the repo
   ```sh
   git clone https://github.com/Luo-Yihang/ChatGPT-History-Downloader
   ```
2. In Chrome/Edge go to the extensions page (`chrome://extensions` / `edge://extensions`).
3. Enable Developer Mode.
4. Drag this `src` folder in the repo anywhere on the page to import it (do not delete the folder afterwards).

## Usage

1. Switch to the ChatGPT tab in the browser
2. Click the `Extensions` button (it is usually on the top right corner of the browser), and select the `ChatGPT-History-Downloader` extension
3. Click the download button to save your chat history

## Differences from upstream

- This fork bundles rebuilt `content.js`, `content.css`, and Turndown dependencies under `src/vendor/`.
- All conversation and single-message downloads share the same Markdown conversion pipeline, ensuring parity between "Download chat" and per-message exports.
- Minimal permissions kept intact (`activeTab`, `downloads`, `scripting`).


## A sample downloaded Markdown output
```
**User**: Hi! How are you?

--------
**ChatGPT**: Hello! As an AI language model, I don't have feelings like humans do, but I'm here to help you with any questions or tasks you have. How can I assist you today?

--------
**User**: Can you analyze this image? ![Image](image_2_0.png)

--------
**ChatGPT**: I can see the image you've shared. It appears to be...
```

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.
