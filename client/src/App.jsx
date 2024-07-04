import { useEffect, useState } from 'react'
import './App.css'

function App() {

  const [userData, setUserData] = useState("")
  const [error, setError] = useState("")

  const handleLogIn = (event) => {
    event.preventDefault()
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    if (!username || !password) return setError('Por favor, rellena todos los campos')

    fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dni: username.toUpperCase(),
        password
      })
    })
      .then(res => res.json())
      .then((data) => {
        if (data.err) {
          setError(data.err)
        } else {
          setUserData(data)
        }
      })
  }

  return (
    <>
      <div className="login-container">
        <h2>Iniciar Sesión</h2>
        <form method="post">
          <div className="input-group">
            <label htmlFor="username">Nombre de Usuario</label>
            <input type="text" id="username" name="username" required />
          </div>
          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <input type="password" id="password" name="password" required />
            </div>
          <p className="loginError">{error}</p>
        
          <button type="submit" onClick={handleLogIn}>Iniciar Sesión</button>
          </form>
      </div>
      {
        userData && (
          <div className="user-info">
            <h2>Bienvenido, {userData.name}</h2>
            <p>Tienes {userData.auraPoints} puntos de aura</p>
          </div>
        )
      }
    </>
  )
}

export default App
