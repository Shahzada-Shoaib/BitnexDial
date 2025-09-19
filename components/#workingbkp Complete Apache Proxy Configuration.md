# Complete Apache Proxy Configuration
# File: /etc/apache2/conf-available/bkpmanual-proxy.conf

# Enable SSL for proxy connections to backend services
SSLProxyEngine on
SSLProxyVerify none
SSLProxyCheckPeerCN off
SSLProxyCheckPeerName off

# Global proxy settings
ProxyPreserveHost On
ProxyRequests Off
ProxyTimeout 300


# Socket.IO for SMS (Port 4000) - SINGLE CORS HEADER
<Location "/socket.io/">
    ProxyPass "https://127.0.0.1:4000/socket.io/"
    ProxyPassReverse "https://127.0.0.1:4000/socket.io/"
    ProxyPreserveHost on

    # WebSocket upgrade support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/socket.io/(.*)$ ws://127.0.0.1:4000/socket.io/$1 [P,L]

    # 🔑 Strip backend CORS headers (Node.js adds them too)
    Header unset Access-Control-Allow-Origin
    Header unset Access-Control-Allow-Credentials
    Header unset Access-Control-Allow-Methods
    Header unset Access-Control-Allow-Headers
</Location>

# ===============================================
# PORT 3000 ENDPOINTS (SMS/Communication Server)
# ===============================================

# SMS Counter API
<Location "/api/sms-counter-user">
    ProxyPass "https://127.0.0.1:4000/api/sms-counter-user"
    ProxyPassReverse "https://127.0.0.1:4000/api/sms-counter-user"
    ProxyPreserveHost on
</Location>

# Voicemail APIs
<Location "/api/voicemail-audio">
    ProxyPass "https://127.0.0.1:4000/api/voicemail-audio"
    ProxyPassReverse "https://127.0.0.1:4000/api/voicemail-audio"
    ProxyPreserveHost on
</Location>

<Location "/api/voicemails">
    ProxyPass "https://127.0.0.1:4000/api/voicemails"
    ProxyPassReverse "https://127.0.0.1:4000/api/voicemails"
    ProxyPreserveHost on
</Location>

# Auth & Phone.js
<Location "/admin/login">
    ProxyPass "https://127.0.0.1:4000/admin/login"
    ProxyPassReverse "https://127.0.0.1:4000/admin/login"
    ProxyPreserveHost on
</Location>

<Location "/api/login">
    ProxyPass "https://127.0.0.1:3000/api/login"
    ProxyPassReverse "https://127.0.0.1:3000/api/login"
    ProxyPreserveHost on
</Location>

<Location "/secure/phone.js">
    ProxyPass "https://127.0.0.1:3000/secure/phone.js"
    ProxyPassReverse "https://127.0.0.1:3000/secure/phone.js"
    ProxyPreserveHost on
</Location>

# SMS & Chat APIs
<Location "/chat-pair">
    ProxyPass "https://127.0.0.1:4000/chat-pair"
    ProxyPassReverse "https://127.0.0.1:4000/chat-pair"
    ProxyPreserveHost on
</Location>

<Location "/sms-latest-summary">
    ProxyPass "https://127.0.0.1:4000/sms-latest-summary"
    ProxyPassReverse "https://127.0.0.1:4000/sms-latest-summary"
    ProxyPreserveHost on
</Location>

<Location "/sms-history-paginated">
    ProxyPass "https://127.0.0.1:4000/sms-history-paginated"
    ProxyPassReverse "https://127.0.0.1:4000/sms-history-paginated"
    ProxyPreserveHost on
</Location>

<Location "/sms-history">
    ProxyPass "https://127.0.0.1:4000/sms-history"
    ProxyPassReverse "https://127.0.0.1:4000/sms-history"
    ProxyPreserveHost on
</Location>

# File Upload/Download
<Location "/upload">
    ProxyPass "https://127.0.0.1:4000/upload"
    ProxyPassReverse "https://127.0.0.1:4000/upload"
    ProxyPreserveHost on
</Location>

<Location "/incoming-sms">
    ProxyPass "https://127.0.0.1:3000/incoming-sms"
    ProxyPassReverse "https://127.0.0.1:3000/incoming-sms"
    ProxyPreserveHost on
</Location>

# Contact Management
<Location "/api/delete-contact">
    ProxyPass "https://127.0.0.1:4000/api/delete-contact"
    ProxyPassReverse "https://127.0.0.1:4000/api/delete-contact"
    ProxyPreserveHost on
</Location>

<Location "/api/save-contact">
    ProxyPass "https://127.0.0.1:4000/api/save-contact"
    ProxyPassReverse "https://127.0.0.1:4000/api/save-contact"
    ProxyPreserveHost on
