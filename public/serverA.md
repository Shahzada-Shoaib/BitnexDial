# =============================
# Apache Reverse Proxy Config
# =============================

# Core SSL proxy settings
SSLProxyEngine on
SSLProxyVerify none
SSLProxyCheckPeerCN off
SSLProxyCheckPeerName off

ProxyPreserveHost On
ProxyRequests Off

# ------------------------------------------------------------
# ---- CARVE-OUTS → PORT 3000 (send-sms-api.js) - SPECIFIC ----
# ------------------------------------------------------------

# Auth (old: https://127.0.0.1/api/sms-login)
<Location "/api/sms-login">
    ProxyPass        "https://127.0.0.1/api/sms-login"
    ProxyPassReverse "https://127.0.0.1/api/sms-login"
    ProxyPreserveHost On
</Location>

# Force logout check (old: https://127.0.0.1/api/check-force-logout)
<Location "/api/check-force-logout">
    ProxyPass        "https://127.0.0.1/api/check-force-logout"
    ProxyPassReverse "https://127.0.0.1/api/check-force-logout"
    ProxyPreserveHost On
</Location>

# User SMS counter (old: https://127.0.0.1/api/sms-counter-user)
<Location "/api/sms-counter-user">
    ProxyPass        "https://127.0.0.1/api/sms-counter-user"
    ProxyPassReverse "https://127.0.0.1/api/sms-counter-user"
    ProxyPreserveHost On
</Location>

# Twilio webhook inbound SMS (old: https://127.0.0.1/incoming-sms)
<Location "/incoming-sms">
    ProxyPass        "https://127.0.0.1/incoming-sms"
    ProxyPassReverse "https://127.0.0.1/incoming-sms"
    ProxyPreserveHost On
</Location>

# Chat pair history (old: https://127.0.0.1/chat-pair)
<Location "/chat-pair">
    ProxyPass        "https://127.0.0.1/chat-pair"
    ProxyPassReverse "https://127.0.0.1/chat-pair"
    ProxyPreserveHost On
</Location>

# Latest summary (old: https://127.0.0.1/sms-latest-summary)
<Location "/sms-latest-summary">
    ProxyPass        "https://127.0.0.1/sms-latest-summary"
    ProxyPassReverse "https://127.0.0.1/sms-latest-summary"
    ProxyPreserveHost On
</Location>

# Paginated history (old: https://127.0.0.1/sms-history-paginated)
<Location "/sms-history-paginated">
    ProxyPass        "https://127.0.0.1/sms-history-paginated"
    ProxyPassReverse "https://127.0.0.1/sms-history-paginated"
    ProxyPreserveHost On
</Location>

# File upload for MMS (old: https://127.0.0.1/upload)
<Location "/upload">
    ProxyPass        "https://127.0.0.1/upload"
    ProxyPassReverse "https://127.0.0.1/upload"
    ProxyPreserveHost On
</Location>

# Static assets under /sms (old: https://127.0.0.1/sms/)
<Location "/sms/">
    ProxyPass        "https://127.0.0.1/sms/"
    ProxyPassReverse "https://127.0.0.1/sms/"
    ProxyPreserveHost On
</Location>

# Secure phone.js (old: https://127.0.0.1/secure/)
<Location "/secure/">
    ProxyPass        "https://127.0.0.1/secure/"
    ProxyPassReverse "https://127.0.0.1/secure/"
    ProxyPreserveHost On
</Location>

# Uploads and downloads (old: https://127.0.0.1/sms/uploads/, /sms/downloads/)
<Location "/sms/uploads/">
    ProxyPass        "https://127.0.0.1/sms/uploads/"
    ProxyPassReverse "https://127.0.0.1/sms/uploads/"
    ProxyPreserveHost On
</Location>
<Location "/sms/downloads/">
    ProxyPass        "https://127.0.0.1/sms/downloads/"
    ProxyPassReverse "https://127.0.0.1/sms/downloads/"
    ProxyPreserveHost On
