import { Route, Routes } from 'react-router-dom'
import { useSmoothScroll } from './lib/smooth'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Operator from './pages/Operator'
import PublicCard from './pages/PublicCard'
import NotFound from './pages/NotFound'

export default function App() {
  useSmoothScroll()
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Dashboard />} />
      <Route path="/operator" element={<Operator />} />
      <Route path="/p/:slug" element={<PublicCard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
