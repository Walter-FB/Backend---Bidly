import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


async def send_verification_code(email: str, code: str) -> None:
    if not settings.BREVO_API_KEY:
        print(f"[DEV] Código de verificación para {email}: {code}", flush=True)
        return

    html = f"""
    <html><body style="font-family:Arial;background:#0b1022;color:#fff;padding:32px">
      <h2 style="color:#3a8fd6">Bidly — Código de verificación</h2>
      <p>Tu código de verificación es:</p>
      <h1 style="color:#37d66f;letter-spacing:8px">{code}</h1>
      <p style="color:#aaa">Válido por 10 minutos.</p>
    </body></html>
    """

    payload = {
        "sender": {"email": settings.BREVO_FROM_EMAIL, "name": "Bidly"},
        "to": [{"email": email}],
        "subject": "Código de verificación Bidly",
        "htmlContent": html,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            BREVO_URL,
            headers={
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
