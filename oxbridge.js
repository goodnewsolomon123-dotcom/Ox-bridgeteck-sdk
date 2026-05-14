/*!
 * OX-Bridge JavaScript SDK v1.0.0
 * A Firebase-like real-time messaging SDK
 * Built on OX-Bridge API Platform
 * https://cdn.jsdelivr.net/gh/goodnewsolomon123-dotcom/oxbridge-sdk@main/oxbridge.js
 */

(function (global) {
  'use strict';

  const BASE_URL = 'https://ox-bridge-backend.onrender.com';

  class OXBridge {
    /**
     * Initialize OX-Bridge SDK
     * @param {string} apiKey - Your developer API key from ox-bridge-backend.onrender.com/docs
     */
    constructor(apiKey) {
      if (!apiKey) throw new Error('OX-Bridge: API key is required!');
      this._apiKey = apiKey;
      this._token = null;
      this._user = null;
      this._ws = null;
      this._listeners = {};
      this._reconnectTimer = null;
      console.log('✅ OX-Bridge SDK v1.0.0 initialized');
    }

    // ─────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────

    _headers(auth = false) {
      const h = {
        'Content-Type': 'application/json',
        'X-API-Key': this._apiKey,
      };
      if (auth && this._token) h['Authorization'] = `Bearer ${this._token}`;
      return h;
    }

    async _request(method, path, body = null, auth = false, isForm = false) {
      const opts = {
        method,
        headers: isForm
          ? { 'X-API-Key': this._apiKey, ...(auth && this._token ? { Authorization: `Bearer ${this._token}` } : {}) }
          : this._headers(auth),
      };
      if (body) opts.body = isForm ? body : JSON.stringify(body);

      const res = await fetch(BASE_URL + path, opts);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'OX-Bridge request failed');
      }
      return data;
    }

    _emit(event, data) {
      if (this._listeners[event]) {
        this._listeners[event].forEach(cb => cb(data));
      }
    }

    _on(event, callback) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(callback);
    }

    // ─────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────

    /**
     * Register a new user
     * @param {string} username
     * @param {string} email
     * @param {string} password
     * @returns {Promise<object>} user data + token
     *
     * @example
     * const user = await ox.register("john", "john@email.com", "password123")
     */
    async register(username, email, password) {
      const data = await this._request('POST', '/auth/register', { username, email, password });
      this._token = data.access_token;
      this._user = { id: data.user_id, username: data.username, email: data.email };
      this._connectWS();
      return data;
    }

    /**
     * Login an existing user
     * @param {string} username
     * @param {string} password
     * @returns {Promise<object>} user data + token
     *
     * @example
     * const user = await ox.login("john", "password123")
     */
    async login(username, password) {
      const fd = new FormData();
      fd.append('username', username);
      fd.append('password', password);

      const res = await fetch(BASE_URL + '/auth/login', {
        method: 'POST',
        headers: { 'X-API-Key': this._apiKey },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      this._token = data.access_token;
      this._user = { id: data.user_id, username: data.username, email: data.email, avatar_url: data.avatar_url };
      this._connectWS();
      return data;
    }

    /**
     * Logout current user
     */
    logout() {
      this._token = null;
      this._user = null;
      if (this._ws) this._ws.close();
      if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
      this._emit('logout', {});
    }

    /**
     * Get current logged in user profile
     * @returns {Promise<object>}
     *
     * @example
     * const me = await ox.getMe()
     */
    async getMe() {
      return await this._request('GET', '/auth/me', null, true);
    }

    /**
     * Upload a profile picture
     * @param {File} file - image file
     * @returns {Promise<object>}
     *
     * @example
     * const input = document.getElementById('avatar-input')
     * await ox.uploadAvatar(input.files[0])
     */
    async uploadAvatar(file) {
      const fd = new FormData();
      fd.append('file', file);
      return await this._request('POST', '/auth/upload-avatar', fd, true, true);
    }

    // ─────────────────────────────────────────
    // USERS
    // ─────────────────────────────────────────

    /**
     * Get all users in your app
     * @returns {Promise<Array>}
     *
     * @example
     * const users = await ox.getUsers()
     */
    async getUsers() {
      return await this._request('GET', '/users', null, true);
    }

    /**
     * Get currently online users
     * @returns {Promise<object>}
     *
     * @example
     * const { online_users } = await ox.getOnlineUsers()
     */
    async getOnlineUsers() {
      return await this._request('GET', '/users/online', null, true);
    }

    // ─────────────────────────────────────────
    // DIRECT MESSAGES
    // ─────────────────────────────────────────

    /**
     * Send a text message
     * @param {string} toUsername - receiver's username
     * @param {string} content - message text
     * @returns {Promise<object>}
     *
     * @example
     * await ox.sendMessage("jane", "Hello Jane!")
     */
    async sendMessage(toUsername, content) {
      return await this._request('POST', '/messages/send', {
        receiver_username: toUsername,
        content,
      }, true);
    }

    /**
     * Send a media message (image, video, voice, file)
     * @param {string} toUsername - receiver's username
     * @param {File} file - the media file
     * @param {string} caption - optional caption
     * @returns {Promise<object>}
     *
     * @example
     * const file = document.getElementById('file-input').files[0]
     * await ox.sendMedia("jane", file, "Check this out!")
     */
    async sendMedia(toUsername, file, caption = '') {
      const fd = new FormData();
      fd.append('receiver_username', toUsername);
      fd.append('caption', caption);
      fd.append('file', file);
      return await this._request('POST', '/messages/send-media', fd, true, true);
    }

    /**
     * Get conversation with a user
     * @param {string} username - the other user's username
     * @returns {Promise<Array>}
     *
     * @example
     * const messages = await ox.getMessages("jane")
     */
    async getMessages(username) {
      return await this._request('GET', `/messages/${username}`, null, true);
    }

    /**
     * Get total unread message count
     * @returns {Promise<object>}
     *
     * @example
     * const { unread_messages } = await ox.getUnreadCount()
     */
    async getUnreadCount() {
      return await this._request('GET', '/messages/unread/count', null, true);
    }

    /**
     * Delete a message
     * @param {number} messageId
     * @returns {Promise<object>}
     *
     * @example
     * await ox.deleteMessage(42)
     */
    async deleteMessage(messageId) {
      const res = await fetch(BASE_URL + `/messages/${messageId}`, {
        method: 'DELETE',
        headers: this._headers(true),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Delete failed');
      return data;
    }

    // ─────────────────────────────────────────
    // GROUP CHATS
    // ─────────────────────────────────────────

    /**
     * Create a group
     * @param {string} name - group name
     * @param {string} description - optional description
     * @returns {Promise<object>}
     *
     * @example
     * const group = await ox.createGroup("Study Squad", "WAEC prep group")
     */
    async createGroup(name, description = '') {
      return await this._request('POST', '/groups/create', { name, description }, true);
    }

    /**
     * Get all groups you belong to
     * @returns {Promise<Array>}
     *
     * @example
     * const groups = await ox.getGroups()
     */
    async getGroups() {
      return await this._request('GET', '/groups', null, true);
    }

    /**
     * Add a member to a group
     * @param {number} groupId
     * @param {string} username
     * @returns {Promise<object>}
     *
     * @example
     * await ox.addGroupMember(1, "jane")
     */
    async addGroupMember(groupId, username) {
      return await this._request('POST', `/groups/${groupId}/add/${username}`, {}, true);
    }

    /**
     * Remove a member from a group
     * @param {number} groupId
     * @param {string} username
     * @returns {Promise<object>}
     *
     * @example
     * await ox.removeGroupMember(1, "jane")
     */
    async removeGroupMember(groupId, username) {
      const res = await fetch(BASE_URL + `/groups/${groupId}/remove/${username}`, {
        method: 'DELETE',
        headers: this._headers(true),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Remove failed');
      return data;
    }

    /**
     * Send a text message to a group
     * @param {number} groupId
     * @param {string} content
     * @returns {Promise<object>}
     *
     * @example
     * await ox.sendGroupMessage(1, "Hey everyone!")
     */
    async sendGroupMessage(groupId, content) {
      return await this._request('POST', `/groups/${groupId}/send`, { content }, true);
    }

    /**
     * Send media to a group
     * @param {number} groupId
     * @param {File} file
     * @param {string} caption
     * @returns {Promise<object>}
     *
     * @example
     * await ox.sendGroupMedia(1, file, "Study notes!")
     */
    async sendGroupMedia(groupId, file, caption = '') {
      const fd = new FormData();
      fd.append('caption', caption);
      fd.append('file', file);
      return await this._request('POST', `/groups/${groupId}/send-media`, fd, true, true);
    }

    /**
     * Get messages from a group
     * @param {number} groupId
     * @returns {Promise<Array>}
     *
     * @example
     * const messages = await ox.getGroupMessages(1)
     */
    async getGroupMessages(groupId) {
      return await this._request('GET', `/groups/${groupId}/messages`, null, true);
    }

    // ─────────────────────────────────────────
    // VOICE & VIDEO CALLS (WebRTC Signaling)
    // ─────────────────────────────────────────

    /**
     * Request a call with a user
     * @param {string} toUsername
     * @param {string} type - "video" or "audio"
     * @returns {Promise<object>}
     *
     * @example
     * await ox.callUser("jane", "video")
     */
    async callUser(toUsername, type = 'video') {
      return await this._request('POST', '/calls/signal', {
        to_username: toUsername,
        signal_type: 'call-request',
        payload: { media: type },
      }, true);
    }

    /**
     * Send a WebRTC signal (offer, answer, ice-candidate)
     * @param {string} toUsername
     * @param {string} signalType - offer | answer | ice-candidate | call-end
     * @param {object} payload - WebRTC signal data
     * @returns {Promise<object>}
     *
     * @example
     * await ox.sendSignal("jane", "offer", { sdp: peerConnection.localDescription })
     */
    async sendSignal(toUsername, signalType, payload) {
      return await this._request('POST', '/calls/signal', {
        to_username: toUsername,
        signal_type: signalType,
        payload,
      }, true);
    }

    /**
     * End an ongoing call
     * @param {string} toUsername
     * @returns {Promise<object>}
     *
     * @example
     * await ox.endCall("jane")
     */
    async endCall(toUsername) {
      return await this._request('POST', '/calls/signal', {
        to_username: toUsername,
        signal_type: 'call-end',
        payload: {},
      }, true);
    }

    // ─────────────────────────────────────────
    // REAL-TIME EVENTS (WebSocket)
    // ─────────────────────────────────────────

    _connectWS() {
      if (!this._token) return;
      if (this._ws) this._ws.close();

      this._ws = new WebSocket(`wss://ox-bridge-backend.onrender.com/ws/${this._token}`);

      this._ws.onopen = () => {
        console.log('🟢 OX-Bridge: WebSocket connected');
        this._emit('connected', {});
        // Keepalive ping every 25s
        this._pingInterval = setInterval(() => {
          if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this._ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          switch (data.type) {
            case 'new_message':
              this._emit('message', data);
              break;
            case 'group_message':
              this._emit('groupMessage', data);
              break;
            case 'presence':
              this._emit('presence', data);
              break;
            case 'unread_count':
              this._emit('unreadCount', data);
              break;
            case 'rtc_signal':
              this._emit('signal', data);
              // Auto-emit specific call events
              if (data.signal_type === 'call-request') this._emit('incomingCall', data);
              if (data.signal_type === 'call-end') this._emit('callEnded', data);
              if (data.signal_type === 'offer') this._emit('offer', data);
              if (data.signal_type === 'answer') this._emit('answer', data);
              if (data.signal_type === 'ice-candidate') this._emit('iceCandidate', data);
              break;
            case 'pong':
              break;
            default:
              this._emit('event', data);
          }
        } catch (err) {}
      };

      this._ws.onclose = () => {
        console.log('🔴 OX-Bridge: WebSocket disconnected — reconnecting...');
        clearInterval(this._pingInterval);
        this._emit('disconnected', {});
        this._reconnectTimer = setTimeout(() => this._connectWS(), 4000);
      };

      this._ws.onerror = () => this._ws.close();
    }

    /**
     * Listen for new direct messages in real time
     * @param {function} callback
     *
     * @example
     * ox.onMessage((msg) => {
     *   console.log(msg.from, msg.content, msg.media_url)
     * })
     */
    onMessage(callback) { this._on('message', callback); }

    /**
     * Listen for new group messages in real time
     * @param {function} callback
     *
     * @example
     * ox.onGroupMessage((msg) => {
     *   console.log(msg.group_name, msg.from, msg.content)
     * })
     */
    onGroupMessage(callback) { this._on('groupMessage', callback); }

    /**
     * Listen for user presence changes (online/offline)
     * @param {function} callback
     *
     * @example
     * ox.onPresence((data) => {
     *   console.log(data.username, data.status) // "jane", "online"
     * })
     */
    onPresence(callback) { this._on('presence', callback); }

    /**
     * Listen for incoming calls
     * @param {function} callback
     *
     * @example
     * ox.onIncomingCall((call) => {
     *   console.log(call.from, call.payload.media) // "jane", "video"
     * })
     */
    onIncomingCall(callback) { this._on('incomingCall', callback); }

    /**
     * Listen for WebRTC offer
     * @param {function} callback
     */
    onOffer(callback) { this._on('offer', callback); }

    /**
     * Listen for WebRTC answer
     * @param {function} callback
     */
    onAnswer(callback) { this._on('answer', callback); }

    /**
     * Listen for ICE candidates
     * @param {function} callback
     */
    onIceCandidate(callback) { this._on('iceCandidate', callback); }

    /**
     * Listen for call ended
     * @param {function} callback
     */
    onCallEnded(callback) { this._on('callEnded', callback); }

    /**
     * Listen for unread count updates
     * @param {function} callback
     *
     * @example
     * ox.onUnreadCount((data) => {
     *   badge.textContent = data.count
     * })
     */
    onUnreadCount(callback) { this._on('unreadCount', callback); }

    /**
     * Listen for WebSocket connection
     * @param {function} callback
     */
    onConnected(callback) { this._on('connected', callback); }

    /**
     * Listen for WebSocket disconnection
     * @param {function} callback
     */
    onDisconnected(callback) { this._on('disconnected', callback); }

    /**
     * Get current logged in user object
     * @returns {object|null}
     */
    get currentUser() { return this._user; }

    /**
     * Check if a user is logged in
     * @returns {boolean}
     */
    get isLoggedIn() { return !!this._token; }
  }

  // Expose globally
  global.OXBridge = OXBridge;

})(typeof window !== 'undefined' ? window : global);