</Location>

# Voicemail APIs (old: https://127.0.0.1/api/voicemails, /api/voicemail-audio/)
<Location "/api/voicemails">
    ProxyPass        "https://127.0.0.1/api/voicemails"
    ProxyPassReverse "https://127.0.0.1/api/voicemails"
    ProxyPreserveHost On
</Location>
<Location "/api/voicemail-audio/">
    ProxyPass        "https://127.0.0.1/api/voicemail-audio/"
    ProxyPassReverse "https://127.0.0.1/api/voicemail-audio/"
    ProxyPreserveHost On
</Location>

# WebSocket upgrade for Socket.IO (old: wss://127.0.0.1/socket.io/)
ProxyPass        "/socket.io/" "ws://127.0.0.1/socket.io/"
ProxyPassReverse "/socket.io/" "ws://127.0.0.1/socket.io/"

# ------------------------------------------------------------
# ---- GENERAL → PORT 4000 (admin-api.js) - EVERYTHING /api/ --
# ------------------------------------------------------------

# Master catch for /api (old: https://127.0.0.1/api/)
<Location "/api/">
    ProxyPass        "https://127.0.0.1/api/"
    ProxyPassReverse "https://127.0.0.1/api/"
    ProxyPreserveHost On
</Location>

# ---- Admin / Users ----
# (old: https://127.0.0.1/api/admin/users)
<Location "/api/admin/users">
    ProxyPass        "https://127.0.0.1/api/admin/users"
    ProxyPassReverse "https://127.0.0.1/api/admin/users"
</Location>

# (old: https://127.0.0.1/api/admin/create)
<Location "/api/admin/create">
    ProxyPass        "https://127.0.0.1/api/admin/create"
    ProxyPassReverse "https://127.0.0.1/api/admin/create"
</Location>

# (old: https://127.0.0.1/api/admin/update-password/:userId)
<LocationMatch "^/api/admin/update-password/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/update-email/:userId)
<LocationMatch "^/api/admin/update-email/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/toggle-ban/:userId)
<LocationMatch "^/api/admin/toggle-ban/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/toggle-sms/:userId)
<LocationMatch "^/api/admin/toggle-sms/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/force-logout/:userId)
<LocationMatch "^/api/admin/force-logout/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/delete/:userId)
<LocationMatch "^/api/admin/delete/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# ---- Sessions ----
# (old: https://127.0.0.1/api/sessions)
<Location "/api/sessions">
    ProxyPass        "https://127.0.0.1/api/sessions"
    ProxyPassReverse "https://127.0.0.1/api/sessions"
</Location>

# (old: https://127.0.0.1/api/sessions-detailed)
<Location "/api/sessions-detailed">
    ProxyPass        "https://127.0.0.1/api/sessions-detailed"
    ProxyPassReverse "https://127.0.0.1/api/sessions-detailed"
</Location>

# ---- PJSIP / Asterisk ----
# (old: https://127.0.0.1/api/pjsip-online-details)
<Location "/api/pjsip-online-details">
    ProxyPass        "https://127.0.0.1/api/pjsip-online-details"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-online-details"
</Location>

# (old: https://127.0.0.1/api/pjsip-kick-device)
<Location "/api/pjsip-kick-device">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-device"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-device"
</Location>

# (old: https://127.0.0.1/api/pjsip-user-contacts/:aor)
<LocationMatch "^/api/pjsip-user-contacts/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/pjsip-kick-user-excess)
<Location "/api/pjsip-kick-user-excess">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-user-excess"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-user-excess"
</Location>

# (old: https://127.0.0.1/api/pjsip-kick-device-specific)
<Location "/api/pjsip-kick-device-specific">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-device-specific"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-device-specific"
</Location>

# Device bans (old: https://127.0.0.1/api/admin/device-bans)
<Location "/api/admin/device-bans">
    ProxyPass        "https://127.0.0.1/api/admin/device-bans"
    ProxyPassReverse "https://127.0.0.1/api/admin/device-bans"
