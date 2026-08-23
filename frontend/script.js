const VALID_EMOTIONS = [
    "neutral", "listening", "thinking", "happy", 
    "laughing", "surprised", "sad", "angry", 
    "confused", "romantic", "smart"
];

let selectedVoice = null;
let searchTimeout = null;
let isMuted = false;

// Dynamic API URL for local development vs Render production
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://nemostockai.onrender.com';

const dom = {
    userInput: document.getElementById("userInput"),
    chatBox: document.getElementById("chatBox"),
    sendBtn: document.getElementById("sendBtn"),
    muteBtn: document.getElementById("muteBtn"),
    nemoAvatar: document.getElementById("nemoAvatar"),
    nemoAura: document.getElementById("nemoAura"),
    nemoContainer: document.getElementById("nemoContainer")
};

if (dom.muteBtn) {
    dom.muteBtn.innerText = "Mute Mic";
}

// Create suggestion container dynamically and inject it right below the text input
const suggestionBox = document.createElement("div");
suggestionBox.id = "searchSuggestions";
suggestionBox.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: #1e1e2f;
    border: 1px solid #9c27b0;
    border-radius: 8px;
    max-height: 250px;
    overflow-y: auto;
    display: none;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
`;

if (dom.userInput && dom.userInput.parentNode) {
    dom.userInput.parentNode.style.position = "relative";
    dom.userInput.parentNode.appendChild(suggestionBox);
}

function initializeVoices() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    selectedVoice = voices.find(v => 
        v.name.includes('Google UK English Female') || 
        v.name.includes('Samantha') || 
        v.name.includes('Victoria') || 
        v.name.includes('Karen') ||
        v.name.toLowerCase().includes('female')
    ) || voices[0];
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = initializeVoices;
    initializeVoices();
}

function updateExpression(emotion) {
    const cleanEmotion = emotion ? emotion.toLowerCase().trim() : "neutral";
    
    if (VALID_EMOTIONS.includes(cleanEmotion)) {
        dom.nemoAvatar.src = `${cleanEmotion}.png`;
    } else {
        dom.nemoAvatar.src = "neutral.png";
    }

    let glowColor = "rgba(255, 152, 0, 0.3)";
    let borderColor = "#ff9800";

    switch (cleanEmotion) {
        case "angry":
            glowColor = "rgba(244, 67, 54, 0.5)";
            borderColor = "#f44336";
            break;
        case "sad":
            glowColor = "rgba(33, 150, 243, 0.4)";
            borderColor = "#2196f3";
            break;
        case "romantic":
            glowColor = "rgba(233, 30, 99, 0.5)";
            borderColor = "#e91e63";
            break;
        case "happy":
        case "laughing":
            glowColor = "rgba(76, 175, 80, 0.4)";
            borderColor = "#4caf50";
            break;
        case "smart":
            glowColor = "rgba(156, 39, 176, 0.4)";
            borderColor = "#9c27b0";
            break;
    }

    dom.nemoAvatar.style.borderColor = borderColor;
    dom.nemoAura.style.background = glowColor;
}

function speakText(text) {
    if (isMuted) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.15; 
    utterance.rate = 1.0; 

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
}

function animateLipSync() {
    if (!isMuted && window.speechSynthesis && window.speechSynthesis.speaking) {
        const timeFactor = Date.now() / 70;
        const jawDrop = Math.abs(Math.sin(timeFactor)) * 0.09 + (Math.random() * 0.03);
        dom.nemoAvatar.style.transform = `scaleY(${1 + jawDrop}) scaleX(${1 - jawDrop * 0.35}) translateY(${-jawDrop * 6}px)`;
    } else {
        dom.nemoAvatar.style.transform = 'scaleY(1) scaleX(1) translateY(0px)';
    }
    requestAnimationFrame(animateLipSync);
}
requestAnimationFrame(animateLipSync);

function appendMessage(sender, text) {
    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";
    messageElement.innerHTML = `<b>${sender}:</b> ${text}`;
    dom.chatBox.appendChild(messageElement);
    dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function handlePoke() {
    const pokeResponses = [
        "Please focus on the market data.",
        "Stock analysis interface is active.",
        "Created by Benjamin Paduva.",
        "Metrics are operating normally."
    ];
    const randomReply = pokeResponses[Math.floor(Math.random() * pokeResponses.length)];
    updateExpression("surprised");
    appendMessage("Nemo", randomReply);
    speakText(randomReply);
}

async function processMessage(userText, compareWith = null) {
    let endpoint = `${API_URL}/api/message`;
    let payload = { userText };
    if (compareWith) {
        payload.compareWith = compareWith;
    }

    let options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();
        
        updateExpression(data.emotion);
        if (data.reply) {
            appendMessage("Nemo", data.reply);
            speakText(data.reply);
        }
    } catch (error) {
        updateExpression("sad");
        appendMessage("Nemo", "Oops! I lost connection to my backend server.");
        speakText("Oops! I lost connection to my backend server.");
    }
}

function hideSuggestions() {
    suggestionBox.style.display = "none";
    suggestionBox.innerHTML = "";
}

async function fetchSuggestions(query) {
    if (!query || query.length < 2) {
        hideSuggestions();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText: query })
        });
        const data = await response.json();

        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            suggestionBox.innerHTML = "";
            data.suggestions.forEach(m => {
                const item = document.createElement("div");
                item.style.cssText = `
                    padding: 10px 15px;
                    cursor: pointer;
                    color: #ffffff;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    font-size: 14px;
                `;
                
                const displayName = m.shortName || m.shortname || m.longname || m.name;
                if (displayName) {
                    item.innerHTML = `${displayName} (${m.symbol})`;
                    
                    item.onmouseover = () => item.style.background = "#2a2a40";
                    item.onmouseout = () => item.style.background = "transparent";
                    
                    item.onclick = () => {
                        dom.userInput.value = m.symbol;
                        hideSuggestions();
                        sendMessage();
                    };
                    
                    suggestionBox.appendChild(item);
                }
            });
            if (suggestionBox.children.length > 0) {
                suggestionBox.style.display = "block";
                return;
            }
        }
        hideSuggestions();
    } catch (e) {
        hideSuggestions();
    }
}

function handleMicMuteToggle() {
    isMuted = !isMuted;
    if (isMuted) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (dom.muteBtn) {
            dom.muteBtn.classList.add("active");
            dom.muteBtn.innerText = "Unmute Mic";
            dom.muteBtn.style.background = "#f44336";
        }
    } else {
        if (dom.muteBtn) {
            dom.muteBtn.classList.remove("active");
            dom.muteBtn.innerText = "Mute Mic";
            dom.muteBtn.style.background = "";
        }
    }
}

function sendMessage() {
    const userText = dom.userInput.value.trim();
    if (!userText) return;

    hideSuggestions();

    appendMessage("You", userText);
    dom.userInput.value = "";

    dom.sendBtn.disabled = true;
    dom.sendBtn.innerText = "Analyzing...";
    updateExpression("thinking");

    setTimeout(() => {
        processMessage(userText);
        dom.sendBtn.disabled = false;
        dom.sendBtn.innerText = "Send";
    }, 500);
}

dom.sendBtn.addEventListener("click", sendMessage);
if (dom.muteBtn) {
    dom.muteBtn.addEventListener("click", handleMicMuteToggle);
}
dom.nemoContainer.addEventListener("click", handlePoke);

dom.userInput.addEventListener("input", (event) => {
    const val = event.target.value.trim();
    clearTimeout(searchTimeout);
    if (!val || val.length < 2) {
        hideSuggestions();
        return;
    }
    searchTimeout = setTimeout(() => {
        fetchSuggestions(val);
    }, 600);
});

dom.userInput.addEventListener("keydown", (event) => {
    if (event.key === 'Enter') {
        hideSuggestions();
        sendMessage();
    }
});

// Close suggestions when clicking outside
document.addEventListener("click", (e) => {
    if (!dom.userInput.contains(e.target) && !suggestionBox.contains(e.target)) {
        hideSuggestions();
    }
});
