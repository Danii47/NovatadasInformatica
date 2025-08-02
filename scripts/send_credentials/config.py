import os
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
DISPLAY_NAME = "Novatadas Informática"
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")
EMAIL_FROM = "correo@example.com"
EMAIL_SUBJECT = "Novatadas Informática 2025 - 2026: Credenciales de acceso"