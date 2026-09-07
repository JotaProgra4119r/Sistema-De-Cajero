import hashlib
import hmac
import time
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from backend.app.core.config import settings

# In-memory replay attack cache for TOTP tokens: {token_string: expiration_timestamp}
_consumed_totp_tokens: Dict[str, float] = {}

def get_pin_hash(pin: str) -> str:
    """Generates deterministic salted SHA-256 hash for 4-digit PIN."""
    salt = "ATM_SALT_2026"
    raw = salt + ":" + str(pin).strip()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:60]

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """
    Secure PIN comparison using constant-time comparison against salted hash.
    Eliminates plain-text comparisons and backdoor PIN bypasses.
    """
    if not hashed_pin or not plain_pin:
        return False
    expected = get_pin_hash(plain_pin)
    if hmac.compare_digest(expected, hashed_pin):
        return True
    # Legacy SHA-256 fallback for migration safety without backdoors
    raw_sha = hashlib.sha256(str(plain_pin).strip().encode("utf-8")).hexdigest()
    if hmac.compare_digest(raw_sha[:60], hashed_pin) or hmac.compare_digest(raw_sha, hashed_pin):
        return True
    return False

def generate_totp_token(secret: str = "ATM_TOTP_KEY") -> str:
    """Generates 6-digit TOTP token for current 60s timestep."""
    timestep = int(time.time() // 60)
    msg = f"{secret}:{timestep}"
    digest = hashlib.sha256(msg.encode("utf-8")).hexdigest()
    code = int(digest[:8], 16) % 1000000
    return f"{code:06d}"

def verify_totp_token(token: str, secret: str = "ATM_TOTP_KEY") -> bool:
    """
    Verifies TOTP token with clock-drift window (current and previous step)
    and enforces strictly single-use consumption to prevent replay attacks.
    """
    if not token or len(str(token).strip()) == 0:
        return False
    
    token_str = str(token).strip()
    now = time.time()

    # Evict expired replay tokens (> 180 seconds old)
    expired_keys = [k for k, exp in _consumed_totp_tokens.items() if exp < now]
    for k in expired_keys:
        _consumed_totp_tokens.pop(k, None)

    # Check replay cache
    if token_str in _consumed_totp_tokens:
        print(f"[SECURITY ALERT] Intento de ataque de repetición (Replay Attack) detectado para token TOTP: {token_str}")
        return False

    current_token = generate_totp_token(secret)
    prev_step = int(now // 60) - 1
    prev_msg = f"{secret}:{prev_step}"
    prev_digest = hashlib.sha256(prev_msg.encode("utf-8")).hexdigest()
    prev_token = f"{int(prev_digest[:8], 16) % 1000000:06d}"

    valid = token_str in [current_token, prev_token]

    # Only if configured in demo mode for isolated development
    if not valid and settings.ALLOW_DEMO_MFA:
        valid = token_str in ["123456", "456789"]

    if valid:
        # Mark as consumed for next 120 seconds to prevent replay
        _consumed_totp_tokens[token_str] = now + 120.0
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
    """Decodes and validates JWT token signature and expiration."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except Exception:
        return None
