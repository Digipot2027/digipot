import { Routes, Route } from 'react-router-dom'
import PaginaNieuwPotje from './pages/PaginaNieuwPotje.jsx'
import PaginaPotje from './pages/PaginaPotje.jsx'
import PaginaStorten from './pages/PaginaStorten.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PaginaNieuwPotje />} />
      <Route path="/potje/:id" element={<PaginaPotje />} />
      <Route path="/potje/:id/storten" element={<PaginaStorten />} />
    </Routes>
  )
}

export default App
