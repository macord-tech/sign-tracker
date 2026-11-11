# Sign Tracker

A shared, live map of temporary sign locations. Coordinators add the addresses and assign each sign to a volunteer. Volunteers open the link on their phone, follow the map, and tag each location **Sign dropped off**. Later the coordinator tasks each sign for pickup, and the pickup volunteer tags it **Sign picked up**. Everyone sees changes as they happen.

- **Hosting:** GitHub Pages (free)
- **Map and address lookup:** OpenStreetMap (free, no key)
- **Directions:** each sign's **Directions** button opens Google Maps navigation on the phone (free, no key)
- **Live shared data:** Google Firebase on the free **Spark** plan
- **No accounts:** each volunteer signs in with a personal code (last 4 digits of their phone + CSP)

Built for ski patrol: red and white in light view, dark grey and red in dark view. Tap the sun/moon button to switch. Each phone remembers its own choice.

**No payment information is needed anywhere.** You won't be asked for a card unless you click "Upgrade" in Firebase. Don't do that, because the free plan is plenty for this.

You can open `index.html` from a local web server before setting anything up. It runs in **demo mode**, where data stays in that browser only. Use the code `CSPadmin` for the coordinator tools, or the sample volunteer code `0142CSP`.

---

## One-time setup (about 20 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Create a project**. Analytics is not needed.
2. On the project home page, click the **Web** icon (`</>`) to add a web app. Give it any nickname and skip Firebase Hosting.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy each value into the `firebase:` section of **`config.js`**.

### 2. Turn on sign-in
1. In Firebase, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous**.
3. Under **Settings → Authorized domains**, click **Add domain** and enter `YOURNAME.github.io`, using your GitHub username.

### 3. Create the database
1. Go to **Build → Firestore Database → Create database**. Pick a location near you (for example `northamerica-northeast1`) and start in **production mode**.
2. Open the **Rules** tab, replace everything with the contents of **`firestore.rules`**, and click **Publish**.
3. The coordinator code **CSPadmin** is set inside the rules, in the line `function adminCode() { return 'CSPadmin'; }`. Security rules can't be read from the app, so it stays private. To change it, edit that line and click **Publish** again. Capital letters don't matter when signing in.

   Volunteer codes are created in the app when a coordinator adds each volunteer (see **Volunteers & access codes** below).

### 4. Set your area in `config.js`
Set `defaultCenter` to your town. Set `addressSuffix` (e.g. `"Vancouver, BC"`) and `countryCodes` (e.g. `"ca"`) so short addresses like "123 Main St" are found in the right city.

### 5. Publish on GitHub Pages
1. On GitHub, create a new **public** repository, e.g. `sign-tracker`.
2. Click **Add file → Upload files** and drag in all the files from this folder. Then commit.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and click **Save**.
4. After about a minute, the app is live at `https://YOURNAME.github.io/sign-tracker/`.

> The Firebase values in `config.js` are designed to be public. They only identify your project. Your data is protected by the security rules and access codes.

---

## Using it

### Emergency and Safety tabs
- **Emergency:** your contact list, with **Call** and **Text** buttons for each person. Coordinators tap **Edit contacts** to add names, roles and phone numbers.
- **Safety:** your safety notes for dropping off and picking up signs. Coordinators tap **Edit safety notes**, and can start from the **starter template**. Formatting is simple: start a line with `#` for a heading, `-` for a bullet, or `!` for a red warning box.
- When the safety notes change, volunteers see a red dot on the Safety tab until they read them.
- Both pages are saved on each phone after they're opened once, so they still work without cell signal. Ask volunteers to open both tabs before heading out.


### Access codes
- **Coordinators** sign in with the master code **CSPadmin** plus their name.
- **Volunteers** sign in with their personal code only: the **last 4 digits of their phone number + CSP**. For example, phone 604-555-0142 gives **0142CSP**. Their name fills in automatically.
- A volunteer can't sign in until a coordinator has added them.

