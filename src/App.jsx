import { Routes, Route } from 'react-router-dom'
import PaginaNieuwPotje from './pages/PaginaNieuwPotje.jsx'
import PaginaPotje from './pages/PaginaPotje.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PaginaNieuwPotje />} />
      <Route path="/potje/:id" element={<PaginaPotje />} />
    </Routes>
  )
}

export default App
