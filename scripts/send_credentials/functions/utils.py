from config import EMAIL_USER, EMAIL_APP_PASSWORD
import csv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

def read_csv(csv_file, column_names):
  with open(csv_file, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    try:
      column = [[row[column_name] for column_name in column_names] for row in reader]

    except Exception as e:
      print(f"Column name not found in CSV file. {e}")
      return None

  return column

def send_mail(from_email, to_email, subject, body, display_name):
    message = MIMEMultipart("related")
    message["From"] = formataddr((display_name, from_email))
    message["To"] = to_email
    message["Subject"] = subject

    msg_alternative = MIMEMultipart("alternative")
    msg_alternative.attach(MIMEText(body, "html"))
    message.attach(msg_alternative)

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(EMAIL_USER, EMAIL_APP_PASSWORD)
    server.sendmail(from_email, to_email, message.as_string())
    server.quit()
  
def get_email_body(user_name):
  return f"""
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap" rel="stylesheet">
      </head>
      <body style="color: black; font-family: 'Trebuchet MS', sans-serif; font-size: 1.3rem">
        <p>Hola {user_name},</p>
        <p>Te damos la bienvenida a Novatadas Informática. Aquí tienes tus credenciales de acceso:</p>
        <p><strong>Usuario:</strong> {user_name}</p>
        <p><strong>Contraseña:</strong> tu contraseña es tu nombre de usuario.</p>
        <p>Recuerda que puedes cambiar tu contraseña en cualquier momento desde tu perfil.</p>
        <p>¡Disfruta de la experiencia!</p>
      </body>
    </html>
  """