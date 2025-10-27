// Theme management for chat interface
import { preferences } from './storage.js';

export class ChatTheme {
    constructor() {
        this.defaultThemes = {
            dark: {
                name: 'Dark',
                background: '#111a24',
                messageBackground: '#1a2738',
                textColor: '#e6eef6',
                accentColor: '#1976ff'
            },
            light: {
                name: 'Light',
                background: '#f8f9fa',
                messageBackground: '#ffffff',
                textColor: '#2c3e50',
                accentColor: '#1976ff'
            },
            forest: {
                name: 'Forest',
                background: '#1a472a',
                messageBackground: '#2d5a3f',
                textColor: '#e0f5e9',
                accentColor: '#5cdb95'
            },
            ocean: {
                name: 'Ocean',
                background: '#1a3a4a',
                messageBackground: '#234b61',
                textColor: '#e3f2fd',
                accentColor: '#64b5f6'
            }
        };
        
        // Load saved theme
        this.currentTheme = preferences.get('chatTheme', this.defaultThemes.dark);
        this.customBackground = preferences.get('chatBackground', '');
    }

    // Apply theme to chat interface
    apply() {
        const chat = document.querySelector('.chat');
        const messages = document.querySelector('.messages');
        const input = document.querySelector('.chat-input');

        if (this.customBackground) {
            chat.style.backgroundImage = `url(${this.customBackground})`;
            chat.style.backgroundSize = 'cover';
            chat.style.backgroundPosition = 'center';
        } else {
            chat.style.background = this.currentTheme.background;
            chat.style.backgroundImage = 'none';
        }

        messages.style.backgroundColor = this.customBackground ? 'rgba(0,0,0,0.5)' : 'transparent';
        input.style.backgroundColor = this.customBackground ? 'rgba(0,0,0,0.7)' : this.currentTheme.messageBackground;
        
        document.documentElement.style.setProperty('--chat-text', this.currentTheme.textColor);
        document.documentElement.style.setProperty('--chat-accent', this.currentTheme.accentColor);
    }

    // Change theme
    setTheme(themeName) {
        if (this.defaultThemes[themeName]) {
            this.currentTheme = this.defaultThemes[themeName];
            preferences.set('chatTheme', this.currentTheme);
            this.apply();
        }
    }

    // Set custom background
    setCustomBackground(imageUrl) {
        this.customBackground = imageUrl;
        preferences.set('chatBackground', imageUrl);
        this.apply();
    }

    // Add theme selector UI
    addThemeSelector(container) {
        const themeSelect = document.createElement('div');
        themeSelect.className = 'theme-selector';
        themeSelect.innerHTML = `
            <h4>Choose Theme</h4>
            <div class="theme-options">
                ${Object.keys(this.defaultThemes).map(theme => `
                    <button class="theme-option" data-theme="${theme}">
                        ${this.defaultThemes[theme].name}
                    </button>
                `).join('')}
            </div>
            <div class="background-upload">
                <h4>Custom Background</h4>
                <input type="file" accept="image/*" id="bgUpload">
                <button id="clearBg">Clear Background</button>
            </div>
        `;

        container.appendChild(themeSelect);

        // Add event listeners
        themeSelect.querySelectorAll('.theme-option').forEach(btn => {
            btn.onclick = () => this.setTheme(btn.dataset.theme);
        });

        document.getElementById('bgUpload').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => this.setCustomBackground(e.target.result);
                reader.readAsDataURL(file);
            }
        };

        document.getElementById('clearBg').onclick = () => {
            this.setCustomBackground('');
            document.getElementById('bgUpload').value = '';
        };
    }
}