</Location>

<Location "/api/get-contacts">
    ProxyPass "https://127.0.0.1:4000/api/get-contacts"
    ProxyPassReverse "https://127.0.0.1:4000/api/get-contacts"
    ProxyPreserveHost on
</Location>

# Call & Admin APIs (Port 3000)
<Location "/api/delete-call-logs">
    ProxyPass "https://127.0.0.1:4000/api/delete-call-logs"
    ProxyPassReverse "https://127.0.0.1:4000/api/delete-call-logs"
    ProxyPreserveHost on
</Location>

<Location "/api/save-call">
    ProxyPass "https://127.0.0.1:4000/api/save-call"
    ProxyPassReverse "https://127.0.0.1:4000/api/save-call"
    ProxyPreserveHost on
</Location>

<Location "/api/call-history">
    ProxyPass "https://127.0.0.1:4000/api/call-history"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history"
    ProxyPreserveHost on
</Location>

<Location "/api/check-force-logout">
    ProxyPass "https://127.0.0.1:3000/api/check-force-logout"
    ProxyPassReverse "https://127.0.0.1:3000/api/check-force-logout"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/reset-sms-counter">
    ProxyPass "https://127.0.0.1:4000/api/admin/reset-sms-counter"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/reset-sms-counter"
    ProxyPreserveHost on
</Location>

# ===============================================
# PORT 4000 ENDPOINTS (Admin/Management Server)
# ===============================================

# Admin User Management
<Location "/api/admin/users">
    ProxyPass "https://127.0.0.1:4000/api/admin/users"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/users"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/create">
    ProxyPass "https://127.0.0.1:4000/api/admin/create"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/create"
    ProxyPreserveHost on
</Location>

# Static File Serving
<Location "/sms/uploads">
    ProxyPass "https://127.0.0.1:4000/sms/uploads"
    ProxyPassReverse "https://127.0.0.1:4000/sms/uploads"
    ProxyPreserveHost on
</Location>

<Location "/sms/downloads">
    ProxyPass "https://127.0.0.1:4000/sms/downloads"
    ProxyPassReverse "https://127.0.0.1:4000/sms/downloads"
    ProxyPreserveHost on
</Location>

# Recording APIs
<Location "/api/recording-audio">
    ProxyPass "https://127.0.0.1:4000/api/recording-audio"
    ProxyPassReverse "https://127.0.0.1:4000/api/recording-audio"
    ProxyPreserveHost on
</Location>

<Location "/api/call-recordings">
    ProxyPass "https://127.0.0.1:4000/api/call-recordings"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-recordings"
    ProxyPreserveHost on
</Location>

# Chat Favorites
<Location "/api/toggle-favorite-chat">
    ProxyPass "https://127.0.0.1:4000/api/toggle-favorite-chat"
    ProxyPassReverse "https://127.0.0.1:4000/api/toggle-favorite-chat"
    ProxyPreserveHost on
</Location>

<Location "/api/favorite-chats">
    ProxyPass "https://127.0.0.1:4000/api/favorite-chats"
    ProxyPassReverse "https://127.0.0.1:4000/api/favorite-chats"
    ProxyPreserveHost on
</Location>

<Location "/api/check-favorite-chat">
    ProxyPass "https://127.0.0.1:4000/api/check-favorite-chat"
    ProxyPassReverse "https://127.0.0.1:4000/api/check-favorite-chat"
    ProxyPreserveHost on
</Location>

# PJSIP Management
<Location "/api/pjsip-online-details">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-online-details"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-online-details"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-kick-device">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-kick-device"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-kick-device"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-user-contacts">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-user-contacts"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-user-contacts"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-kick-user-excess">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-kick-user-excess"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-kick-user-excess"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-kick-device-specific">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-kick-device-specific"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-kick-device-specific"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-kick-and-suspend">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-kick-and-suspend"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-kick-and-suspend"
    ProxyPreserveHost on
</Location>

<Location "/api/pjsip-kick-specific-device">
    ProxyPass "https://127.0.0.1:4000/api/pjsip-kick-specific-device"
    ProxyPassReverse "https://127.0.0.1:4000/api/pjsip-kick-specific-device"
    ProxyPreserveHost on
</Location>

# Device Management
<Location "/api/admin/device-bans">
    ProxyPass "https://127.0.0.1:4000/api/admin/device-bans"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/device-bans"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/unban-device">
    ProxyPass "https://127.0.0.1:4000/api/admin/unban-device"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/unban-device"
    ProxyPreserveHost on
</Location>

