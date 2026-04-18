// Protect route
const auth_token = localStorage.getItem('meetingbot_token');
if (!auth_token) {
    window.location.href = '../auth/login.html';
}

let botname=document.getElementById("botname");
let link=document.getElementById("link");
let submit=document.getElementById("submit");

let meetingTimerInterval = null;
let currentPendingPurchase = null;

// Initialize store and display 
window.addEventListener("load", () => {
    // Wipe legacy keys once to fix unlimited debug status.
    if (!localStorage.getItem('sys_reset_v2')) {
        localStorage.removeItem('subscriptionStatus');
        localStorage.setItem('transcribeCredits', '5');
        localStorage.setItem('sys_reset_v2', 'true');
    }

    updateHomepageCredits();
    
    const userName = localStorage.getItem('meetingbot_user_name') || 'User';
    document.getElementById('auth_user_display').innerText = `Welcome, ${userName}`;
});

document.getElementById('logout_btn').addEventListener('click', () => {
    localStorage.removeItem('meetingbot_token');
    localStorage.removeItem('meetingbot_user_name');
    window.location.href = '../auth/login.html';
});

function updateHomepageCredits() {
    let subStatus = localStorage.getItem("subscriptionStatus");
    let creditsDisplay = document.getElementById("home_credits_display");
    
    if (subStatus && subStatus !== "none") {
        creditsDisplay.innerText = "Status: Unlimited (" + subStatus + ")";
        creditsDisplay.style.color = "#ffeb3b";
    } else {
        let credits = localStorage.getItem("transcribeCredits");
        if (credits === null) {
            credits = 5;
            localStorage.setItem("transcribeCredits", credits);
        }
        creditsDisplay.innerText = `Credits: ${credits}`;
        creditsDisplay.style.color = "white";
    }
}

submit.addEventListener("click",submited);

