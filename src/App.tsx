import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import BuilderPage from '@/pages/BuilderPage'
import InputPage from '@/pages/InputPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/builder" element={<BuilderPage />} />
      </Routes>
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}