</Location>

# ---- Debug ----
# (old: https://127.0.0.1/api/debug/table-structure)
<Location "/api/debug/table-structure">
    ProxyPass        "https://127.0.0.1/api/debug/table-structure"
    ProxyPassReverse "https://127.0.0.1/api/debug/table-structure"
</Location>

# ---- Favorites (pin/unpin chats) ----
# (old: https://127.0.0.1/api/toggle-favorite-chat)
<Location "/api/toggle-favorite-chat">
    ProxyPass        "https://127.0.0.1/api/toggle-favorite-chat"
    ProxyPassReverse "https://127.0.0.1/api/toggle-favorite-chat"
</Location>

# (old: https://127.0.0.1/api/favorite-chats?owner=...)
<Location "/api/favorite-chats">
    ProxyPass        "https://127.0.0.1/api/favorite-chats"
    ProxyPassReverse "https://127.0.0.1/api/favorite-chats"
</Location>

# (old: https://127.0.0.1/api/check-favorite-chat?owner=...&contact=...)
<Location "/api/check-favorite-chat">
    ProxyPass        "https://127.0.0.1/api/check-favorite-chat"
    ProxyPassReverse "https://127.0.0.1/api/check-favorite-chat"
</Location>

# ---- Recordings (from admin-api.js) ----
# Serve audio & list recordings
# (old: https://127.0.0.1/api/recording-audio/)
<Location "/api/recording-audio/">
    ProxyPass        "https://127.0.0.1/api/recording-audio/"
    ProxyPassReverse "https://127.0.0.1/api/recording-audio/"
</Location>

# (old: https://127.0.0.1/api/call-recordings)
<Location "/api/call-recordings">
    ProxyPass        "https://127.0.0.1/api/call-recordings"
    ProxyPassReverse "https://127.0.0.1/api/call-recordings"
</Location>
# =============================
# Apache Reverse Proxy Config
# =============================

# Core SSL proxy settings
SSLProxyEngine on
SSLProxyVerify none
SSLProxyCheckPeerCN off
SSLProxyCheckPeerName off

ProxyPreserveHost On
ProxyRequests Off

# ------------------------------------------------------------
# ---- CARVE-OUTS → PORT 3000 (send-sms-api.js) - SPECIFIC ----
# ------------------------------------------------------------

# Auth (old: https://127.0.0.1/api/sms-login)
<Location "/api/sms-login">
    ProxyPass        "https://127.0.0.1/api/sms-login"
    ProxyPassReverse "https://127.0.0.1/api/sms-login"
    ProxyPreserveHost On
</Location>

# Force logout check (old: https://127.0.0.1/api/check-force-logout)
<Location "/api/check-force-logout">
    ProxyPass        "https://127.0.0.1/api/check-force-logout"
    ProxyPassReverse "https://127.0.0.1/api/check-force-logout"
    ProxyPreserveHost On
</Location>

# User SMS counter (old: https://127.0.0.1/api/sms-counter-user)
<Location "/api/sms-counter-user">
    ProxyPass        "https://127.0.0.1/api/sms-counter-user"
    ProxyPassReverse "https://127.0.0.1/api/sms-counter-user"
    ProxyPreserveHost On
</Location>

# Twilio webhook inbound SMS (old: https://127.0.0.1/incoming-sms)
<Location "/incoming-sms">
    ProxyPass        "https://127.0.0.1/incoming-sms"
    ProxyPassReverse "https://127.0.0.1/incoming-sms"
    ProxyPreserveHost On
</Location>

# Chat pair history (old: https://127.0.0.1/chat-pair)
<Location "/chat-pair">
    ProxyPass        "https://127.0.0.1/chat-pair"
    ProxyPassReverse "https://127.0.0.1/chat-pair"
    ProxyPreserveHost On
</Location>

# Latest summary (old: https://127.0.0.1/sms-latest-summary)
<Location "/sms-latest-summary">
    ProxyPass        "https://127.0.0.1/sms-latest-summary"
    ProxyPassReverse "https://127.0.0.1/sms-latest-summary"
    ProxyPreserveHost On
