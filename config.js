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
  // Where the map opens before any signs exist
  defaultCenter: { lat: 49.2827, lng: -123.1207 }, // Vancouver, BC
  defaultZoom: 12,

  // Helps the address lookup find the right place:
  //   addressSuffix is added to addresses that don't already name a city.
  //   countryCodes limits results to these countries ("ca", "us", or "ca,us").
  addressSuffix: "",          // e.g. "Vancouver, BC"
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
    "Overhead power lines",
    "Poor lighting at night",
    "Uneven ground",
    "Construction nearby",
    "Dogs or wildlife"
  ],

  // --- Firebase (free "Spark" plan: real-time shared data) ----------------
  // Paste the "firebaseConfig" values from Firebase console > Project settings > Your apps.
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};
