const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'super-secret-key-for-jwt-testing';
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

// Helper logic to read/write users from a JSON file to persist between restarts safely
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ----------------------
// Auth Routes
// ----------------------

// 1. Sign Up
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const users = readUsers();
        
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists.' });
        }

        // Hash password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: hashedPassword
        };
        
        users.push(newUser);
        saveUsers(users);

        // Generate Token
        const token = jwt.sign({ id: newUser.id, email: newUser.email }, SECRET_KEY, { expiresIn: '1d' });

        res.status(201).json({ message: 'User created successfully', token, user: { name, email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const users = readUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1d' });

        res.json({ message: 'Logged in successfully', token, user: { name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// 3. Reset Password
app.post('/api/auth/reset', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const users = readUsers();
        let userIndex = users.findIndex(u => u.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'User with this email not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        users[userIndex].password = hashedPassword;
        saveUsers(users);

        res.json({ message: 'Password reset successful. Redirecting...' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during password reset.' });
    }
});


// Simple protected route to verify tokens in the future
app.get('/api/auth/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) return res.status(403).json({ error: 'Token invalid' });
            res.json({ valid: true, user });
        });
    } else {
        res.status(401).json({ error: 'No token provided' });
    }
});

require('dotenv').config();

// ----------------------
// Bot & GenAI Routes
// ----------------------
const { startBot, stopBot } = require('./bot');

app.post('/api/bot/start', async (req, res) => {
    const { link, botname } = req.body;
    if (!link) {
        return res.status(400).json({ error: "G-Meet Link is required." });
    }
    
    // Fire and forget the bot launch so the frontend isn't blocked
    startBot(link, botname || "MeetingBot Scribe");
    res.json({ message: "Bot deployment sequence initiated." });
});

app.post('/api/bot/summarize', async (req, res) => {
    try {
        // Shutdown bot and retrieve whatever text it scraped natively or fallback
        const rawTranscript = await stopBot();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            return res.json({
                summary: "[Mock Summary] Wait, I couldn't find your GEMINI_API_KEY in backend/.env!\nHere is the raw text the bot successfully scraped instead: \n\n" + rawTranscript.substring(0, 300) + '...'
            });
        }

        try {
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            
            const prompt = "Please summarize the following meeting transcript into a concise professional summary with bullet points and action items.\\n\\n" + rawTranscript;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            res.json({ summary: response.text });
        } catch (apiErr) {
            console.error('Gemini API Error details:', apiErr.message);
            // Guaranteed fallback if API is invalid so the user demo never crashes
            return res.json({
                summary: "[Fallback Summary - Invalid API Key] Your Gemini API request failed (likely because you don't have a valid key).\n\nTo save your presentation, here is the raw text your advanced Puppeteer bot successfully scraped natively from the Google Meet captions instead! \n\n" + rawTranscript.substring(0, 1500)
            });
        }
    } catch (err) {
        console.error('Core Server Error:', err);
        res.status(500).json({ error: 'Critical failure reading bot output.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running securely on http://localhost:${PORT}`);
});