</Location>

# Paginated history (old: https://127.0.0.1/sms-history-paginated)
<Location "/sms-history-paginated">
    ProxyPass        "https://127.0.0.1/sms-history-paginated"
    ProxyPassReverse "https://127.0.0.1/sms-history-paginated"
    ProxyPreserveHost On
</Location>

# File upload for MMS (old: https://127.0.0.1/upload)
<Location "/upload">
    ProxyPass        "https://127.0.0.1/upload"
    ProxyPassReverse "https://127.0.0.1/upload"
    ProxyPreserveHost On
</Location>

# Static assets under /sms (old: https://127.0.0.1/sms/)
<Location "/sms/">
    ProxyPass        "https://127.0.0.1/sms/"
    ProxyPassReverse "https://127.0.0.1/sms/"
    ProxyPreserveHost On
</Location>

# Secure phone.js (old: https://127.0.0.1/secure/)
<Location "/secure/">
    ProxyPass        "https://127.0.0.1/secure/"
    ProxyPassReverse "https://127.0.0.1/secure/"
    ProxyPreserveHost On
</Location>

# Uploads and downloads (old: https://127.0.0.1/sms/uploads/, /sms/downloads/)
<Location "/sms/uploads/">
    ProxyPass        "https://127.0.0.1/sms/uploads/"
    ProxyPassReverse "https://127.0.0.1/sms/uploads/"
    ProxyPreserveHost On
</Location>
<Location "/sms/downloads/">
    ProxyPass        "https://127.0.0.1/sms/downloads/"
    ProxyPassReverse "https://127.0.0.1/sms/downloads/"
    ProxyPreserveHost On
</Location>

# Voicemail APIs (old: https://127.0.0.1/api/voicemails, /api/voicemail-audio/)
<Location "/api/voicemails">
    ProxyPass        "https://127.0.0.1/api/voicemails"
    ProxyPassReverse "https://127.0.0.1/api/voicemails"
    ProxyPreserveHost On
</Location>
<Location "/api/voicemail-audio/">
    ProxyPass        "https://127.0.0.1/api/voicemail-audio/"
    ProxyPassReverse "https://127.0.0.1/api/voicemail-audio/"
    ProxyPreserveHost On
</Location>

# WebSocket upgrade for Socket.IO (old: wss://127.0.0.1/socket.io/)
ProxyPass        "/socket.io/" "ws://127.0.0.1/socket.io/"
ProxyPassReverse "/socket.io/" "ws://127.0.0.1/socket.io/"

# ------------------------------------------------------------
# ---- GENERAL → PORT 4000 (admin-api.js) - EVERYTHING /api/ --
# ------------------------------------------------------------

# Master catch for /api (old: https://127.0.0.1/api/)
<Location "/api/">
    ProxyPass        "https://127.0.0.1/api/"
    ProxyPassReverse "https://127.0.0.1/api/"
    ProxyPreserveHost On
</Location>

# ---- Admin / Users ----
# (old: https://127.0.0.1/api/admin/users)
<Location "/api/admin/users">
    ProxyPass        "https://127.0.0.1/api/admin/users"
    ProxyPassReverse "https://127.0.0.1/api/admin/users"
</Location>

# (old: https://127.0.0.1/api/admin/create)
<Location "/api/admin/create">
    ProxyPass        "https://127.0.0.1/api/admin/create"
    ProxyPassReverse "https://127.0.0.1/api/admin/create"
</Location>

