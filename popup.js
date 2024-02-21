// INITIAL SETUP
document.addEventListener("DOMContentLoaded", function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTab = tabs[0];
    console.log("loading captions");
    if (currentTab && isYouTubeVideoURL(currentTab.url)) {
      fetchCaptions(currentTab.url);
    } else {
      document.getElementById("loading-message").textContent =
        "Not a YouTube video page.";
    }
  });
});

// GLOBAL VARIABLES
const chatboxInput = document.querySelector(".chatbox-message-input");
const chatboxForm = document.querySelector(".chatbox-message-form");
const chatboxMessageContent = document.querySelector(
  ".chatbox-message-content"
);
const chatboxNoMessage = document.querySelector(".chatbox-message-no-message");
let conversation = []; //highly important variable, keeps track of the conversation to be sent to the backend

// EVENT LISTENERS
chatboxInput.addEventListener("input", function () {
  // this listener dynamically adjusts the input box as the user types
  const lines = this.innerHTML.split("<br>").length;
  const minHeight = 25;
  let newHeight = lines * minHeight;

  if (newHeight < minHeight * 6) {
    this.style.minHeight = `${newHeight}px`;
  } else {
    this.style.minHeight = `${minHeight * 6}px`; // Maximum height
  }

  // Adjusting form alignment
  if (lines > 1) {
    chatboxForm.style.alignItems = "flex-end";
  } else {
    chatboxForm.style.alignItems = "center";
  }
});

chatboxInput.addEventListener("focus", function () {
  const isPlaceholder = this.innerText === "Type message...";
  if (isPlaceholder) {
    this.innerText = "";
  }
});

chatboxInput.addEventListener("blur", function () {
  if (this.innerText.trim() === "") {
    this.innerText = "Type message...";
  }
});

chatboxInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    if (isValid(chatboxInput)) {
      writeMessage();
    }
  }
});

chatboxForm.addEventListener("submit", function (e) {
  e.preventDefault();

  if (isValid(chatboxInput)) {
    writeMessage();
  }
});

// FUNCTIONS

function fetchCaptions(videoURL) {
  //fetches a response from the backend on heroku
  const backendURL = `https://ai-youtube-extension-5217a13215ac.herokuapp.com/get-captions?videoURL=${encodeURIComponent(
    videoURL
  )}`;
  fetch(backendURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch captions");
      }
      return response.text();
    })
    .then((captions) => {
      //once the captions are successfully loaded, remove the loading message and show the UI
      document.getElementById("loading-message").style.display = "none";
      document.querySelector(".chatbox-message-container").style.display =
        "block";
      //adds the context to the conversations array, so when it gets sent to the backend the ai will know what the youtube video is about
      addToConversation(
        "user",
        "You are an AI Chatbot for YouTube that helps users answer any questions they might have about a video they're watching. Use these captions as context for the video they are currently viewing: " +
          captions
      );
    })
    .catch((error) => {
      console.error("Error fetching captions:", error);
      document.getElementById("loading-message").textContent =
        "Failed to load captions.";
    });
}

function writeMessage() {
  const today = new Date();
  //handles adjusting the UI and adding data to the conversations array for the backend
  //this section deals with the users message
  let messageContent = chatboxInput.innerText.trim();
  addToConversation("user", messageContent);
  let formattedMessage = messageContent.replace(/\n/g, "<br>");
  let message = `
    <div class="chatbox-message-item sent">
        <span class="chatbox-message-item-text"> 
            ${formattedMessage} 
        </span>
        <span class="chatbox-message-item-time">${addZero(
          today.getHours()
        )}:${addZero(today.getMinutes())}</span>
    </div>
    `;
  chatboxMessageContent.insertAdjacentHTML("beforeend", message);
  chatboxForm.style.alignItems = "center";
  chatboxInput.innerHTML = "";
  chatboxInput.focus();
  chatboxNoMessage.style.display = "none";
  scrollBottom();

  //generate chat bubble while loading ai response
  let loadingMessage = `
    <div class="chatbox-message-item loading">
        <span class="chatbox-message-item-text"> 
            ... 
        </span>
    </div>
    `;
  setTimeout(function () {
    chatboxMessageContent.insertAdjacentHTML("beforeend", loadingMessage);
    scrollBottom();
  }, 425);

  //send user message to backend for processing
  sendPromptToBackend(conversation).then((response) => {
    //this section handles the UI adjustment for the chatbot as well as adding its data to the conversations array
    let aiMessage = response.choices[0].message.content;
    addToConversation("assistant", aiMessage);
    let formattedAiMessage = aiMessage.replace(/\n/g, "<br>");
    let aiMessageHTML = `
    <div class="chatbox-message-item received">
      <span class="chatbox-message-item-text">${formattedAiMessage}</span>
      <span class="chatbox-message-item-time">${addZero(
        today.getHours()
      )}:${addZero(today.getMinutes())}</span>
    </div>
    `;
    //remove loading message before inserting ai message
    let loadingElement = document.querySelector(
      ".chatbox-message-item.loading"
    );
    if (loadingElement) {
      loadingElement.parentNode.removeChild(loadingElement);
    }
    chatboxMessageContent.insertAdjacentHTML("beforeend", aiMessageHTML);
    scrollBottom();
  });
}

function sendPromptToBackend(conversation) {
  //this function communicates with the backend
  const backendURL =
    "https://ai-youtube-extension-5217a13215ac.herokuapp.com/chatbot";
  return fetch(backendURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: conversation }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Network response was not ok: " + response.statusText);
    }
    return response.json();
  });
}

function addToConversation(role, content) {
  conversation.push({ role: role, content: content });
}

function addZero(num) {
  return num < 10 ? "0" + num : num;
}

function scrollBottom() {
  chatboxMessageContent.scrollTo(0, chatboxMessageContent.scrollHeight);
}

function isValid(element) {
  let text = element.innerText;
  text = text.replace(/\s\s+/g, " ").replace(/\n/g, " ");
  text = text.trim();
  return text.length > 0;
}

function isYouTubeVideoURL(url) {
  return url.match(/https:\/\/www\.youtube\.com\/watch\?v=[^&]+/);
}