<Location "/api/check-device-ban">
    ProxyPass "https://127.0.0.1:4000/api/check-device-ban"
    ProxyPassReverse "https://127.0.0.1:4000/api/check-device-ban"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/temp-bans">
    ProxyPass "https://127.0.0.1:4000/api/admin/temp-bans"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/temp-bans"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/unban-temp-user">
    ProxyPass "https://127.0.0.1:4000/api/admin/unban-temp-user"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/unban-temp-user"
    ProxyPreserveHost on
</Location>

# Debug & Testing
<Location "/api/debug-table-structure">
    ProxyPass "https://127.0.0.1:4000/api/debug-table-structure"
    ProxyPassReverse "https://127.0.0.1:4000/api/debug-table-structure"
    ProxyPreserveHost on
</Location>

<Location "/api/debug/contacts">
    ProxyPass "https://127.0.0.1:4000/api/debug/contacts"
    ProxyPassReverse "https://127.0.0.1:4000/api/debug/contacts"
    ProxyPreserveHost on
</Location>

<Location "/api/test-delete-contact">
    ProxyPass "https://127.0.0.1:4000/api/test-delete-contact"
    ProxyPassReverse "https://127.0.0.1:4000/api/test-delete-contact"
    ProxyPreserveHost on
</Location>

# Call History Management (Port 4000)
<Location "/api/call-history/stats">
    ProxyPass "https://127.0.0.1:4000/api/call-history/stats"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history/stats"
    ProxyPreserveHost on
</Location>

<Location "/api/call-history/export">
    ProxyPass "https://127.0.0.1:4000/api/call-history/export"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history/export"
    ProxyPreserveHost on
</Location>

<Location "/api/call-history/bulk-delete">
    ProxyPass "https://127.0.0.1:4000/api/call-history/bulk-delete"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history/bulk-delete"
    ProxyPreserveHost on
</Location>

<Location "/api/call-history/delete-contact">
    ProxyPass "https://127.0.0.1:4000/api/call-history/delete-contact"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history/delete-contact"
    ProxyPreserveHost on
</Location>

<Location "/api/call-history/clear-all">
    ProxyPass "https://127.0.0.1:4000/api/call-history/clear-all"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-history/clear-all"
    ProxyPreserveHost on
</Location>

# Message Management
<Location "/api/delete-conversation">
    ProxyPass "https://127.0.0.1:4000/api/delete-conversation"
    ProxyPassReverse "https://127.0.0.1:4000/api/delete-conversation"
    ProxyPreserveHost on
</Location>

<Location "/api/delete-messages">
    ProxyPass "https://127.0.0.1:4000/api/delete-messages"
    ProxyPassReverse "https://127.0.0.1:4000/api/delete-messages"
    ProxyPreserveHost on
</Location>

<Location "/api/delete-call-history">
    ProxyPass "https://127.0.0.1:4000/api/delete-call-history"
    ProxyPassReverse "https://127.0.0.1:4000/api/delete-call-history"
    ProxyPreserveHost on
</Location>

<Location "/api/clear-all-messages">
    ProxyPass "https://127.0.0.1:4000/api/clear-all-messages"
    ProxyPassReverse "https://127.0.0.1:4000/api/clear-all-messages"
    ProxyPreserveHost on
</Location>

<Location "/api/get-conversations">
    ProxyPass "https://127.0.0.1:4000/api/get-conversations"
    ProxyPassReverse "https://127.0.0.1:4000/api/get-conversations"
    ProxyPreserveHost on
</Location>

# Call Login/Session Management
<Location "/api/call-login">
    ProxyPass "https://127.0.0.1:4000/api/call-login"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-login"
    ProxyPreserveHost on
</Location>

<Location "/api/active-call-logins">
    ProxyPass "https://127.0.0.1:4000/api/active-call-logins"
    ProxyPassReverse "https://127.0.0.1:4000/api/active-call-logins"
    ProxyPreserveHost on
</Location>

<Location "/api/call-login-history">
    ProxyPass "https://127.0.0.1:4000/api/call-login-history"
    ProxyPassReverse "https://127.0.0.1:4000/api/call-login-history"
    ProxyPreserveHost on
</Location>

<Location "/api/recent-call-logs">
    ProxyPass "https://127.0.0.1:4000/api/recent-call-logs"
    ProxyPassReverse "https://127.0.0.1:4000/api/recent-call-logs"
    ProxyPreserveHost on
</Location>

# Session Management
<Location "/api/device-sessions">
    ProxyPass "https://127.0.0.1:4000/api/device-sessions"
    ProxyPassReverse "https://127.0.0.1:4000/api/device-sessions"
    ProxyPreserveHost on
</Location>

<Location "/api/sessions-detailed">
    ProxyPass "https://127.0.0.1:4000/api/sessions-detailed"
    ProxyPassReverse "https://127.0.0.1:4000/api/sessions-detailed"
    ProxyPreserveHost on
