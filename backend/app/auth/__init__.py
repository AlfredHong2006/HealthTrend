"""Sign-in primitives: login codes, session tokens and code delivery.

Framework-free and storage-free. This package generates and authenticates secrets and sends
one email; deciding *when* to do any of that -- allow-lists, rate limits, expiry, creating the
user -- belongs to :mod:`app.services.auth`, and reading or writing rows belongs to
:mod:`app.persistence`.

Two kinds of secret, protected differently on purpose:

* **Login codes** are six digits: a million possibilities. A plain hash of one is no protection
  at all, because every candidate can be hashed in well under a second. So a code is stored as
  ``HMAC-SHA256(auth_secret, normalised_email + ":" + code)``, keyed with a server secret that
  lives in the environment and never in the database. A copy of the ``login_codes`` table is
  then useless without that secret. Including the email binds the code to the address it was
  sent to.
* **Session tokens** carry 256 bits from :mod:`secrets`. No search covers that space, so a plain
  SHA-256 is enough to make a copied ``sessions`` table unusable, and it needs no key.

Both comparisons use :func:`hmac.compare_digest`.
"""
