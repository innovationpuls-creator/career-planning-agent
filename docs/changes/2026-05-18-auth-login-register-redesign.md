# Auth Login/Register Redesign

## Summary

- Rebuilt login/register around the shared auth split shell, art console, right-side warm paper surface, glass card, route morph, and dynamic coach tool console.
- Preserved existing login/register/onboarding business flows and existing Claude form controls.
- Added mobile auth shell adjustments so the left art console appears first and the right form surface remains reachable through the app root scroll container.

## Files Changed

- `myapp/src/components/auth/*`
- `myapp/src/pages/user/login/index.tsx`
- `myapp/src/pages/user/register/index.tsx`
- `myapp/src/pages/user/login/login.test.tsx`
- `myapp/src/pages/user/register/register.test.tsx`
- `myapp/tests/setupTests.jsx`

## Tests Run

- `cd myapp && npm test -- src/components/auth`
- `cd myapp && npm test -- src/pages/user/login/login.test.tsx src/pages/user/register/register.test.tsx`
- `cd myapp && npm run tsc`
- `cd myapp && npm run build`

## Visual QA

Screenshots and report:

- `docs/images/test/auth-redesign-2026-05-18/login-desktop.png`
- `docs/images/test/auth-redesign-2026-05-18/register-desktop.png`
- `docs/images/test/auth-redesign-2026-05-18/register-step-2.png`
- `docs/images/test/auth-redesign-2026-05-18/login-mobile.png`
- `docs/images/test/auth-redesign-2026-05-18/login-mobile-form.png`
- `docs/images/test/auth-redesign-2026-05-18/visual-report.json`

Verified:

- Desktop split is 55/45.
- Right blobs are contained in the right warm paper surface.
- Spotlight uses right-surface CSS variables and remains while idle, then fades on leave.
- Console appends a tool line after the 2200ms interval.
- Login/register route morph delays navigation until the morph duration completes.
- Browser back/forward renders target routes without invoking the click morph.
- Mobile order is art console first, form surface second; the form is reachable via the root scroll container.

## Known Limitations

- The dev server logs existing missing `react-intl` messages for the English locale and falls back to default messages.
