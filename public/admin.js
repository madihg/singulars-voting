// Get admin token from URL
const urlPath = window.location.pathname;
let adminToken = urlPath.split('/').pop();

// If accessing via admin.html, extract token from query param or use default
if (adminToken === 'admin.html' || !adminToken || adminToken === 'admin') {
    const urlParams = new URLSearchParams(window.location.search);
    adminToken = urlParams.get('token') || 'a7f3e9b2-4d8c-4a1e-9f6b-3c7d2e8a5b4f';
}

// State management
let themes = [];
let editingId = null;

// DOM elements
const adminThemeForm = document.getElementById('adminThemeForm');
const adminThemeInput = document.getElementById('adminThemeInput');
const activeThemesList = document.getElementById('activeThemesList');
const completedThemesList = document.getElementById('completedThemesList');
const archivedThemesList = document.getElementById('archivedThemesList');
const adminCharCount = document.getElementById('adminCharCount');
const adminFormMessage = document.getElementById('adminFormMessage');
const totalThemesEl = document.getElementById('totalThemes');
const totalVotesEl = document.getElementById('totalVotes');
const completedSection = document.getElementById('completedSection');
const archivedSection = document.getElementById('archivedSection');

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
        const response = await fetch('/api/themes', {
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        if (!response.ok) throw new Error('Failed to load themes');
        
        themes = await response.json();
        console.log('Loaded themes:', themes);
        console.log('Admin token:', adminToken);
        renderThemes();
        updateStats();
    } catch (error) {
        console.error('Load themes error:', error);
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
    // Separate themes into three categories
    const activeThemes = themes.filter(t => !t.archived && !t.completed);
    const completedThemes = themes.filter(t => !t.archived && t.completed);
    const archivedThemes = themes.filter(t => t.archived);
    
    // Render active themes
    if (activeThemes.length === 0) {
        activeThemesList.innerHTML = `
            <div class="empty-state">
                <p>No active themes yet.</p>
            </div>
        `;
    } else {
        activeThemesList.innerHTML = activeThemes.map(theme => renderThemeCard(theme)).join('');
    }
    
    // Render completed themes section
    if (completedThemes.length === 0) {
        completedSection.style.display = 'none';
    } else {
        completedSection.style.display = 'block';
        completedThemesList.innerHTML = completedThemes.map(theme => renderThemeCard(theme)).join('');
    }
    
    // Render archived themes section
    if (archivedThemes.length === 0) {
        archivedSection.style.display = 'none';
    } else {
        archivedSection.style.display = 'block';
        archivedThemesList.innerHTML = archivedThemes.map(theme => renderThemeCard(theme)).join('');
    }
}

// Render a single theme card
function renderThemeCard(theme) {
    return `
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
                    <button class="save" onclick="window.saveEdit(${theme.id})">Save</button>
                    <button class="cancel" onclick="window.cancelEdit()">Cancel</button>
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
                            onchange="window.toggleComplete(${theme.id})"
                        >
                        <span class="checkbox-label">Done</span>
                    </label>
                    <button class="admin-btn ${theme.archived ? 'show' : 'archive'}" onclick="window.toggleArchived(${theme.id})" title="${theme.archived ? 'Unarchive theme' : 'Archive theme'}" data-theme-id="${theme.id}">
                        ${theme.archived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button class="admin-btn edit" onclick="window.startEdit(${theme.id})">Edit</button>
                    <button class="admin-btn delete" onclick="window.deleteTheme(${theme.id})">Delete</button>
                </div>
            `}
        </div>
    `;
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
        showMessage('Theme added successfully!', 'success');
        
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
        showMessage('Theme updated successfully!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Toggle theme archived status
async function toggleArchived(id) {
    try {
        const response = await fetch(`/api/admin/themes/${id}/toggle-archived`, {
            method: 'PATCH',
            headers: {
                'X-Admin-Token': adminToken,
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to toggle archive status');
        }
        
        const data = await response.json();
        
        // Normalize archived value
        const normalizedArchived = data.archived === null || data.archived === undefined ? 0 : (parseInt(data.archived) || 0);
        data.archived = normalizedArchived;
        
        // Update local state
        const index = themes.findIndex(t => t.id === id);
        if (index !== -1) {
            themes[index] = { ...themes[index], ...data, archived: normalizedArchived };
        }
        
        renderThemes();
        updateStats();
        
        const isArchived = normalizedArchived === 1;
        showMessage(isArchived ? 'Theme archived' : 'Theme unarchived', 'success');
        
    } catch (error) {
        showMessage(error.message || 'Failed to toggle archive status', 'error');
        renderThemes();
    }
}

// Make functions available globally for inline onclick handlers
window.toggleArchived = toggleArchived;
window.toggleComplete = toggleComplete;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteTheme = deleteTheme;

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
        showMessage(data.completed ? 'Theme marked as done!' : 'Theme marked as incomplete', 'success');
        
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
        showMessage('Theme deleted successfully!', 'success');
        
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

