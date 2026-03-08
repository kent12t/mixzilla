# YouTube Live EQ

A retro-futuristic 1985-styled Firefox WebExtension that applies a live 5-band Equalizer to YouTube and YouTube Music.

## Features
- **Real-time 5-Band EQ**: Precisely adjust 60Hz, 170Hz, 350Hz, 1kHz, and 3.5kHz ranges.
- **Preamp Control**: Prevent clipping or boost quiet tracks.
- **9 Custom Presets**: Includes Flat, Bass Boost, Hyper Bass, Vocal, Smile, Sparkle, Electronic, Classical, and a quick Reset.
- **Persistent Settings**: Saves your EQ settings locally and auto-applies them on reload or navigation.
- **Retro Cyberpunk UI**: Features neon accents, scanlines, and tactile controls straight out of an 80s control panel.

## Installation for Development
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file from this project's directory.
4. Pin the extension to your toolbar and open YouTube!

## Deployment Plan (Firefox Add-on Store)

Follow these steps to deploy this add-on to the Mozilla Add-ons (AMO) store:

### 1. Create a Mozilla Developer Account
If you don't already have one, create an account on [Mozilla Add-ons (AMO) Developer Hub](https://addons.mozilla.org/en-US/developers/).

### 2. Package the Extension
Compress the contents of the project into a ZIP file. **Do not** zip the folder itself; zip the files *inside* the folder so that `manifest.json` is at the root of the ZIP archive.
```bash
zip -r youtube-live-eq.zip manifest.json content popup icons
```

### 3. Submit for Review
1. Go to the AMO Developer Hub and click **Submit a New Add-on**.
2. Choose **On this site** (to list it publicly on the Firefox store).
3. Upload your `youtube-live-eq.zip` file. The automated linter will check for issues (e.g., manifest errors).
4. Fill out the store listing details:
   - **Name**: YouTube Live EQ
   - **Summary**: Live equalizer for YouTube and YouTube Music playback.
   - **Description**: Add a detailed description of the features, why it requires its permissions (storage for saving settings, host permissions for applying audio processing to youtube.com), and emphasize the retro UI.
   - **Category**: Music & Video, Appearance, or similar.
5. Provide screenshots of the extension's popup interface in action.

### 4. Await Approval
Once submitted, the add-on goes through a manual review process by Mozilla's reviewers. They will test the extension to ensure it is safe, does exactly what it claims to do, and requests only necessary permissions.

### 5. Updates
To release future updates, just increment the `"version"` string in `manifest.json`, re-zip, and upload the new version through your AMO Developer Dashboard.