# (old: https://127.0.0.1/api/admin/update-password/:userId)
<LocationMatch "^/api/admin/update-password/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/update-email/:userId)
<LocationMatch "^/api/admin/update-email/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/toggle-ban/:userId)
<LocationMatch "^/api/admin/toggle-ban/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/toggle-sms/:userId)
<LocationMatch "^/api/admin/toggle-sms/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/force-logout/:userId)
<LocationMatch "^/api/admin/force-logout/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/admin/delete/:userId)
<LocationMatch "^/api/admin/delete/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# ---- Sessions ----
# (old: https://127.0.0.1/api/sessions)
<Location "/api/sessions">
    ProxyPass        "https://127.0.0.1/api/sessions"
    ProxyPassReverse "https://127.0.0.1/api/sessions"
</Location>

# (old: https://127.0.0.1/api/sessions-detailed)
<Location "/api/sessions-detailed">
    ProxyPass        "https://127.0.0.1/api/sessions-detailed"
    ProxyPassReverse "https://127.0.0.1/api/sessions-detailed"
</Location>

# ---- PJSIP / Asterisk ----
# (old: https://127.0.0.1/api/pjsip-online-details)
<Location "/api/pjsip-online-details">
    ProxyPass        "https://127.0.0.1/api/pjsip-online-details"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-online-details"
</Location>

# (old: https://127.0.0.1/api/pjsip-kick-device)
<Location "/api/pjsip-kick-device">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-device"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-device"
</Location>

# (old: https://127.0.0.1/api/pjsip-user-contacts/:aor)
<LocationMatch "^/api/pjsip-user-contacts/">
    ProxyPass        "https://127.0.0.1"
    ProxyPassReverse "https://127.0.0.1"
</LocationMatch>

# (old: https://127.0.0.1/api/pjsip-kick-user-excess)
<Location "/api/pjsip-kick-user-excess">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-user-excess"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-user-excess"
</Location>

# (old: https://127.0.0.1/api/pjsip-kick-device-specific)
<Location "/api/pjsip-kick-device-specific">
    ProxyPass        "https://127.0.0.1/api/pjsip-kick-device-specific"
    ProxyPassReverse "https://127.0.0.1/api/pjsip-kick-device-specific"
</Location>

# Device bans (old: https://127.0.0.1/api/admin/device-bans)
<Location "/api/admin/device-bans">
    ProxyPass        "https://127.0.0.1/api/admin/device-bans"
    ProxyPassReverse "https://127.0.0.1/api/admin/device-bans"
</Location>

# ---- Debug ----
# (old: https://127.0.0.1/api/debug/table-structure)
<Location "/api/debug/table-structure">
    ProxyPass        "https://127.0.0.1/api/debug/table-structure"
    ProxyPassReverse "https://127.0.0.1/api/debug/table-structure"
</Location>

# ---- Favorites (pin/unpin chats) ----
# (old: https://127.0.0.1/api/toggle-favorite-chat)
<Location "/api/toggle-favorite-chat">
    ProxyPass        "https://127.0.0.1/api/toggle-favorite-chat"
    ProxyPassReverse "https://127.0.0.1/api/toggle-favorite-chat"
</Location>

# (old: https://127.0.0.1/api/favorite-chats?owner=...)
<Location "/api/favorite-chats">
    ProxyPass        "https://127.0.0.1/api/favorite-chats"
    ProxyPassReverse "https://127.0.0.1/api/favorite-chats"
</Location>

# (old: https://127.0.0.1/api/check-favorite-chat?owner=...&contact=...)
<Location "/api/check-favorite-chat">
    ProxyPass        "https://127.0.0.1/api/check-favorite-chat"
    ProxyPassReverse "https://127.0.0.1/api/check-favorite-chat"
</Location>

# ---- Recordings (from admin-api.js) ----
# Serve audio & list recordings
# (old: https://127.0.0.1/api/recording-audio/)
<Location "/api/recording-audio/">
    ProxyPass        "https://127.0.0.1/api/recording-audio/"
    ProxyPassReverse "https://127.0.0.1/api/recording-audio/"
</Location>

# (old: https://127.0.0.1/api/call-recordings)
<Location "/api/call-recordings">
    ProxyPass        "https://127.0.0.1/api/call-recordings"
    ProxyPassReverse "https://127.0.0.1/api/call-recordings"
</Location>
