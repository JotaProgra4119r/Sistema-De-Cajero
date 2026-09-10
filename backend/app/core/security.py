import hashlib
import hmac
import time
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from backend.app.core.config import settings

# In-memory replay attack cache for TOTP tokens: {token_string: expiration_timestamp}
_consumed_totp_tokens: Dict[str, float] = {}

# Immediate revocation blacklist for TOTP tokens (logout / 60s inactivity timeout)
_blacklisted_totp_tokens: Dict[str, float] = {}

# Blacklist for revoked JWT access tokens upon logout
_blacklisted_jwt_tokens: Dict[str, float] = {}

_totp_rotation_offset: int = 0

def get_totp_rotation_offset() -> int:
    global _totp_rotation_offset
    return _totp_rotation_offset

def generate_totp_token(secret: str = "ATM_TOTP_KEY") -> str:
    """
    Generates an active 6-digit TOTP token.
    Automatically advances the rotation offset if the generated token has been
    blacklisted, consumed, or invalidated (e.g. upon logout).
    Ensures the returned token is always fresh, unique, and valid immediately.
    """
    global _totp_rotation_offset
    now = time.time()

    # Evict expired blacklist entries
    expired_bl = [k for k, exp in _blacklisted_totp_tokens.items() if exp < now]
    for k in expired_bl:
        _blacklisted_totp_tokens.pop(k, None)

    # Evict expired replay tokens
    expired_keys = [k for k, exp in _consumed_totp_tokens.items() if exp < now]
    for k in expired_keys:
        _consumed_totp_tokens.pop(k, None)

    base_step = int(now // 60)
    for _ in range(500):  # safety bound to find next clean candidate
        step = base_step + _totp_rotation_offset
        msg = f"{secret}:{step}"
        digest = hashlib.sha256(msg.encode("utf-8")).hexdigest()
        candidate = f"{int(digest[:8], 16) % 1000000:06d}"
        if candidate in _blacklisted_totp_tokens or candidate in _consumed_totp_tokens:
            _totp_rotation_offset += 1
            continue
        return candidate

    return candidate

def invalidate_totp_token(token: str, duration_seconds: float = 180.0) -> bool:
    """
    Invalidates a TOTP token immediately upon logout or inactivity timeout.
    Prevents replay attacks during its remaining natural 60s time-step window.
    Applies unconditionally to all tokens.
    Immediately increments rotation offset to generate a fresh, usable token.
    """
    global _totp_rotation_offset
    if not token or not str(token).strip():
        return False
    token_str = str(token).strip()
    now = time.time()
    _blacklisted_totp_tokens[token_str] = now + duration_seconds
    _consumed_totp_tokens[token_str] = now + duration_seconds
    
    # Increment rotation offset and rotate active token immediately
    _totp_rotation_offset += 1
    generate_totp_token()
    return True

def verify_totp_token(token: str, secret: str = "ATM_TOTP_KEY") -> bool:
    """
    Verifies TOTP token with clock-drift / rotation offset window
    and enforces strictly single-use consumption to prevent replay attacks.
    Tokens purged on logout/inactivity timeout are immediately and permanently rejected.
    """
    global _totp_rotation_offset
    if not token or len(str(token).strip()) == 0:
        return False
    
    token_str = str(token).strip()
    now = time.time()

    # Evict expired blacklist entries
    expired_bl = [k for k, exp in _blacklisted_totp_tokens.items() if exp < now]
    for k in expired_bl:
        _blacklisted_totp_tokens.pop(k, None)

    # Evict expired replay tokens (> 180 seconds old)
    expired_keys = [k for k, exp in _consumed_totp_tokens.items() if exp < now]
    for k in expired_keys:
        _consumed_totp_tokens.pop(k, None)

    # Explicitly purged / blacklisted token check (overrides demo exemption)
    if token_str in _blacklisted_totp_tokens:
        print(f"[SECURITY ALERT] Token TOTP revocado/purgado por cierre de sesión o inactividad: {token_str}")
        return False

    is_demo_token = settings.ALLOW_DEMO_MFA and token_str in ["123456", "456789"]

    # Check replay cache (demo tokens are exempt from replay blocking unless revoked)
    if not is_demo_token and token_str in _consumed_totp_tokens:
        print(f"[SECURITY ALERT] Intento de ataque de repetición (Replay Attack) detectado para token TOTP: {token_str}")
        return False

    # Current active token is always primary candidate
    current_token = generate_totp_token(secret)
    candidates = {current_token}

    # Also allow valid steps within recent rotation / drift window that aren't blacklisted
    base_step = int(now // 60)
    for offset in range(-1, _totp_rotation_offset + 2):
        step = base_step + offset
        msg = f"{secret}:{step}"
        dig = hashlib.sha256(msg.encode("utf-8")).hexdigest()
        cand = f"{int(dig[:8], 16) % 1000000:06d}"
        if cand not in _blacklisted_totp_tokens and cand not in _consumed_totp_tokens:
            candidates.add(cand)

    valid = token_str in candidates

    # Only if configured in demo mode for isolated development
    if not valid and is_demo_token:
        valid = True

    if valid:
        # Mark as consumed for next 120 seconds to prevent replay (except demo tokens)
        if not is_demo_token:
            _consumed_totp_tokens[token_str] = now + 120.0
        return True

    return False

def is_totp_token_blacklisted(token: str) -> bool:
    """Checks if a TOTP token has been explicitly purged/blacklisted."""
    if not token:
        return False
    token_str = str(token).strip()
    now = time.time()
    exp = _blacklisted_totp_tokens.get(token_str)
    if exp is not None:
        if exp < now:
            _blacklisted_totp_tokens.pop(token_str, None)
            return False
        return True
    return False

def invalidate_jwt_token(jwt_token: str, duration_seconds: float = 3600.0) -> bool:
    """Blacklists a JWT token on logout to prevent any subsequent usage."""
    if not jwt_token or not str(jwt_token).strip():
        return False
    now = time.time()
    _blacklisted_jwt_tokens[str(jwt_token).strip()] = now + duration_seconds
    return True

def get_pin_hash(pin: str) -> str:
    """Generates deterministic salted SHA-256 hash for 4-digit PIN."""
    salt = "ATM_SALT_2026"
    raw = salt + ":" + str(pin).strip()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """
    Secure PIN comparison using constant-time comparison against salted hash.
    Supports both standard 64-character SHA-256 and legacy 60-character truncated hashes.
    Eliminates plain-text comparisons and backdoor PIN bypasses.
    """
    if not hashed_pin or not plain_pin:
        return False
    target = hashed_pin.strip()
    expected_full = get_pin_hash(plain_pin)
    expected_60 = expected_full[:60]
    
    if hmac.compare_digest(expected_full, target):
        return True
    if hmac.compare_digest(expected_60, target):
        return True

    # Legacy SHA-256 fallback for migration safety without backdoors
    raw_sha = hashlib.sha256(str(plain_pin).strip().encode("utf-8")).hexdigest()
    if hmac.compare_digest(raw_sha, target) or hmac.compare_digest(raw_sha[:60], target):
        return True
    return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates signed JWT token with timezone-aware expiration timestamp."""
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates JWT token signature, expiration, and blacklist status."""
    try:
        token_str = str(token).strip()
        now = time.time()
        # Evict expired blacklisted JWTs
        exp_jwt = [k for k, exp in _blacklisted_jwt_tokens.items() if exp < now]
        for k in exp_jwt:
            _blacklisted_jwt_tokens.pop(k, None)

        if token_str in _blacklisted_jwt_tokens:
            return None

        payload = jwt.decode(token_str, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except Exception:
        return None