### Volunteers & access codes (coordinator)
1. Open **Manage → Volunteers & access codes**.
2. Type the volunteer's name and phone number, then tap **Add**. Their code appears straight away.
3. **Text code** opens a text message to them with their code and the link, and also copies the message in case your device can't open Messages. **Copy** just copies it, to paste into any app. **Call** rings them. Phone numbers must be complete (10 digits).
4. If two volunteers share the same last 4 digits, the app warns you. Use a different phone number (e.g. a landline) for one of them.
5. **×** removes a volunteer. Their code stops working for new sign-ins, but their sign assignments stay.
6. Names that appear on signs but have no code yet are listed below. Tap one to fill it in, then add their phone.

### Coordinator
1. Open the link, enter **CSPadmin** and your name, then tap **Manage**.
2. Add signs one at a time with **+ New sign** (see below), or paste a list into **Add many at once**. The volunteer named in the list is the **drop-off** volunteer:
   ```
   123 Main St | Pat Lee | NE corner by the bus stop
   45 Oak Ave | Pat Lee
   9 Pine Rd | Sam Wu
   ```
   You can also paste three columns (Address, Volunteer, Notes) straight from a spreadsheet.
3. Each address takes about a second to look up, so a list of 100 signs takes under two minutes. If an address lands in the wrong spot, or can't be found, tap **Edit** on that sign and use **Move pin** (or **Drop pin on map**).
4. **Assigning volunteers:** tap **Assign** on the map (or **Manage → Assign drop-off / Assign pickup**).
   - Choose **Drop-off** or **Pickup** at the top. Each sign has a separate volunteer for each, so after drop-off day you assign pickup again.
   - Pins turn the colour of their volunteer. **Dashed pins have nobody assigned.**
   - Tap pins to select them (they get a red ring and a ✓), then **Assign to…** and pick a name. You can also type a new name.
   - **Last Call Stragglers** lists every sign with nobody assigned for that job. Tick them there, or use **Select stragglers**, then assign.
   - To reassign someone's signs, open their name under **Assigned for…** and tap **Select**.
   - **Unassign** sends signs back to Last Call Stragglers.
   - To give a sign to two people, type both names: `Sam Wu, Pat Lee`.
5. The **Volunteers** table shows each person's progress. **Download CSV** exports everything, with who dropped off and picked up each sign and when.
6. **Locations stay after pickup** until a coordinator deletes them (only coordinators can delete). To use a location again, tap **↺ Use location again** on its card, or select it in Assign mode (Drop-off) and assign a volunteer. **Reset all to "To drop off"** does this for every location at once.

### The sign cycle
1. **Potential location** (grey): the coordinator creates the location. Nobody is tasked yet.
2. **To drop off** (orange): the coordinator assigns a drop-off volunteer in Assign mode (Drop-off).
3. **Sign dropped off** (green): tagged by the drop-off volunteer or a coordinator.
4. **Tasked for pickup:** the coordinator assigns a pickup volunteer in Assign mode (Pickup), or a volunteer claims it with **🙋 I'll pick this up**. **This is only possible once the sign is tagged dropped off.** Until then the pin shows a small red dot.
5. **Picked up:** tagged by the pickup volunteer or a coordinator. The location goes back to grey **Potential location**, ready for next time.

If a drop-off never happens, unassign it in Assign mode (Drop-off → select → Assign to… → **Unassign**). The location goes back to grey **Potential location**.

