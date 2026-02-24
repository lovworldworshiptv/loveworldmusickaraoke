# Android App Icon Setup Guide

## Adaptive Icon (Android 8+)

After running `npx cap add android`, place your icons in:

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png          (48x48)
│   ├── ic_launcher_foreground.png (108x108)
│   └── ic_launcher_round.png    (48x48)
├── mipmap-hdpi/
│   ├── ic_launcher.png          (72x72)
│   ├── ic_launcher_foreground.png (162x162)
│   └── ic_launcher_round.png    (72x72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png          (96x96)
│   ├── ic_launcher_foreground.png (216x216)
│   └── ic_launcher_round.png    (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png          (144x144)
│   ├── ic_launcher_foreground.png (324x324)
│   └── ic_launcher_round.png    (144x144)
├── mipmap-xxxhdpi/
│   ├── ic_launcher.png          (192x192)
│   ├── ic_launcher_foreground.png (432x432)
│   └── ic_launcher_round.png    (192x192)
└── mipmap-anydpi-v26/
    ├── ic_launcher.xml
    └── ic_launcher_round.xml
```

### Adaptive Icon XML (`mipmap-anydpi-v26/ic_launcher.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

### Background Color (`android/app/src/main/res/values/colors.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1A1A2E</color>
</resources>
```

## Quick Setup with @capacitor/assets (recommended)

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

Place your source icon as `assets/icon-only.png` (1024x1024) and splash as `assets/splash.png` (2732x2732).
