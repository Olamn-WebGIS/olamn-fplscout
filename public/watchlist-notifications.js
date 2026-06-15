/**
 * Watchlist Notifications Service
 * Monitors watched rival managers for activity and sends notifications
 * Checks every 5 minutes for transfers, captain changes, and chip usage
 */

const WatchlistNotifications = (() => {
  let checkInterval = null;
  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let currentUser = null;
  let watchedRivals = [];
  
  // Request browser notification permissions
  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('📢 Browser notifications not supported');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (e) {
        console.error('Error requesting notification permission:', e);
        return false;
      }
    }
    
    return false;
  }
  
  // Show browser notification
  function showBrowserNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }
  
  // Show in-app notification (toast)
  function showInAppNotification(message, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
  
  // Check single rival for activity
  async function checkRivalActivity(managerId, rivalName) {
    try {
      if (!currentUser) return null;
      
      const response = await fetch('/api/watchlist/check-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          managerId: managerId
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (!data.success) {
        console.error(`❌ Failed to check activity for ${rivalName}:`, data.message);
        return null;
      }
      
      return {
        managerId,
        rivalName,
        hasChanges: data.hasChanges,
        changes: data.changes,
        currentActivity: data.currentActivity
      };
      
    } catch (e) {
      console.error(`Error checking activity for ${rivalName}:`, e);
      return null;
    }
  }
  
  // Process activity changes
  async function processActivityChanges(rival, bootstrapData) {
    const { managerId, rivalName, changes } = rival;
    
    if (!bootstrapData || !bootstrapData.elements || !bootstrapData.teams) {
      console.warn('⚠️ Bootstrap data unavailable for notifications');
      return;
    }
    
    // New transfers
    if (changes.newTransfers && changes.newTransfers.length > 0) {
      const transfer = changes.newTransfers[0];
      const playerIn = bootstrapData.elements.find(p => p.id === transfer.element_in);
      const playerOut = bootstrapData.elements.find(p => p.id === transfer.element_out);
      
      if (playerIn && playerOut) {
        const message = `🔄 ${rivalName} transferred out ${playerOut.web_name} for ${playerIn.web_name}`;
        
        // Show both notifications
        showInAppNotification(message, 'info');
        showBrowserNotification('⚡ Rival Activity Alert', {
          body: message,
          tag: `transfer-${managerId}-${transfer.id}`
        });
        
        // Record notification sent
        await recordNotificationSent(managerId, 'transfer');
      }
    }
    
    // New captain
    if (changes.newCaptain) {
      const captain = bootstrapData.elements.find(p => p.id === changes.newCaptain);
      if (captain) {
        const message = `🎖 ${rivalName} selected ${captain.web_name} as captain`;
        
        showInAppNotification(message, 'info');
        showBrowserNotification('⚡ Rival Activity Alert', {
          body: message,
          tag: `captain-${managerId}`
        });
        
        await recordNotificationSent(managerId, 'captain');
      }
    }
    
    // New chip
    if (changes.newChip) {
      const chip = changes.newChip;
      const chipNames = {
        'wildcard': '🃏 Wildcard',
        'bboost': '📊 Bench Boost',
        'freehit': '⚡ Free Hit',
        '3xc': '👑 Triple Captain'
      };
      
      const chipLabel = chipNames[chip.name] || chip.name;
      const message = `${chipLabel} activated by ${rivalName} in GW${chip.event}`;
      
      showInAppNotification(message, 'info');
      showBrowserNotification('⚡ Rival Activity Alert', {
        body: message,
        tag: `chip-${managerId}-${chip.event}`
      });
      
      await recordNotificationSent(managerId, 'chip');
    }
  }
  
  // Record that a notification was sent
  async function recordNotificationSent(managerId, type) {
    try {
      if (!currentUser) return;
      
      await fetch('/api/watchlist/notify-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          managerId: managerId,
          type: type,
          timestamp: new Date()
        })
      });
    } catch (e) {
      console.error('Error recording notification:', e);
    }
  }
  
  // Check all watched rivals
  async function checkAllWatched() {
    console.log('🔍 Checking watched rivals for activity...');
    
    if (!currentUser || watchedRivals.length === 0) {
      console.log('No watched rivals to check');
      return;
    }
    
    // Get bootstrap data
    let bsData = null;
    try {
      bsData = await API.bootstrap();
    } catch (e) {
      console.error('❌ Failed to get bootstrap data for notifications:', e);
      return;
    }
    
    // Check each rival
    for (const rival of watchedRivals) {
      const result = await checkRivalActivity(rival.entry, rival.player_name);
      
      if (result && result.hasChanges) {
        console.log(`✨ Activity detected for ${rival.player_name}!`);
        await processActivityChanges(result, bsData);
      }
    }
  }
  
  // Initialize notification service
  async function init() {
    currentUser = JSON.parse(localStorage.getItem('fpl_user_session') || 'null');
    
    if (!currentUser) {
      console.log('📢 Notifications: User not logged in');
      return false;
    }
    
    // Try to get request notification permission
    const hasPermission = await requestNotificationPermission();
    
    // Load watched rivals from localStorage (for now)
    try {
      const watchedData = JSON.parse(localStorage.getItem('fpl_watched_teams') || '{}');
      watchedRivals = Object.values(watchedData);
      console.log(`📢 Watchlist notifications initialized. Watching ${watchedRivals.length} rivals`);
    } catch (e) {
      console.error('Error loading watched rivals:', e);
      watchedRivals = [];
    }
    
    // Start polling if we have watched rivals
    if (watchedRivals.length > 0) {
      startPolling();
    }
    
    return true;
  }
  
  // Start periodic checking
  function startPolling() {
    if (checkInterval) {
      console.log('📢 Polling already active');
      return;
    }
    
    console.log(`📢 Starting watchlist polling every 5 minutes`);
    
    // Check immediately on first start
    checkAllWatched();
    
    // Then check every 5 minutes
    checkInterval = setInterval(checkAllWatched, CHECK_INTERVAL_MS);
  }
  
  // Stop polling
  function stopPolling() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      console.log('📢 Watchlist polling stopped');
    }
  }
  
  // Update watched rivals list
  function updateWatchedRivals(rivals) {
    watchedRivals = rivals;
    console.log(`📢 Updated watched rivals: ${watchedRivals.length}`);
    
    if (watchedRivals.length > 0 && !checkInterval) {
      startPolling();
    } else if (watchedRivals.length === 0 && checkInterval) {
      stopPolling();
    }
  }
  
  // Public API
  return {
    init: init,
    requestPermission: requestNotificationPermission,
    checkRival: checkRivalActivity,
    checkAll: checkAllWatched,
    startPolling: startPolling,
    stopPolling: stopPolling,
    updateWatched: updateWatchedRivals,
    showNotification: showInAppNotification,
    showBrowserNotification: showBrowserNotification
  };
})();

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  WatchlistNotifications.init();
});
