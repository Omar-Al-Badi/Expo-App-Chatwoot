# 📱 Building APK for WhatsApp Business Chat

This guide will help you build an Android APK file from your Expo React Native app.

## 🚀 Quick Start

### Prerequisites

1. **Expo Account** (Free)
   - Sign up at: https://expo.dev/signup
   - Free tier includes 30 builds/month

2. **EAS CLI** (Already installed ✅)
   - Version: 16.4.1

---

## 📦 Build Your APK

### Step 1: Login to Expo

```bash
eas login
```

Enter your Expo credentials when prompted.

### Step 2: Verify Configuration

Your project is already configured! ✅

- **App Name**: WhatsApp Business Chat
- **Package**: com.whatsappbusiness.chat
- **Build Profile**: `preview` (builds APK)

### Step 3: Start the Build

```bash
eas build --platform android --profile preview
```

**What happens:**
1. EAS will ask if you want to auto-generate a keystore → **Select YES**
2. Your code will be uploaded to Expo's cloud servers
3. Build will start (typically 10-30 minutes)
4. You'll receive a download link when complete

### Step 4: Download Your APK

After the build completes:

**Option A: From Terminal**
- Click the download link shown in the terminal
- Or scan the QR code to install directly on your Android device

**Option B: From Dashboard**
- Visit: https://expo.dev/accounts/[your-username]/projects/whatsapp-business-chat/builds
- Download the APK file

**Option C: Command Line**
```bash
# Check build status
eas build:list

# View specific build details
eas build:view [build-id]
```

---

## 📲 Installing the APK

### On Android Device (Easiest)

1. Open the download link on your Android device
2. Download the APK
3. Tap the file to install
4. Allow installation from unknown sources if prompted

### Using ADB (Advanced)

```bash
# Download the APK first, then:
adb install path/to/whatsapp-business-chat.apk
```

---

## 🔧 Build Profiles Explained

Your `eas.json` has 3 build profiles:

### `preview` (APK - For Testing)
```bash
eas build --platform android --profile preview
```
- Builds an **APK** file
- Can be installed directly on devices
- Perfect for testing before Play Store release
- **Use this for most testing**

### `production` (AAB - For Play Store)
```bash
eas build --platform android --profile production
```
- Builds an **AAB** (Android App Bundle)
- Required for Google Play Store
- Optimized file size
- Use when ready to publish

### `development` (Development Build)
```bash
eas build --platform android --profile development
```
- For development with custom native code
- Not needed for most Expo apps

---

## 🎯 Important Notes

### Backend Configuration

Your app needs to connect to your backend. Make sure:

1. **Backend is running** when testing the APK
2. **Update backend URL** in the APK:
   - Edit the build command with env variable:
   ```bash
   EXPO_PUBLIC_BACKEND_URL=https://your-domain.com eas build --platform android --profile preview
   ```

   Or set it permanently in `eas.json`:
   ```json
   {
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         },
         "env": {
           "EXPO_PUBLIC_BACKEND_URL": "https://your-production-domain.com"
         }
       }
     }
   }
   ```

### Free Tier Limits

- **30 builds/month** (free)
- **Low-priority queue** (may take longer during peak hours)
- **Best times to build**: Late night / weekends (faster queue)

### Troubleshooting

**Build stuck in queue?**
- Free tier uses low-priority queue
- Wait time can be 1-6+ hours during peak times
- Check status: https://status.expo.dev/

**Build failed?**
- View logs: `eas build:view [build-id]`
- Common issues:
  - Missing dependencies in package.json
  - Environment variable issues
  - Asset/image path problems

**Need to rebuild?**
```bash
# Delete old builds to save space in dashboard
eas build:delete [build-id]

# Start fresh build
eas build --platform android --profile preview --clear-cache
```

---

## 📚 Additional Resources

- **Expo Build Docs**: https://docs.expo.dev/build/setup/
- **APK vs AAB**: https://docs.expo.dev/build-reference/apk/
- **EAS Pricing**: https://expo.dev/pricing
- **Build Dashboard**: https://expo.dev/accounts/[your-username]/projects

---

## 🎉 Quick Command Reference

```bash
# Login
eas login

# Check who's logged in
eas whoami

# Build APK
eas build --platform android --profile preview

# Check build status
eas build:list

# View specific build
eas build:view [build-id]

# Cancel ongoing build
eas build:cancel

# Configure project
eas build:configure
```

---

## 🔐 Publishing to Google Play Store

When you're ready to publish:

1. Build production AAB:
   ```bash
   eas build --platform android --profile production
   ```

2. Create a Google Play Developer account ($25 one-time fee)

3. Upload the AAB file to Play Console

4. Submit for review

**Detailed guide**: https://docs.expo.dev/submit/android/

---

**Need help?** 
- Expo Discord: https://chat.expo.dev/
- Expo Forums: https://forums.expo.dev/
