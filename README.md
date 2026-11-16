# Brikoh — merchant app (Expo / React Native)

A native mobile version of the Brikoh merchant dashboard. Same backend (`https://oja-r4vs.onrender.com`), same accounts.

## Run it
```
npm install
npx expo install --fix     # aligns package versions with your Expo SDK
npx expo start             # scan the QR with Expo Go (iOS/Android)
```

## What's native
Sign in / register / onboarding · Home · Orders (+ confirm/reject payment) · Sell (POS with variants, branches, cash/transfer/card/credit, receipt) · Products (create, edit, publish, delete, stock adjust) · Customers (CRUD, credit repayments) · Wallet & withdrawals · Invoices · Discounts · Expenses · Analytics · Reports · Branches & transfers · Purchases & suppliers · Storefront Studio · Staff · Support tickets · Settings (business, storefront, delivery, bank accounts, notifications, plan).
Menu items respect each role's permissions.

## Not included yet
- Image upload (image fields take a URL), barcode scanning
- Push notifications, biometric unlock
- Public storefront / landing / careers pages (the app links out to your storefront)
- Reports: custom date range and CSV export; ticket close/reopen; editing staff permissions (mirrors the web app's current limits)

Tested via typecheck, Android/iOS/web bundle exports and a mocked-API browser walkthrough; not yet run on a physical device.
