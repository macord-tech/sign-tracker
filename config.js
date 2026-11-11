// ============================================================
//  SIGN TRACKER — CONFIGURATION
//  Everything here is free. No credit card or payment details are needed.
//  Leave the Firebase values blank to run in DEMO MODE (data stays in this browser only).
// ============================================================

window.APP_CONFIG = {
  // Name shown at the top of the app
  eventName: "Sign Tracker",
  // Volunteer codes = last 4 digits of their phone + this suffix (e.g. 0142CSP)
  codeSuffix: "CSP",

  // Shown in the browser tab and home-screen name
  orgName: "Winter Extreme",


  // --- Map (OpenStreetMap: free, no key needed) --------------------------
  // The map always opens here (set fitToSignsOnOpen: true to zoom to the signs instead)
  defaultCenter: { lat: 50.6745, lng: -120.3273 }, // Kamloops, BC
  defaultZoom: 12,
  fitToSignsOnOpen: false,

  // Helps the address lookup find the right place:
  //   addressSuffix is added to addresses that don't already name a city.
  //   countryCodes limits results to these countries ("ca", "us", or "ca,us").
  addressSuffix: "Kamloops, BC",
  countryCodes: "ca",

  // Hazard checkboxes shown when someone adds or edits a sign location.
  // Edit, add or remove lines to suit your area.
  hazardOptions: [
    "Heavy or fast traffic",
    "No shoulder / narrow road",
    "Blind corner or hill",
    "Ice / slippery footing",
    "Deep snow or snowbank",
    "Snowplow route",
    "Ditch or steep drop",
    "Poor lighting at night",
    "Uneven ground",
    "Construction nearby",
    "Dogs or wildlife"
  ],

  // --- Firebase (free "Spark" plan: real-time shared data) ----------------
  // Paste the "firebaseConfig" values from Firebase console > Project settings > Your apps.
  firebase: {
    apiKey: "AIzaSyACxe6nzQLROz-dKwT2Ky0OHywtUUEhYLE",
    authDomain: "winter-extreme-signs.firebaseapp.com",
    projectId: "winter-extreme-signs",
    storageBucket: "winter-extreme-signs.firebasestorage.app",
    messagingSenderId: "108969981865",
    appId: "1:108969981865:web:c7cf5b6b62b22a6a17b6b8"
  }
};