async function submited(e){
    e.preventDefault();
    let linkValue = link.value.trim();
    let botnameValue = botname.value.trim();
    
    if(linkValue === ""){
        alert("Enter the Google Meet link first");
        return;
    }
    
    let subStatus = localStorage.getItem("subscriptionStatus");
    let isUnlimited = (subStatus && subStatus !== "none");
    let credits = parseInt(localStorage.getItem("transcribeCredits")) || 0;

    if (!isUnlimited && credits <= 0) {
        alert("Out of credits! Please purchase a subscription or more credits from the store.");
        return;
    }

    try {
        // Ping backend to officially launch the headless chromium bot
        await fetch('http://localhost:3000/api/bot/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link: linkValue, botname: botnameValue })
        });
    } catch (e) {
        alert("Backend bot server is not running!");
        return;
    }

    // Hide form, show transcribing
    document.getElementById("form_section").classList.add("hidden");
    document.getElementById("transcribing_section").classList.remove("hidden");
    
    const loader = document.getElementById("loader");
    loader.style.display = "block"; // reset display if used multiple times
    
    // We let the bot spin indefinitely until STOP is pressed!
    document.getElementById("loading_text").innerText = "Bot deployed to the meeting...";
    
    // Start Live Clock Logic
    let secondsElapsed = 0;
    const timerDisplay = document.getElementById("meeting_timer");
    timerDisplay.innerText = "00:00";
    
    if (meetingTimerInterval) clearInterval(meetingTimerInterval);
    meetingTimerInterval = setInterval(() => {
        secondsElapsed++;
        let m = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
        let s = (secondsElapsed % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${m}:${s}`;
    }, 1000);
}

const stopButton = document.getElementById("stop_button");
const transcriptModal = document.getElementById("transcriptModal");
const closeModalBtn = document.getElementById("closeModal");
const botTextDisplay = document.getElementById("botText");

stopButton.addEventListener("click", async () => {
    let subStatus = localStorage.getItem("subscriptionStatus");
    let isUnlimited = (subStatus && subStatus !== "none");
    let credits = parseInt(localStorage.getItem("transcribeCredits")) || 0;
    
    // Kill the timer
    if (meetingTimerInterval) {
        clearInterval(meetingTimerInterval);
    }
    
    if (isUnlimited || credits > 0) {
        if (!isUnlimited) {
            credits -= 1;
            localStorage.setItem("transcribeCredits", credits);
            updateHomepageCredits(); // Update header count instantly
        }
        
        // Output temporary loading text
        botTextDisplay.innerHTML = "<em>Analyzing meeting audio and generating AI summary...</em>";
        
        // Hide transcribing and show the original form view again
        document.getElementById("transcribing_section").classList.add("hidden");
        document.getElementById("form_section").classList.remove("hidden");
        
        // Bring up modal immediately so they can see it working
        transcriptModal.showModal(); 
        
        try {
            const res = await fetch("http://localhost:3000/api/bot/summarize", {
                method: "POST"
            });
            const data = await res.json();
            if (res.ok) {
                botTextDisplay.innerHTML = "<strong>Meeting Summary:</strong><br><br>" + data.summary.replace(/\n/g, '<br>');
            } else {
                botTextDisplay.innerText = "AI Error: " + data.error;
            }
        } catch (err) {
            botTextDisplay.innerText = "Communication error connecting to backend pipeline.";
        }

    } else {
        alert("Out of credits!");
        document.getElementById("transcribing_section").classList.add("hidden");
        document.getElementById("form_section").classList.remove("hidden");
    }
});

closeModalBtn.addEventListener("click", () => {
    transcriptModal.close();
});

const storeModal = document.getElementById("storeModal");
const openStoreBtn = document.getElementById("open_store_btn");
const closeStoreBtn = document.getElementById("close_store_btn");

openStoreBtn.addEventListener("click", () => {
    storeModal.showModal();
});

closeStoreBtn.addEventListener("click", () => {
    storeModal.close();
});

const paymentModal = document.getElementById("paymentModal");

function buyCredits() {
    let subStatus = localStorage.getItem("subscriptionStatus");
    if (subStatus && subStatus !== "none") {
        alert("You already have an Unlimited Subscription!");
        return;
    }
    currentPendingPurchase = { type: 'credits', amount: 5 };
    document.getElementById("payment_item_label").innerText = "5 Premium Transcriptions";
    document.getElementById("payment_price_label").innerText = "$50";
    storeModal.close();
    paymentModal.showModal();
}

function buySubscription(planType) {
    currentPendingPurchase = { type: 'subscription', plan: planType };
    document.getElementById("payment_item_label").innerText = `${planType.charAt(0).toUpperCase() + planType.slice(1)} Unlimited Subscription`;
    if (planType === 'monthly') document.getElementById("payment_price_label").innerText = "$20 / mo";
    else if (planType === 'yearly') document.getElementById("payment_price_label").innerText = "$200 / yr";
    else document.getElementById("payment_price_label").innerText = "$500";
    
    storeModal.close();
    paymentModal.showModal();
}

document.getElementById("cancel_payment_btn").addEventListener("click", () => {
    paymentModal.close();
    currentPendingPurchase = null;
});

document.getElementById("confirm_payment_btn").addEventListener("click", () => {
    if (!currentPendingPurchase) return;
    
    // Simulate payment processing loader/delay
    const btn = document.getElementById("confirm_payment_btn");
    btn.innerText = "Processing...";
    btn.disabled = true;
    
    setTimeout(() => {
        if (currentPendingPurchase.type === 'credits') {
            let credits = parseInt(localStorage.getItem("transcribeCredits")) || 0;
            credits += 5;
            localStorage.setItem("transcribeCredits", credits);
        } else if (currentPendingPurchase.type === 'subscription') {
            localStorage.setItem("subscriptionStatus", currentPendingPurchase.plan);
        }
        
        alert("Payment Successful! Your account has been updated.");
        updateHomepageCredits();
        
        btn.innerText = "Confirm Payment";
        btn.disabled = false;
        paymentModal.close();
        currentPendingPurchase = null;
    }, 1500);
});
