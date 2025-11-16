// State management
let themes = [];
let isSubmitting = false;

// DOM elements
const themeForm = document.getElementById('themeForm');
const themeInput = document.getElementById('themeInput');
const themesList = document.getElementById('themesList');
const charCount = document.getElementById('charCount');
const themeCount = document.getElementById('themeCount');
const formMessage = document.getElementById('formMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadThemes();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    themeForm.addEventListener('submit', handleSubmit);
    themeInput.addEventListener('input', updateCharCount);
}

// Update character count
function updateCharCount() {
    const count = themeInput.value.length;
    charCount.textContent = count;
    charCount.parentElement.classList.toggle('warning', count > 45);
}

// Load themes from API
async function loadThemes() {
    try {
        const response = await fetch('/api/themes');
        if (!response.ok) throw new Error('Failed to load themes');
        
        themes = await response.json();
        renderThemes();
    } catch (error) {
        showMessage('Failed to load themes. Please refresh the page.', 'error');
    }
}

// Render themes
function renderThemes() {
    updateThemeCount();
    
    if (themes.length === 0) {
        themesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>No themes yet. Be the first to add one!</p>
            </div>
        `;
        return;
    }
    
    themesList.innerHTML = themes.map(theme => `
        <div class="theme-card ${theme.completed ? 'completed' : ''}" data-id="${theme.id}">
            <div class="theme-content">
                <div class="theme-text">${escapeHtml(theme.content)}${theme.completed ? ' <span class="done-badge">[DONE]</span>' : ''}</div>
                <div class="theme-meta">
                    <span class="theme-date">${formatDate(theme.created_at)}</span>
                </div>
            </div>
            <button 
                class="vote-btn" 
                onclick="handleVote(${theme.id})"
                aria-label="Upvote"
                ${theme.completed ? 'disabled' : ''}
            >
                <span class="vote-icon">▲</span>
                <span class="vote-count">${theme.votes}</span>
            </button>
        </div>
    `).join('');
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const content = themeInput.value.trim();
    
    if (!content) {
        showMessage('Please enter a theme', 'error');
        return;
    }
    
    if (content.length > 50) {
        showMessage('Theme must be 50 characters or less', 'error');
        return;
    }
    
    isSubmitting = true;
    const submitBtn = themeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    try {
        const response = await fetch('/api/themes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add theme');
        }
        
        // Success
        themes.unshift(data);
        themes.sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
        renderThemes();
        
        themeInput.value = '';
        updateCharCount();
        showMessage('Theme added successfully! 🎉', 'success');
        
        // Highlight the new theme
        setTimeout(() => {
            const newCard = document.querySelector(`[data-id="${data.id}"]`);
            if (newCard) {
                newCard.classList.add('highlight');
                newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                setTimeout(() => newCard.classList.remove('highlight'), 2000);
            }
        }, 100);
        
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

// Handle vote
async function handleVote(id) {
    const voteBtn = document.querySelector(`[data-id="${id}"] .vote-btn`);
    if (voteBtn.classList.contains('voting')) return;
    
    voteBtn.classList.add('voting');
    
    try {
        const response = await fetch(`/api/themes/${id}/upvote`, {
            method: 'POST',
        });
        
        if (!response.ok) throw new Error('Failed to vote');
        
        const updatedTheme = await response.json();
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = updatedTheme;
            themes.sort((a, b) => b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at));
            renderThemes();
        }
        
        // Add success animation
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.classList.add('voted');
            setTimeout(() => card.classList.remove('voted'), 600);
        }
        
    } catch (error) {
        showMessage('Failed to vote. Please try again.', 'error');
    } finally {
        voteBtn.classList.remove('voting');
    }
}

// Update theme count
function updateThemeCount() {
    const count = themes.length;
    themeCount.textContent = `${count} ${count === 1 ? 'theme' : 'themes'}`;
}

// Show message
function showMessage(text, type = 'info') {
    formMessage.textContent = text;
    formMessage.className = `message ${type} show`;
    
    setTimeout(() => {
        formMessage.classList.remove('show');
    }, 5000);
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