### Adding a new sign location (anyone)
1. Tap **+ New sign** on the map, or **+ New sign location** at the top of the list.
2. Set the spot in one of three ways: **Drop pin on map**, **Use my location** (stand where the sign goes), or type an address and tap **Find**. Use **Move pin** to adjust it.
3. Check the address (it's filled in automatically when you drop a pin) and describe the exact spot.
4. Tick the **hazards** in the immediate area, and add any others in the box.
5. The sign is assigned to you unless you change the name. Tick **I've already dropped off this sign** if it's already in the ground.
6. **Save sign.** It appears on everyone's map straight away, with its hazards shown on the sign's card.

Volunteers can edit locations they added themselves. Only coordinators can delete a location. To change the hazard checklist, edit `hazardOptions` in `config.js`.

### Heading to the next sign
- The **Next sign** panel at the top of the map shows the address of your next stop in large text. On drop-off day that's your nearest location still to drop off. On pickup day it's your nearest sign still to collect, once it's been tagged dropped off.
- Tap **Navigate** to open directions in your choice of **Apple Maps**, **Google Maps**, **Waze**, or on Android your **phone's default map app**. You can also copy the address.
- Tick **Always use the app I pick** and Navigate goes straight there next time. **Change** switches apps.
- **Skip** moves to the next-nearest sign. The × hides the panel.
- Every sign card's **Directions** button uses the same choice.

### Volunteer
1. Open the link (tip: **Share → Add to Home Screen** makes it feel like an app).
2. Enter your code: the last 4 digits of your phone number + CSP, e.g. **0142CSP**.
3. **My signs** shows only your signs. Tap **Directions** to navigate in Google Maps.
4. At each spot, tap **✓ Sign dropped off**. The pin turns from orange to green for everyone.
5. On pickup day, tap **✓ Sign picked up** at each sign you've been tasked with. The pin turns grey.
   - Pins with a **small red dot** are dropped off but nobody is picking them up. Open one and tap **🙋 I'll pick this up** to take it on yourself.
6. Mistapped? Use **Undo**.
7. **Nearest first** sorts your list by distance from where you are. The target button on the map shows your location.

When you tag your last sign dropped off (or, on pickup day, your last sign picked up), you'll get confetti and a **Thank you for your service!** message.

If there's no signal, keep going. Taps are saved on the phone and sync automatically when the connection returns. The yellow badge shows when that is happening.

### Pin colours
| Colour | Meaning |
|---|---|
| Grey | Potential location (nobody tasked, or already picked up) |
| Orange | To drop off |
| Green | Sign dropped off (waiting for pickup) |

Pins with a dark outline are assigned to you.

---

## Files
| File | What it is |
|---|---|
| `index.html` | Page layout |
| `styles.css` | Look and feel (mobile-first) |
| `app.js` | Map, list, buttons and coordinator tools |
| `store.js` | Saving and live updates (Firebase, or demo mode) |
| `config.js` | **Your settings: the only file you need to edit** |
| `logo.png`, `icon-180.png`, `favicon.png` | Winter Extreme logo, home-screen icon and browser-tab icon. Replace them with files of the same names to change the branding |
| `firestore.rules` | Database security rules to paste into Firebase |

## Troubleshooting
- **Coordinator code not recognised**: check that the latest `firestore.rules` is published in Firebase (the code is set in its `adminCode()` line).
- **Volunteer code "isn't on the volunteer list"**: the coordinator needs to add them under **Manage → Volunteers & access codes**, with the right phone number.
- **Stuck on "Connecting…" or a sign-in error**: Anonymous sign-in isn't enabled, or your `github.io` domain isn't in Authorized domains.
- **Addresses not found**: the free lookup is less forgiving than Google's. Include the street type (St, Ave, Rd), set `addressSuffix` and `countryCodes` in `config.js`, or use **Drop pin on map** when adding the sign.
- **A volunteer sees "No signs assigned"**: assign signs to them in **Assign** mode. Pick their name from the list so it matches their volunteer entry exactly.

## A note on the codes
Codes made from phone digits are easy to remember, but they're not strong passwords: anyone who knows a volunteer's phone number could sign in as them. A signed-in volunteer can see the signs, add new drop-off locations, and tag their assigned signs dropped off or picked up. Only the CSPadmin code can change assignments or see phone numbers. Keep CSPadmin to coordinators, and change it in the rules after each event if you like.
