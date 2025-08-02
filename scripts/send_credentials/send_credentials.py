from functions.utils import read_csv, send_mail, get_email_body
from config import EMAIL_FROM, EMAIL_SUBJECT, DISPLAY_NAME

def main():
  users = read_csv("CSV/NOVATOS_WEB_NOVATOS_2025-2026.csv", ["name", "email"])
  
  ### TODO: Create user in database
  
  for name, email in users:
    send_mail(EMAIL_FROM, email, EMAIL_SUBJECT, get_email_body(name), DISPLAY_NAME)
  
  
if __name__ == "__main__":
  main()