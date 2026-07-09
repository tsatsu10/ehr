# Can't Log In? — Quick Card

| Field | Value |
|-------|-------|
| **Print** | One page, laminate, keep at reception + admin desk |
| **Applies to** | New Clinic staff logins (this clinic's system only) |
| **Owner** | Clinic local admin |

---

## For staff — you can't get in

1. **Check Caps Lock and the clinic, then tap the 👁 eye icon** next to the password box to
   see what you're typing. Most "wrong password" is a typo on a shared keyboard.
2. **Wait 5 minutes and try again.** After 10 wrong tries the account locks itself, then
   **unlocks on its own after 5 minutes**. Get a coffee, come back.
3. **Still stuck? Ask your clinic admin** to unlock you or set a temporary password — it's
   instant and on-site. **Do not** create a second account or share someone else's login.

## For the admin — a staffer is locked out

1. Open **Admin → People & Access → Staff**. A yellow **"accounts locked"** banner lists
   who is locked. Click **Unlock now** — they can log in immediately.
2. If they've truly forgotten it, use **Reset password**: type a simple temporary password,
   leave **"Require change at next login"** ticked, and read it out to them. The system makes
   them set their own password before they reach their desk — so you never know their real one.
3. **Never email passwords.** Hand them over in person or by phone. If someone is leaving,
   **deactivate** their account (don't reuse it).

---

**Why it works this way:** the system is deliberately forgiving to people (loose lockout,
fast self-unlock, no forced monthly password changes) because a receptionist frozen mid-queue
is a real problem. Bots are stopped at the network layer, not by punishing staff. See
`NEW_CLINIC_V1_SECURITY_HARDENING_PROMPT.md` SEC-5.
