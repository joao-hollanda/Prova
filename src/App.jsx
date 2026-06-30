import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Inscricao from './pages/Inscricao.jsx'
import Prova from './pages/Prova.jsx'
import Resultado from './pages/Resultado.jsx'
import Admin from './pages/Admin.jsx'
import { useInscricao } from './context/InscricaoContext.jsx'

// Protege rotas que dependem de uma inscrição ativa.
function RotaProtegida({ children }) {
  const { inscricao } = useInscricao()
  if (!inscricao) return <Navigate to="/inscricao" replace />
  return children
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inscricao" element={<Inscricao />} />
          <Route
            path="/prova"
            element={
              <RotaProtegida>
                <Prova />
              </RotaProtegida>
            }
          />
          <Route
            path="/resultado"
            element={
              <RotaProtegida>
                <Resultado />
              </RotaProtegida>
            }
          />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
