# Android assets update checklist

This checklist explains how to replace native Android icons and resources after updating the web assets for a brand refresh.

1. Replace web icons (PWA)
   - Put updated web icons into `www/icons/` (48,72,96,128,192,256,512). Keep the same filenames (`icon-48.webp`, ...).
   - Update `www/manifest.json` `theme_color` and `background_color` if needed.

2. Update Android launcher icons (mipmap)
   - Create launcher icons in required sizes and densities (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi). Filenames typically live under:
     - `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
     - `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
     - `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
     - `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
     - `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
   - If your project uses adaptive icons, update `ic_launcher.xml` in `mipmap-anydpi-v26` and provide foreground and background layers.

3. Update Play Store feature graphics (optional)
   - Replace `resources/feature_graphics/*` with the new feature graphic set (1024x500 recommended) and promotional images.

4. Colors and theme
   - If you want native color parity, update `android/app/src/main/res/values/colors.xml` (create if missing) with entries such as:
     ```xml
     <color name="colorPrimary">#C4622D</color>
     <color name="colorPrimaryDark">#9B4620</color>
     <color name="colorAccent">#C4622D</color>
     ```
   - Update `styles.xml` to reference these colors if necessary.

5. Sync web assets to native
   - Run:
     ```bash
     npx cap copy android
     npx cap open android
     ```
   - Then rebuild in Android Studio and test on emulator/device.

6. Verify
   - Install the APK on an emulator/device and confirm launcher icon, adaptive icon layers, app theme color in the system UI and Play Store screenshot/feature graphic.

Notes
- Replacing native resources requires rebuilding the native project (Gradle build). Keep a backup of original mipmap files.
- If you want, I can generate a set of placeholder PNGs and adaptive icon XML based on the new logo; tell me whether to generate simple flat icons or adaptive layered icons.
