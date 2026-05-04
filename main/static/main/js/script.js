// TAB SYSTEM - Updated for Single Page Scrolling
function showTab(tabId) {
    const targetElement = document.getElementById(tabId);
    if (targetElement) {
        // Smooth scroll to section
        const navHeight = 80; // Adjust based on your navbar height
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }

    // Update active button state
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[onclick="showTab('${tabId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Close mobile menu
    const menu = document.getElementById("mobileMenu");
    if (menu && !menu.classList.contains("hidden")) {
        menu.classList.add("hidden");
    }

    // Update URL without reloading page
    const newPath = tabId === 'home' ? '/' : `/${tabId}/`;
    history.pushState(null, "", newPath);
    localStorage.setItem("activeTab", tabId);
}


// GLOBAL CHAT STATE
let isSending = false;


// Run after DOM loads
document.addEventListener("DOMContentLoaded", () => {

    // Initial Scroll if page is loaded via /projects/ etc.
    const savedTab = window.INITIAL_TAB || localStorage.getItem("activeTab") || "home";
    if (savedTab !== "home") {
        setTimeout(() => showTab(savedTab), 100);
    }

    // ANIMATION
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // Load chat history from server
    loadChatHistory();

    updateClearButtonState(false);
    
    const inputEl = document.getElementById("userInput");
    if(inputEl) {
        // ENTER KEY
        inputEl.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                if (e.shiftKey) return;
                e.preventDefault();
                if (!isSending) sendMessage();
            }
        });

        // Prevent typing while sending
        inputEl.addEventListener("input", () => {
            if (isSending) inputEl.value = "";
        });
    }
});


// Load history from Django session
async function loadChatHistory() {
    const chatBox = document.getElementById("chatBox");
    if(!chatBox) return;
    
    try {
        const res = await fetch("/chat/history/", {
            method: "GET",
            headers: { "X-CSRFToken": getCookie("csrftoken") }
        });
        
        if (res.ok) {
            const data = await res.json();
            const history = data.history || [];
            
            chatBox.innerHTML = '';
            
            if (history.length === 0) {
                chatBox.innerHTML = `<div id="emptyState" class="text-center text-gray-400 mt-20">
                    <p class="text-lg">Ask me anything about my experience 👇</p>
                </div>`;
            } else {
                history.forEach(msg => renderMessage(msg.text, msg.type));
            }

            updateClearButtonState(history.length > 0);
        }
    } catch (e) {
        console.error("Failed to load chat history");
    }
}


function updateClearButtonState(history = null) {
    const clearBtn = document.getElementById("clearBtn");
    if (!clearBtn) return;

    if (history === null) {
        const messages = document.querySelectorAll("#chatBox > div:not(#emptyState)");
        history = messages.length > 0;
    }

    clearBtn.disabled = isSending || !history;
}

// Markdown render
function formatText(text) {
    return marked.parse(text);
}


// Render message
function renderMessage(text, type) {
    const chatBox = document.getElementById("chatBox");
    if(!chatBox) return;
    document.getElementById("emptyState")?.remove();

    const div = document.createElement("div");
    div.className = type === "user" ? "text-right" : "text-left";

    const bubble = document.createElement("div");
    bubble.className = `inline-block px-4 py-2 rounded-2xl max-w-[80%] ${
        type === "user" ? "bg-white text-black" : "bg-gray-700 text-gray-100"
    }`;

    bubble.innerHTML = formatText(text);
    div.appendChild(bubble);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}


// Typing effect
function typeMessage(text, container) {
    return new Promise(resolve => {
        let i = 0;
        function type() {
            if (i <= text.length) {
                container.innerHTML = marked.parse(text.slice(0, i));
                i++;
                const chatBox = document.getElementById("chatBox");
                if(chatBox) chatBox.scrollTop = 999999;
                setTimeout(type, 5);
            } else {
                resolve();
            }
        }
        type();
    });
}


// SEND MESSAGE
async function sendMessage() {
    if (isSending) return;

    const chatBox = document.getElementById("chatBox");
    const inputEl = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const clearBtn = document.getElementById("clearBtn");

    if(!inputEl) return;
    const input = inputEl.value.trim();
    if (!input) return;

    isSending = true;
    inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    renderMessage(input, "user");
    inputEl.value = "";

    const loading = document.createElement("div");
    loading.innerHTML = `<span class="bg-gray-700 px-4 py-2 rounded-2xl animate-pulse">Thinking...</span>`;
    chatBox.appendChild(loading);

    try {
        const res = await fetch("/chat/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify({ message: input })
        });

        const data = await res.json();
        loading.remove();

        const div = document.createElement("div");
        div.className = "text-left";
        const bubble = document.createElement("div");
        bubble.className = "bg-gray-700 text-gray-100 px-4 py-2 rounded-2xl max-w-[80%]";
        div.appendChild(bubble);
        chatBox.appendChild(div);

        await typeMessage(data.response, bubble);

        isSending = false;
        inputEl.disabled = false;
        if (sendBtn) sendBtn.disabled = false;

        updateClearButtonState();
        inputEl.focus();

    } catch (err) {
        console.error(err);
        loading.remove();
        renderMessage("Error connecting to AI service.", "bot");

        isSending = false;
        inputEl.disabled = false;
        if (sendBtn) sendBtn.disabled = false;

        updateClearButtonState();
    }
}

// Clear Chat Function
function clearChat() {
    if (!confirm("Clear entire chat history?")) return;

    fetch("/chat/clear/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") }
    }).then(() => {
        loadChatHistory();
        updateClearButtonState(false);
    }).catch(err => {
        console.error(err);
        alert("Failed to clear chat.");
    });
}

// CSRF
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie) {
        document.cookie.split(';').forEach(cookie => {
            if (cookie.trim().startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.split('=')[1]);
            }
        });
    }
    return cookieValue;
}


// MOBILE MENU TOGGLE
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("menuToggle");
    const menu = document.getElementById("mobileMenu");

    if (toggle) {
        toggle.addEventListener("click", () => menu.classList.toggle("hidden"));
    }
});

document.addEventListener("click", (e) => {
    const menu = document.getElementById("mobileMenu");
    const toggle = document.getElementById("menuToggle");
    if (!menu || !toggle) return;
    if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.add("hidden");
    }
});

// POPSTATE for back button support
window.addEventListener("popstate", () => {
    const path = window.location.pathname.replace(/\//g, "");
    const tab = path || "home";
    const targetElement = document.getElementById(tab);
    if(targetElement){
        const navHeight = 80;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
});