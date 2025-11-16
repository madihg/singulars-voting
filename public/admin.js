// Get admin token from URL
const urlPath = window.location.pathname;
const adminToken = urlPath.split('/').pop();

// State management
let themes = [];
let editingId = null;

// DOM elements
const adminThemeForm = document.getElementById('adminThemeForm');
const adminThemeInput = document.getElementById('adminThemeInput');
const adminThemesList = document.getElementById('adminThemesList');
const adminCharCount = document.getElementById('adminCharCount');
const adminFormMessage = document.getElementById('adminFormMessage');
const totalThemesEl = document.getElementById('totalThemes');
const totalVotesEl = document.getElementById('totalVotes');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadThemes();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    adminThemeForm.addEventListener('submit', handleAdminSubmit);
    adminThemeInput.addEventListener('input', updateCharCount);
}

// Update character count
function updateCharCount() {
    const count = adminThemeInput.value.length;
    adminCharCount.textContent = count;
    adminCharCount.parentElement.classList.toggle('warning', count > 45);
}

// Load themes from API
async function loadThemes() {
    try {
        const response = await fetch('/api/themes');
        if (!response.ok) throw new Error('Failed to load themes');
        
        themes = await response.json();
        renderThemes();
        updateStats();
    } catch (error) {
        showMessage('Failed to load themes. Please refresh the page.', 'error');
    }
}

// Update statistics
function updateStats() {
    totalThemesEl.textContent = themes.length;
    totalVotesEl.textContent = themes.reduce((sum, theme) => sum + theme.votes, 0);
}

// Render themes
function renderThemes() {
    if (themes.length === 0) {
        adminThemesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>No themes yet.</p>
            </div>
        `;
        return;
    }
    
    adminThemesList.innerHTML = themes.map(theme => `
        <div class="theme-card ${theme.completed ? 'completed' : ''}" data-id="${theme.id}">
            ${editingId === theme.id ? `
                <div class="edit-form">
                    <input 
                        type="text" 
                        value="${escapeHtml(theme.content)}" 
                        id="editInput-${theme.id}"
                        maxlength="50"
                        autofocus
                    >
                    <button class="save" onclick="saveEdit(${theme.id})">Save</button>
                    <button class="cancel" onclick="cancelEdit()">Cancel</button>
                </div>
            ` : `
                <div class="theme-content">
                    <div class="theme-text">${escapeHtml(theme.content)}${theme.completed ? ' <span class="done-badge">[DONE]</span>' : ''}</div>
                    <div class="theme-meta">
                        <span class="theme-date">${formatDate(theme.created_at)}</span>
                    </div>
                </div>
                <div class="vote-btn">
                    <span class="vote-icon">▲</span>
                    <span class="vote-count">${theme.votes}</span>
                </div>
                <div class="admin-actions">
                    <label class="checkbox-container" title="${theme.completed ? 'Mark as incomplete' : 'Mark as done'}">
                        <input 
                            type="checkbox" 
                            ${theme.completed ? 'checked' : ''} 
                            onchange="toggleComplete(${theme.id})"
                        >
                        <span class="checkbox-label">Done</span>
                    </label>
                    <button class="admin-btn edit" onclick="startEdit(${theme.id})">Edit</button>
                    <button class="admin-btn delete" onclick="deleteTheme(${theme.id})">Delete</button>
                </div>
            `}
        </div>
    `).join('');
}

// Handle form submission
async function handleAdminSubmit(e) {
    e.preventDefault();
    
    const content = adminThemeInput.value.trim();
    
    if (!content) {
        showMessage('Please enter a theme', 'error');
        return;
    }
    
    if (content.length > 50) {
        showMessage('Theme must be 50 characters or less', 'error');
        return;
    }
    
    const submitBtn = adminThemeForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/themes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken,
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
        updateStats();
        
        adminThemeInput.value = '';
        updateCharCount();
        showMessage('Theme added successfully! 🎉', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

// Start editing a theme
function startEdit(id) {
    editingId = id;
    renderThemes();
}

// Cancel editing
function cancelEdit() {
    editingId = null;
    renderThemes();
}

// Save edited theme
async function saveEdit(id) {
    const input = document.getElementById(`editInput-${id}`);
    const content = input.value.trim();
    
    if (!content) {
        showMessage('Theme cannot be empty', 'error');
        return;
    }
    
    if (content.length > 50) {
        showMessage('Theme must be 50 characters or less', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/themes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken,
            },
            body: JSON.stringify({ content }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to update theme');
        }
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = data;
        }
        
        editingId = null;
        renderThemes();
        showMessage('Theme updated successfully! ✅', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Toggle theme completed status
async function toggleComplete(id) {
    try {
        const response = await fetch(`/api/admin/themes/${id}/toggle-complete`, {
            method: 'PATCH',
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to toggle completion');
        }
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = data;
        }
        
        renderThemes();
        showMessage(data.completed ? 'Theme marked as done! ✓' : 'Theme marked as incomplete', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
        // Revert checkbox on error
        renderThemes();
    }
}

// Delete a theme
async function deleteTheme(id) {
    if (!confirm('Are you sure you want to delete this theme? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/themes/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete theme');
        }
        
        // Remove from local state
        themes = themes.filter(t => t.id !== id);
        renderThemes();
        updateStats();
        showMessage('Theme deleted successfully! 🗑️', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Show message
function showMessage(text, type = 'info') {
    adminFormMessage.textContent = text;
    adminFormMessage.className = `message ${type} show`;
    
    setTimeout(() => {
        adminFormMessage.classList.remove('show');
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

