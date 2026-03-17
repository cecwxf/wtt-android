# Distribution Guide — WTT Android

## Google Play

### Account Setup
1. Register Google Play Developer account ($25 one-time fee)
2. Verify identity (ID + photo)
3. Set up Google Play Console

### Pre-launch Checklist
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots: phone (2+), 7" tablet, 10" tablet
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Privacy policy URL (hosted on waxbyte.com)
- [ ] Content rating questionnaire
- [ ] Target audience and content declaration
- [ ] App signing enrolled (Google manages key)

### Release Process
```bash
# Build release AAB (Android App Bundle)
./gradlew :app:bundleGlobalRelease

# Upload to Play Console → Production track
# → Staged rollout (10% → 50% → 100%)
```

---

## China App Stores (国内)

### Prerequisites

#### 1. Software Copyright (软件著作权)
- Apply at 中国版权保护中心 (www.ccopyright.com.cn)
- Processing time: 30 working days (standard) or 3 days (expedited ¥800)
- Required: source code printout (first/last 30 pages), design docs
- Certificate name: "WTT智能助手软件" or similar

#### 2. ICP Filing (ICP备案)
- Required because app connects to servers in China
- Apply through cloud provider (Tencent Cloud / Aliyun)
- Domain: waxbyte.com must have ICP备案号

#### 3. Privacy Compliance
- First-launch privacy popup (required by all CN stores)
- List all data collected, purposes, third-party SDKs
- User must explicitly agree before any data collection

### Store-by-Store Guide

| Store | URL | Review Time |
|-------|-----|-------------|
| 华为应用市场 | developer.huawei.com | 1-3 days |
| 小米应用商店 | dev.mi.com | 1-3 days |
| OPPO软件商店 | open.oppomobile.com | 1-5 days |
| vivo应用商店 | dev.vivo.com.cn | 1-3 days |
| 应用宝 | open.tencent.com | 3-7 days |

All stores require: 软件著作权证书, real-name developer account, privacy policy, and no GMS-only dependencies.

### Build Variants

```kotlin
// build.gradle.kts
android {
    flavorDimensions += "distribution"
    productFlavors {
        create("global") {
            dimension = "distribution"
            // Google Play Services, FCM, Google Sign-In
        }
        create("china") {
            dimension = "distribution"
            applicationIdSuffix = ".cn"
            // HMS, vendor push SDKs, WeChat/Alipay payment
        }
    }
}
```

| Feature | `global` | `china` |
|---------|----------|---------|
| Push | FCM | HMS + MiPush + OPPO + vivo |
| OAuth | GitHub + Google | GitHub + WeChat |
| Payment | Google Play Billing | Alipay + WeChat Pay |
| Analytics | Firebase | 友盟 (Umeng) |
| Crash | Crashlytics | Bugly |

### CI/CD

GitHub Actions builds both flavors on tag push, uploads AAB to Google Play automatically, and publishes China APK as release artifact for manual store submission.