</Location>

<Location "/api/sessions">
    ProxyPass "https://127.0.0.1:4000/api/sessions"
    ProxyPassReverse "https://127.0.0.1:4000/api/sessions"
    ProxyPreserveHost on
</Location>

<Location "/api/cleanup-user-devices">
    ProxyPass "https://127.0.0.1:4000/api/cleanup-user-devices"
    ProxyPassReverse "https://127.0.0.1:4000/api/cleanup-user-devices"
    ProxyPreserveHost on
</Location>

<Location "/api/cleanup-excess-sessions">
    ProxyPass "https://127.0.0.1:4000/api/cleanup-excess-sessions"
    ProxyPassReverse "https://127.0.0.1:4000/api/cleanup-excess-sessions"
    ProxyPreserveHost on
</Location>

<Location "/api/admin/check-session-limits">
    ProxyPass "https://127.0.0.1:4000/api/admin/check-session-limits"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/check-session-limits"
    ProxyPreserveHost on
</Location>

<Location "/api/force-logout-session">
    ProxyPass "https://127.0.0.1:4000/api/force-logout-session"
    ProxyPassReverse "https://127.0.0.1:4000/api/force-logout-session"
    ProxyPreserveHost on
</Location>

<Location "/api/register-session">
    ProxyPass "https://127.0.0.1:4000/api/register-session"
    ProxyPassReverse "https://127.0.0.1:4000/api/register-session"
    ProxyPreserveHost on
</Location>

<Location "/api/update-session-activity">
    ProxyPass "https://127.0.0.1:4000/api/update-session-activity"
    ProxyPassReverse "https://127.0.0.1:4000/api/update-session-activity"
    ProxyPreserveHost on
</Location>

<Location "/api/unregister-session">
    ProxyPass "https://127.0.0.1:4000/api/unregister-session"
    ProxyPassReverse "https://127.0.0.1:4000/api/unregister-session"
    ProxyPreserveHost on
</Location>

# Utility
<Location "/api/ping">
    ProxyPass "https://127.0.0.1:4000/api/ping"
    ProxyPassReverse "https://127.0.0.1:4000/api/ping"
    ProxyPreserveHost on
</Location>

# ===============================================
# SIP WEBSOCKET (Port 8089)
# ===============================================

# WebSocket endpoint - FIXED: Use wss instead of ws
<Location "/ws">
    ProxyPass "wss://127.0.0.1:8089/ws"
    ProxyPassReverse "wss://127.0.0.1:8089/ws"
    ProxyPreserveHost On
    
    # Enable WebSocket tunneling - FIXED: Use wss
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws(.*)$ wss://127.0.0.1:8089/ws$1 [P,L]
</Location>




#########################
# Update user password
<Location "/api/admin/update-password">
    ProxyPass "https://127.0.0.1:4000/api/admin/update-password"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/update-password"
    ProxyPreserveHost on
</Location>

# Update user email
<Location "/api/admin/update-email">
    ProxyPass "https://127.0.0.1:4000/api/admin/update-email"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/update-email"
    ProxyPreserveHost on
</Location>

# Transfer phone number
<Location "/api/admin/transfer-phone-number">
    ProxyPass "https://127.0.0.1:4000/api/admin/transfer-phone-number"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/transfer-phone-number"
    ProxyPreserveHost on
</Location>

# Preview phone cleanup (dry run)
<Location "/api/admin/preview-phone-cleanup">
    ProxyPass "https://127.0.0.1:4000/api/admin/preview-phone-cleanup"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/preview-phone-cleanup"
    ProxyPreserveHost on
</Location>

# Clean phone data (actual delete)
<Location "/api/admin/clean-phone-data">
    ProxyPass "https://127.0.0.1:4000/api/admin/clean-phone-data"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/clean-phone-data"
    ProxyPreserveHost on
</Location>

# Toggle ban
<Location "/api/admin/toggle-ban">
    ProxyPass "https://127.0.0.1:4000/api/admin/toggle-ban"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/toggle-ban"
    ProxyPreserveHost on
</Location>

# Toggle SMS permission
<Location "/api/admin/toggle-sms">
    ProxyPass "https://127.0.0.1:4000/api/admin/toggle-sms"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/toggle-sms"
    ProxyPreserveHost on
</Location>

# Force logout
<Location "/api/admin/force-logout">
    ProxyPass "https://127.0.0.1:4000/api/admin/force-logout"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/force-logout"
    ProxyPreserveHost on
</Location>

# Delete user
<Location "/api/admin/delete">
    ProxyPass "https://127.0.0.1:4000/api/admin/delete"
    ProxyPassReverse "https://127.0.0.1:4000/api/admin/delete"
    ProxyPreserveHost on
</Location>
