import { Routes, Route } from 'react-router-dom'
import PaginaNieuwPotje from './pages/PaginaNieuwPotje.jsx'
import PaginaPotje from './pages/PaginaPotje.jsx'
import PaginaStorten from './pages/PaginaStorten.jsx'
import PaginaInstellingen from './pages/PaginaInstellingen.jsx'
import PaginaProfiel from './pages/PaginaProfiel.jsx'
import PaginaOpenPotjes from './pages/PaginaOpenPotjes.jsx'
import PaginaGeslotenPotjes from './pages/PaginaGeslotenPotjes.jsx'

function App() {
  return (
    <Routes>
      {/* Hoofdflow */}
      <Route path="/" element={<PaginaNieuwPotje />} />
      <Route path="/potje/:id" element={<PaginaPotje />} />
      <Route path="/potje/:id/storten" element={<PaginaStorten />} />

      {/* Instellingen */}
      <Route path="/instellingen" element={<PaginaInstellingen />} />
      <Route path="/instellingen/profiel" element={<PaginaProfiel />} />

      <Route path="/instellingen/open" element={<PaginaOpenPotjes />} />
      <Route path="/instellingen/gesloten" element={<PaginaGeslotenPotjes />} />
    </Routes>
  )
}

export default App
