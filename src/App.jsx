import { Routes, Route } from 'react-router-dom'
import PaginaNieuwPotje from './pages/PaginaNieuwPotje.jsx'
import PaginaPotje from './pages/PaginaPotje.jsx'
import PaginaStorten from './pages/PaginaStorten.jsx'
import PaginaInstellingen from './pages/PaginaInstellingen.jsx'
import PaginaProfiel from './pages/PaginaProfiel.jsx'

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

      {/* Placeholder routes — nog te bouwen */}
      <Route path="/instellingen/open" element={<PaginaInstellingen />} />
      <Route path="/instellingen/gesloten" element={<PaginaInstellingen />} />
    </Routes>
  )
}

export default App
