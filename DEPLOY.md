# SchoolOS isolated parent/staff invitation flow

## 1. Replace the React page

Replace:

`src/pages/AcceptInvitation.tsx`

with the included `AcceptInvitation.tsx`.

The page has two isolated modes:

- Staff: `confirmation_url` -> normal Supabase ConfirmationURL -> Supabase session -> `auth.updateUser({ password })`
- Parent: `mode=parent&token_hash=...` -> `accept-parent-invite` verify action -> signed setup token -> `accept-parent-invite` set-password action

## 2. Replace the parent Edge Function

Copy:

`supabase/functions/accept-parent-invite/index.ts`

to:

`supabase/functions/accept-parent-invite/index.ts`

This function must be reachable without a user JWT because the parent has not logged in yet.

## 3. Disable platform JWT verification ONLY for this function

Add this block to the existing `supabase/config.toml`:

```toml
[functions.accept-parent-invite]
verify_jwt = false
```

Do not disable JWT verification for `invite-school-user` or other authenticated staff/admin functions.

Supabase documents that Edge Functions default to requiring a JWT, and functions that must accept unauthenticated requests need `verify_jwt = false`. The function still performs its own token and role checks.

## 4. Deploy only the parent function

```bash
npx supabase functions deploy accept-parent-invite --no-verify-jwt
```

The `--no-verify-jwt` flag is also supported for deployment. Keeping the config block makes the setting explicit and consistent.

## 5. Update the Supabase Invite User email template

Use `INVITE_USER_TEMPLATE.html`.

Parent button:

```html
href="{{ .RedirectTo }}?mode=parent&amp;token_hash={{ .TokenHash }}&amp;type=invite"
```

Staff button:

```html
href="{{ .RedirectTo }}?confirmation_url={{ .ConfirmationURL }}"
```

This means neither parent nor staff email directly opens the Edge Function or consumes the one-time token before the user clicks the SchoolOS button.

## 6. Test

### Staff

Fresh staff invitation -> `/accept-invitation?confirmation_url=...` -> Accept invitation -> Supabase verify -> password screen -> staff dashboard.

### Parent

Fresh parent invitation -> `/accept-invitation?mode=parent&token_hash=...&type=invite` -> Accept invitation -> parent Edge Function verify -> password screen -> set password -> login -> Parent dashboard.

Do not reuse old invitation tokens.
