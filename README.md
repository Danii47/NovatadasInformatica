# Novatadas Informática

Plataforma de retos y marcador de las novatadas de Ingeniería Informática.
Los novatos solicitan retos, los veteranos los validan y el marcador ordena a
todo el mundo por puntos.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena los valores
npm run dev
```

La aplicación escucha en `http://localhost:3000`.

### Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `MONGOOSE_CONNECT` | sí | Cadena de conexión de MongoDB. |
| `SECRET_JWT_KEY` | sí | Clave de firma de las sesiones. **Mínimo 32 caracteres.** |
| `PORT` | no | Puerto de escucha (3000 por defecto). |
| `NODE_ENV` | en producción | Ponlo a `production` en el despliegue: activa la cookie `Secure`. |
| `EDITION` | no | Curso que se muestra en la interfaz (`26-27` por defecto). |
| `SALT_ROUNDS` | no | Coste de bcrypt (10 por defecto). |
| `DISCORD_WEBHOOK_LOGIN` | no | Webhook de avisos de inicio de sesión. |
| `DISCORD_WEBHOOK_REQUEST_CHALLENGE` | no | Webhook de avisos de retos solicitados. |
| `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `EMAIL_FROM`, `WEB_URL` | solo para el script de correos | Cuenta de Gmail y contraseña de aplicación. |

> `SECRET_JWT_KEY` y `MONGOOSE_CONNECT` no tienen valor por defecto: si faltan,
> el servidor no arranca. Es deliberado — un secreto por defecto en el
> repositorio permitiría a cualquiera firmarse un token de administrador.

## Roles

| Rol | Puede |
| --- | --- |
| **Novato** | Ver el marcador y los retos, y solicitar retos. |
| **Veterano** (`isAdmin`) | Todo lo anterior + validar retos, crear retos y usuarios sueltos. No aparece en el marcador. |
| **Super admin** (`isSuperAdmin`) | Todo + gestión de usuarios, roles, puntos extra, borrados masivos y registro de actividad. |

`isSuperAdmin` solo se activa a mano desde la base de datos. Ninguna acción de
la web puede crear, degradar ni borrar a un super administrador.

## Migración de curso

Todo se hace desde **Gestión** (`/gestion`), visible solo para super admins.

### 1. Cerrar el curso anterior

En la pestaña *Fin de curso*, con confirmación escrita en cada caso:

- **Reiniciar el progreso** — puntos, retos y premios a cero; las cuentas se quedan.
- **Borrar a todos los novatos** — conserva a los veteranos y a ti.
- **Borrar todas las cuentas menos la mía** — se va también el resto de veteranos.

Tu cuenta y la de cualquier otro super admin nunca se borran.

### 2. Dar de alta al curso nuevo

En la pestaña *Importar*, pega una línea por persona. Se admite:

```
Ana Pérez;ana.perez@alu.uni.es
Luis Gómez,luis@alu.uni.es
Marta Ruiz	marta@alu.uni.es          ← pegado directo desde Excel o Sheets
carlos.vega@alu.uni.es                   ← el nombre se deduce del correo
Sara Peña;sara@alu.uni.es;admin          ← se crea como veterana
```

Antes de crear nada verás una previsualización con las filas válidas y las
problemáticas. Al confirmar, las contraseñas generadas se muestran **una sola
vez**: cópialas o descarga el CSV en ese momento. Después solo se pueden
regenerar una a una.

Si además quieres enviar las credenciales por correo:

```bash
npm run send-credentials -- ruta/al/fichero.csv --dry-run   # ensayo
npm run send-credentials -- ruta/al/fichero.csv             # de verdad
```

El CSV necesita las columnas `name`, `email` y, si procede, `status` con el
valor `admin`. El script deja una copia de las credenciales en
`credenciales-AAAA-MM-DD.csv` por si algún correo no llega.

### 3. Registro

La pestaña *Registro* guarda quién hizo qué y cuándo: altas, borrados, cambios
de rol, puntos concedidos y validaciones de retos.

## Comandos

```bash
npm run dev               # desarrollo con recarga
npm start                 # producción
npm run lint              # standard
npm run send-credentials  # altas desde CSV con envío de correo
```

## Estructura

```
index.js               Rutas y middlewares
config.js              Variables de entorno (falla rápido si falta algo)
user-repository.js     Usuarios: alta, alta masiva, roles, borrados, puntos
challenge-repository.js Retos
audit-repository.js    Registro de actividad
middlewares/           Sesión por rol, CORS, cabeceras de seguridad, rate limit
schemas/               Modelos de Mongoose
utils/                 Contraseñas, escapado, webhooks
views/                 Plantillas EJS (partials/ para cabecera y avisos)
public/styles/         theme.css es el sistema de diseño; el resto, por página
public/js/             notify.js, picker.js (selector con búsqueda), parseUsers.js
```
