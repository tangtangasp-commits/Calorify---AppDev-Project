// ─────────────────────────────────────────────────────────
// ⚠️  IMPORTANT — read before running on a physical device
// ─────────────────────────────────────────────────────────
// "localhost" only works on an iOS Simulator or Android Emulator
// running on the SAME machine as Flask.
//
// For a physical phone (iOS or Android):
//   1. Find your computer's local IP:
//      • Windows → open cmd → run: ipconfig   (look for IPv4 Address)
//      • Mac/Linux → run: ifconfig or ip addr
//   2. Replace the IP below, e.g.:
//      export const API_BASE = 'http://192.168.1.100:5000/api';
//   3. Make sure your phone and computer are on the SAME Wi-Fi network.
// ─────────────────────────────────────────────────────────

// export const API_BASE = 'http://192.168.x.x:5000/api';  // ← physical device

export const API_BASE = 'http://localhost:5000/api';